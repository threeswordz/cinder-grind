import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { normalizeMasterCode } from '../master-data/master-validation';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { DocumentStorage } from '../documents/document-storage';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { sealHrPrivateAttachment, openHrPrivateAttachment,
  HR_PRIVATE_ATTACHMENT_MAX_BYTES, type HrAttachmentFile } from './hr-private-attachment-codec';
import { HrPrivateCrypto, HrPrivateBinding } from './hr-private-crypto';
import * as input from './hr-input';

type Tx = Prisma.TransactionClient;
type Requirement = { companyId: string; category: input.HrCategory | 'access'; action: 'view' | 'manage' };
type Receipt = { id: string; version: number };
const employeeProjection = { id: true, employeeCode: true, employeeName: true, jobTitle: true, isActive: true } as const;
const revisionProjection = { id: true, version: true, payBasis: true, employmentForm: true, siteKind: true,
  startDate: true, endDate: true, projectId: true, createdAt: true } as const;
const notFound = () => new NotFoundException({ code: 'HR_NOT_FOUND', detail: 'HR resource not found.' });
const conflict = () => new ConflictException({ code: 'HR_CONFLICT', detail: 'The HR record or request has changed. Refresh before continuing.' });

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly projects: ProjectAccessService, private readonly crypto: HrPrivateCrypto,
    @Inject(DocumentStorage) private readonly storage: DocumentStorage,
    private readonly policy: DocumentPolicyService) {}

  private async actor(tx: Tx, supplied: AuthenticatedUserContext): Promise<AuthenticatedUserContext> {
    input.uuid(supplied.userId); input.uuid(supplied.companyId); input.uuid(supplied.sessionId);
    const session = await tx.userSession.findFirst({ where: { id: supplied.sessionId, userId: supplied.userId,
      revokedAt: null, expiresAt: { gt: new Date() } } });
    const user = await tx.user.findFirst({ where: { id: supplied.userId, companyId: supplied.companyId,
      isActive: true, company: { isActive: true } }, include: { userRoles: { include: { role: {
        include: { rolePermissions: { include: { permission: true } } } } } } } });
    if (!session || !user) throw notFound();
    const roles = user.userRoles.filter(r => r.companyId === user.companyId && r.role.companyId === user.companyId && r.role.isActive).map(r => r.role);
    return { ...supplied, email: user.email, displayName: user.displayName, csrfTokenHash: session.csrfTokenHash,
      roleCodes: roles.map(r => r.roleCode), permissions: [...new Set(roles.flatMap(r => r.rolePermissions.map(p => p.permission.permissionCode)))] };
  }

  private async require(tx: Tx, auth: AuthenticatedUserContext, requirement: Requirement) {
    const { companyId, category, action } = requirement;
    input.uuid(companyId);
    if (!auth.permissions.includes(`hr.${category}.${action}`)) throw notFound();
    if (category === 'access') {
      // Target-owned technical configuration, never an HR cross-Company bypass.
      if (companyId !== auth.companyId || action !== 'manage') throw notFound();
      return;
    }
    const grant = await tx.hrCompanyAccess.findFirst({ where: { companyId, userId: auth.userId,
      category, isActive: true, company: { isActive: true } } });
    if (!grant) throw notFound();
  }

  private async transaction<T>(action: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002'].includes(error.code)) {
          if (attempt < 4) continue;
          throw conflict();
        }
        throw error;
      }
    }
    throw conflict();
  }

  private read<T>(supplied: AuthenticatedUserContext, requirements: Requirement[], action: (tx: Tx, auth: AuthenticatedUserContext) => Promise<T>) {
    return this.transaction(async tx => {
      const auth = await this.actor(tx, supplied);
      for (const requirement of requirements) await this.require(tx, auth, requirement);
      return action(tx, auth);
    });
  }

  private write(supplied: AuthenticatedUserContext, companyId: string, requestId: string, operation: string,
    body: unknown, requirements: Requirement[], action: (tx: Tx, auth: AuthenticatedUserContext) => Promise<Receipt>) {
    input.uuid(companyId); input.uuid(requestId);
    return this.transaction(async tx => {
      // Shared ordering for writes, entitlement changes and cross-Company links.
      for (const target of [...new Set([companyId, ...requirements.map(r => r.companyId)])].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'hr-company:' + target}, 0))`;
      }
      const auth = await this.actor(tx, supplied);
      for (const requirement of requirements) await this.require(tx, auth, requirement);
      const previous = await tx.hrReplay.findUnique({ where: { companyId_actorUserId_requestId: { companyId, actorUserId: auth.userId, requestId } } });
      if (previous && previous.operation !== operation) throw conflict();
      const canonical = Buffer.from(input.stable({ operation, companyId, actorUserId: auth.userId, body }), 'utf8');
      let fingerprint: { keyId: string; digest: string };
      try {
        // Scope administration contains only identifiers, fixed reason codes and
        // booleans. It must remain revocable while private keys are unavailable.
        if (operation === 'ACCESS_CHANGE') {
          if (previous && previous.keyId !== 'scope-public-v1') throw conflict();
          fingerprint = { keyId: 'scope-public-v1', digest: createHash('sha256').update(canonical).digest('hex') };
        } else fingerprint = this.crypto.fingerprint(canonical, previous?.keyId);
      } finally { canonical.fill(0); }
      if (previous) {
        if (previous.operation !== operation || previous.digest !== fingerprint.digest) throw conflict();
        return previous.receipt as Receipt;
      }
      const receipt = await action(tx, auth);
      await tx.hrReplay.create({ data: { companyId, actorUserId: auth.userId, requestId, operation,
        keyId: fingerprint.keyId, digest: fingerprint.digest, receipt } });
      return receipt;
    });
  }

  private async record(tx: Tx, auth: AuthenticatedUserContext, companyId: string, entityId: string,
    action: string, metadata: Record<string, string | number | boolean>) {
    // Event ownership is the authorized target Company; actor identity remains
    // unchanged. This local audit context is never used as session authority.
    await this.audit.record({ auth: { ...auth, companyId }, entityType: 'HR', entityId, action,
      newValues: { targetCompanyId: companyId, ...metadata } }, tx);
  }

  private seal(value: unknown, binding: HrPrivateBinding) {
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    try { return this.crypto.seal(bytes, binding); } finally { bytes.fill(0); }
  }
  private open(ciphertext: string, binding: HrPrivateBinding): Record<string, unknown> {
    const bytes = this.crypto.open(ciphertext, binding);
    try { return JSON.parse(bytes.toString('utf8')) as Record<string, unknown>; } finally { bytes.fill(0); }
  }
  private async employee(tx: Tx, companyId: string, employeeId: string) {
    input.uuid(employeeId);
    const employee = await tx.employee.findFirst({ where: { id: employeeId, companyId }, select: employeeProjection });
    if (!employee) throw notFound();
    return employee;
  }

  companies(supplied: AuthenticatedUserContext) {
    return this.read(supplied, [], async (tx, auth) => {
      const categories = input.hrCategories.filter(category => ['view','manage'].some(action => auth.permissions.includes(`hr.${category}.${action}`)));
      const grants = await tx.hrCompanyAccess.findMany({ where: { userId: auth.userId, isActive: true,
        category: { in: categories }, company: { isActive: true } }, include: { company: true }, orderBy: { companyId: 'asc' } });
      return [...new Set(grants.map(g => g.companyId))].map(id => {
        const own = grants.filter(g => g.companyId === id), company = own[0]!.company;
        return { id, companyCode: company.companyCode, companyName: company.companyName,
          categories: own.map(g => g.category).sort(), permissions: auth.permissions.filter(p => p.startsWith('hr.') && own.some(g => p.startsWith(`hr.${g.category}.`))) };
      });
    });
  }

  list(supplied: AuthenticatedUserContext, companyId: string, after?: string) {
    if (after !== undefined) input.uuid(after);
    return this.read(supplied, [{ companyId, category: 'employment', action: 'view' }], async tx => {
      const rows = await tx.employee.findMany({ where: { companyId, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' }, take: 100, select: { ...employeeProjection,
          hrEmployment: { select: { currentVersion: true, revisions: { orderBy: { version: 'desc' }, take: 1, select: revisionProjection } } } } });
      return { items: rows, nextCursor: rows.length === 100 ? rows[99]!.id : null };
    });
  }

  history(supplied: AuthenticatedUserContext, companyId: string, employeeId: string) {
    return this.read(supplied, [{ companyId, category: 'employment', action: 'view' }], async tx => {
      const employee = await this.employee(tx, companyId, employeeId);
      const employment = await tx.hrEmployment.findUnique({ where: { companyId_employeeId: { companyId, employeeId } },
        select: { id: true, currentVersion: true, revisions: { orderBy: { version: 'asc' }, select: revisionProjection } } });
      return { employee, employment };
    });
  }


  // Dedicated HR-only, masked attachment history. This is never a generic
  // Document list or a grant to access encrypted bytes/original filenames.
  documentHistory(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, afterVersion = 0) {
    input.uuid(employeeId);
    input.integer(afterVersion);
    return this.read(supplied, [{ companyId, category: 'documents', action: 'view' }], async tx => {
      await this.employee(tx, companyId, employeeId);
      const rows = await tx.hrDocumentAttachment.findMany({
        where: { companyId, employeeId, version: { gt: afterVersion } },
        orderBy: { version: 'asc' }, take: 100,
        select: { id: true, version: true, createdAt: true },
      });
      return { items: rows, nextCursor: rows.length === 100 ? rows[99]!.version : null };
    });
  }

  create(supplied: AuthenticatedUserContext, companyId: string, raw: unknown) {
    const value = input.object(raw, ['requestId','employeeCode','employeeName','jobTitle','facts','predecessor']);
    const facts = input.employmentFacts(value.facts), requestId = input.uuid(value.requestId);
    const data = { employeeCode: normalizeMasterCode(input.text(value.employeeCode, 50), 'employeeCode', 50), employeeName: input.text(value.employeeName, 200),
      jobTitle: value.jobTitle == null ? null : input.text(value.jobTitle, 150), facts,
      predecessor: value.predecessor === undefined ? null : input.predecessor(value.predecessor) };
    const requirements: Requirement[] = [{ companyId, category: 'employment', action: 'manage' }];
    if (data.predecessor) requirements.push({ companyId, category: 'identity', action: 'manage' },
      { companyId: data.predecessor.companyId, category: 'identity', action: 'manage' });
    return this.write(supplied, companyId, requestId, 'EMPLOYEE_CREATE', data, requirements, async (tx, auth) => {
      if (data.predecessor) {
        const source = await this.employee(tx, data.predecessor.companyId, data.predecessor.employeeId);
        if (source.employeeCode.trim().toUpperCase() === data.employeeCode) throw conflict();
      }
      const row = await tx.employee.create({ data: { companyId, employeeCode: data.employeeCode,
        employeeName: data.employeeName, jobTitle: data.jobTitle } });
      await this.saveEmployment(tx, auth, companyId, row.id, 0, facts);
      if (data.predecessor) await this.link(tx, auth, companyId, row.id, data.predecessor);
      return { id: row.id, version: 1 };
    });
  }

  employment(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, raw: unknown) {
    input.uuid(employeeId);
    const value = input.object(raw, ['requestId','expectedVersion','facts']);
    const data = { employeeId, expectedVersion: input.integer(value.expectedVersion), facts: input.employmentFacts(value.facts) };
    return this.write(supplied, companyId, input.uuid(value.requestId), 'EMPLOYMENT_REVISION', data,
      [{ companyId, category: 'employment', action: 'manage' }], async (tx, auth) => {
        await this.saveEmployment(tx, auth, companyId, employeeId, data.expectedVersion, data.facts);
        return { id: employeeId, version: data.expectedVersion + 1 };
      });
  }

  private async saveEmployment(tx: Tx, auth: AuthenticatedUserContext, companyId: string, employeeId: string,
    expectedVersion: number, facts: input.EmploymentFacts) {
    await this.employee(tx, companyId, employeeId);
    if (facts.projectId && !await tx.project.count({ where: { id: facts.projectId, companyId, isActive: true } })) throw notFound();
    let employment = await tx.hrEmployment.findUnique({ where: { companyId_employeeId: { companyId, employeeId } } });
    if ((employment?.currentVersion ?? 0) !== expectedVersion) throw conflict();
    if (!employment) employment = await tx.hrEmployment.create({ data: { companyId, employeeId } });
    const id = randomUUID(), version = expectedVersion + 1;
    const { reason, hiringApprovalReference, ...operational } = facts;
    await tx.hrEmploymentRevision.create({ data: { id, companyId, employmentId: employment.id, version,
      ...operational, actorUserId: auth.userId,
      ciphertext: this.seal({ reason, hiringApprovalReference }, { companyId, employeeId, category: 'employment-history', recordId: id, version }) } });
    await tx.hrEmployment.update({ where: { id: employment.id }, data: { currentVersion: version } });
    await this.record(tx, auth, companyId, employeeId, 'EMPLOYMENT_REVISION', { revisionId: id, version, reasonRecorded: true });
  }

  employmentReason(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, revisionId: string) {
    input.uuid(employeeId); input.uuid(revisionId);
    return this.read(supplied, [{ companyId, category: 'identity', action: 'view' }], async (tx, auth) => {
      const row = await tx.hrEmploymentRevision.findFirst({ where: { id: revisionId, companyId, employment: { employeeId } } });
      if (!row) throw notFound();
      const value = this.open(row.ciphertext, { companyId, employeeId, category: 'employment-history', recordId: row.id, version: row.version });
      await this.record(tx, auth, companyId, employeeId, 'EMPLOYMENT_PRIVATE_REVEAL', { revisionId, version: row.version });
      return { reason: value.reason, hiringApprovalReference: value.hiringApprovalReference };
    });
  }

  linkEpisodes(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, raw: unknown) {
    input.uuid(employeeId);
    const value = input.object(raw, ['requestId','source']);
    const source = input.predecessor(value.source);
    return this.write(supplied, companyId, input.uuid(value.requestId), 'PERSON_LINK', { employeeId, source },
      [{ companyId, category: 'identity', action: 'manage' }, { companyId: source.companyId, category: 'identity', action: 'manage' }],
      async (tx, auth) => { await this.link(tx, auth, companyId, employeeId, source); return { id: employeeId, version: 1 }; });
  }

  private async link(tx: Tx, auth: AuthenticatedUserContext, companyId: string, employeeId: string, source: ReturnType<typeof input.predecessor>) {
    if (source.employeeId === employeeId) throw conflict();
    await this.employee(tx, companyId, employeeId); await this.employee(tx, source.companyId, source.employeeId);
    const links = await tx.hrPersonLink.findMany({ where: { OR: [{ companyId, employeeId }, { companyId: source.companyId, employeeId: source.employeeId }] } });
    const people = [...new Set(links.map(l => l.personId))];
    if (people.length > 1) throw conflict(); // Never merge existing identity groups implicitly.
    const personId = people[0] ?? (await tx.hrPerson.create({ data: { createdByUserId: auth.userId } })).id;
    for (const target of [{ companyId, employeeId }, { companyId: source.companyId, employeeId: source.employeeId }]) {
      if (links.some(l => l.employeeId === target.employeeId)) continue;
      const id = randomUUID();
      await tx.hrPersonLink.create({ data: { id, ...target, personId, verifiedByUserId: auth.userId,
        ciphertext: this.seal({ reason: source.verificationReason }, { ...target, category: 'identity', recordId: id, version: 1 }) } });
      await this.record(tx, auth, target.companyId, target.employeeId, 'PERSON_LINK_VERIFIED', { linkId: id, reasonRecorded: true });
    }
  }

  privateWrite(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, category: input.PrivateCategory, raw: unknown) {
    input.uuid(employeeId); input.choice(category, ['identity','bank']);
    const value = input.object(raw, ['requestId','expectedVersion','values','reason']);
    const data = { employeeId, category, expectedVersion: input.integer(value.expectedVersion),
      values: input.privateValues(category, value.values), reason: input.text(value.reason) };
    return this.write(supplied, companyId, input.uuid(value.requestId), 'PRIVATE_REVISION', data,
      [{ companyId, category, action: 'manage' }], async (tx, auth) => {
        await this.employee(tx, companyId, employeeId);
        const prior = await tx.hrPrivateRevision.findFirst({ where: { companyId, employeeId, category }, orderBy: { version: 'desc' } });
        if ((prior?.version ?? 0) !== data.expectedVersion) throw conflict();
        const id = randomUUID(), version = data.expectedVersion + 1;
        await tx.hrPrivateRevision.create({ data: { id, companyId, employeeId, category, version, actorUserId: auth.userId,
          ciphertext: this.seal({ values: data.values, reason: data.reason }, { companyId, employeeId, category, recordId: id, version }) } });
        await this.record(tx, auth, companyId, employeeId, 'PRIVATE_REVISION', { category, revisionId: id, version, reasonRecorded: true });
        return { id, version };
      });
  }


  /**
   * HR-only memory upload. The authenticated actor and explicit target-Company
   * document entitlement are checked BEFORE any ciphertext reaches storage,
   * and again within the serializable, replay-guarded canonical transaction.
   * Neither the original name nor plaintext checksum enters generic Documents,
   * AuditLog or HR replay receipts. Never use a Project attachment alias.
   */
  /**
   * HR-only active generic Document Type choices. An HR document-grant user
   * can choose a valid Company-owned type without receiving generic
   * Document, Project or SYS_ADMIN lookup rights.
   */
  documentTypeOptions(supplied: AuthenticatedUserContext, companyId: string, after?: string) {
    if (after !== undefined) input.uuid(after);
    return this.read(supplied, [{ companyId, category: 'documents', action: 'manage' }], async tx => {
      const rows = await tx.documentType.findMany({
        where: { companyId, isActive: true, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' }, take: 101,
        select: { id: true, documentTypeCode: true, documentTypeName: true },
      });
      return { items: rows.slice(0, 100),
        nextCursor: rows.length > 100 ? rows[99]!.id : null };
    });
  }

  async uploadDocument(supplied: AuthenticatedUserContext, companyId: string,
    employeeId: string, raw: unknown, file: HrAttachmentFile): Promise<Receipt> {
    // Multipart memory must be cleared for every failure path, including a
    // missing role, CSRF-validated but revoked HR grant, malformed metadata,
    // rejected MIME and any orphan-storage cleanup error.
    if (!file || !Buffer.isBuffer(file.buffer)) input.invalid();
    try {
    input.uuid(companyId); input.uuid(employeeId);
    const body = input.object(raw, ['requestId','documentTypeId','expectedVersion']);
    const requestId = input.uuid(body.requestId), documentTypeId = input.uuid(body.documentTypeId);
    if (typeof body.expectedVersion !== 'string' ||
      !/^(0|[1-9][0-9]{0,8})$/.test(body.expectedVersion)) input.invalid();
    const expectedVersion = input.integer(Number(body.expectedVersion));
    if (file.buffer.length < 1 || file.buffer.length > HR_PRIVATE_ATTACHMENT_MAX_BYTES) input.invalid();
    const normalized = this.policy.validate({
      originalname: file.originalname, mimetype: file.mimetype,
      size: file.buffer.length, buffer: file.buffer,
    });
    // This early authorization precedes file-storage side effects. The write
    // transaction repeats it; neither proof survives a revoke or session end.
    await this.read(supplied, [{ companyId, category: 'documents', action: 'manage' }], async tx => {
      await this.employee(tx, companyId, employeeId);
      if (!await tx.documentType.count({ where: { id: documentTypeId, companyId, isActive: true } }))
        throw notFound();
    });
    const fileFingerprint = createHash('sha256').update(file.buffer).digest('hex');
    const canonical = { employeeId, documentTypeId, expectedVersion,
      fileName: normalized.fileName, mimeType: normalized.mimeType,
      fileSizeBytes: file.buffer.length, fileFingerprint };
    const attachmentId = randomUUID(), documentId = randomUUID();
    const version = expectedVersion + 1;
    const sealed = sealHrPrivateAttachment(this.crypto, this.policy,
      { companyId, employeeId, recordId: attachmentId, version }, file);
    let key: string | null = null;
    try {
      const stored = await this.storage.put(sealed.encryptedBytes);
      key = stored.storageKey;
      const result = await this.write(supplied, companyId, requestId,
        'DOCUMENT_UPLOAD', canonical, [{ companyId, category: 'documents', action: 'manage' }],
        async (tx, auth) => {
          await this.employee(tx, companyId, employeeId);
          if (!await tx.documentType.count({ where: { id: documentTypeId, companyId, isActive: true } }))
            throw notFound();
          const last = await tx.hrDocumentAttachment.findFirst({
            where: { companyId, employeeId }, orderBy: { version: 'desc' },
            select: { version: true },
          });
          if ((last?.version ?? 0) !== expectedVersion) throw conflict();
          await tx.document.create({ data: {
            id: documentId, companyId, documentTypeId,
            fileName: sealed.genericFileName, mimeType: sealed.genericMimeType,
            fileSizeBytes: sealed.genericSizeBytes, checksum: sealed.encryptedChecksum,
            storageProvider: stored.storageProvider, storageKey: stored.storageKey,
            uploadedByUserId: auth.userId,
          } });
          await tx.documentLink.create({ data: {
            documentId, entityType: 'HR_ATTACHMENT', entityId: employeeId,
            linkedByUserId: auth.userId,
          } });
          await tx.hrDocumentAttachment.create({ data: {
            id: attachmentId, companyId, employeeId, documentId, version,
            actorUserId: auth.userId, encryptedMetadata: sealed.encryptedMetadata,
          } });
          await this.record(tx, auth, companyId, employeeId, 'DOCUMENT_UPLOAD', {
            attachmentId, version, documentId, encrypted: true,
          });
          return { id: attachmentId, version };
        });
      // Replays return the original receipt, not the speculative attachment.
      // Delete only the newly created orphan ciphertext in that case.
      if (result.id !== attachmentId) {
        await this.storage.remove(stored.storageKey);
        key = null;
      }
      return result;
    } catch (error) {
      if (key) await this.storage.remove(key);
      throw error;
    } finally {
      sealed.encryptedBytes.fill(0);
    }
    } finally {
      file.buffer.fill(0);
    }
  }

  /**
   * Fetch encrypted bytes through canonical storage only AFTER persisted
   * authorization, then revalidate again before decrypting / returning the
   * response. No generic Document download permission is accepted.
   */
  async downloadDocument(supplied: AuthenticatedUserContext, companyId: string,
    employeeId: string, attachmentId: string) {
    input.uuid(companyId); input.uuid(employeeId); input.uuid(attachmentId);
    const requirement: Requirement = { companyId, category: 'documents', action: 'view' };
    const fetchRow = (tx: Tx) => tx.hrDocumentAttachment.findFirst({
      where: { id: attachmentId, companyId, employeeId, document: { isActive: true } },
      include: { document: { select: { storageProvider: true, storageKey: true, checksum: true } } },
    });
    const initial = await this.read(supplied, [requirement], async tx => {
      await this.employee(tx, companyId, employeeId);
      const found = await fetchRow(tx);
      if (!found || found.document.storageProvider !== 'LOCAL') throw notFound();
      return { storageKey: found.document.storageKey };
    });
    const encrypted = await this.storage.read(initial.storageKey);
    try {
      return await this.read(supplied, [requirement], async (tx, auth) => {
        const row = await fetchRow(tx);
        if (!row || row.document.storageProvider !== 'LOCAL' ||
            row.document.storageKey !== initial.storageKey ||
            createHash('sha256').update(encrypted).digest('hex') !== row.document.checksum)
          throw notFound();
        const opened = openHrPrivateAttachment(this.crypto, this.policy,
          { companyId, employeeId, recordId: row.id, version: row.version },
          encrypted, row.encryptedMetadata);
        await this.record(tx, auth, companyId, employeeId, 'DOCUMENT_DOWNLOAD', {
          attachmentId: row.id, version: row.version,
        });
        return { bytes: opened.bytes, fileName: opened.originalname,
          mimeType: opened.mimetype, fileSizeBytes: opened.bytes.length };
      });
    } finally {
      encrypted.fill(0);
    }
  }

  privateRead(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, category: input.PrivateCategory, version?: number) {
    input.uuid(employeeId); input.choice(category, ['identity','bank']);
    if (version !== undefined) input.integer(version, 1);
    return this.read(supplied, [{ companyId, category, action: 'view' }], async (tx, auth) => {
      await this.employee(tx, companyId, employeeId);
      const row = await tx.hrPrivateRevision.findFirst({ where: { companyId, employeeId, category, ...(version !== undefined ? { version } : {}) }, orderBy: { version: 'desc' } });
      if (!row) { if (version !== undefined) throw notFound(); return { version: 0, values: {} }; }
      const decrypted = this.open(row.ciphertext, { companyId, employeeId, category, recordId: row.id, version: row.version });
      const values = input.privateValues(category, decrypted.values);
      if (version !== undefined) await this.record(tx, auth, companyId, employeeId, 'PRIVATE_REVEAL', { category, revisionId: row.id, version });
      return { version: row.version, values: version === undefined ? Object.fromEntries(Object.keys(values).map(key => [key, '••••'])) : values };
    });
  }

  accessList(supplied: AuthenticatedUserContext, companyId: string, after?: string) {
    if (after !== undefined) input.uuid(after);
    return this.read(supplied, [{ companyId, category: 'access', action: 'manage' }], async tx => {
      const rows = await tx.hrCompanyAccess.findMany({ where: { companyId, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' }, take: 101,
        select: { id: true, userId: true, category: true, isActive: true, version: true, reasonCode: true, updatedAt: true } });
      return { items: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99]!.id : null };
    });
  }

  privateHistory(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, category: input.PrivateCategory) {
    input.uuid(employeeId); input.choice(category, ['identity','bank']);
    return this.read(supplied, [{ companyId, category, action: 'view' }], async tx => {
      await this.employee(tx, companyId, employeeId);
      return tx.hrPrivateRevision.findMany({ where: { companyId, employeeId, category }, orderBy: { version: 'asc' },
        select: { id: true, version: true, createdAt: true, actorUserId: true } });
    });
  }

  privateReason(supplied: AuthenticatedUserContext, companyId: string, employeeId: string, category: input.PrivateCategory, version: number) {
    input.uuid(employeeId); input.choice(category, ['identity','bank']); input.integer(version, 1);
    return this.read(supplied, [{ companyId, category, action: 'view' }, { companyId, category: 'identity', action: 'view' }], async (tx, auth) => {
      const row = await tx.hrPrivateRevision.findFirst({ where: { companyId, employeeId, category, version } });
      if (!row) throw notFound();
      const decrypted = this.open(row.ciphertext, { companyId, employeeId, category, recordId: row.id, version });
      await this.record(tx, auth, companyId, employeeId, 'PRIVATE_REASON_REVEAL', { category, revisionId: row.id, version });
      return { reason: decrypted.reason };
    });
  }
  accessWrite(supplied: AuthenticatedUserContext, companyId: string, raw: unknown) {
    const value = input.object(raw, ['requestId','userId','category','isActive','expectedVersion','reasonCode']);
    if (typeof value.isActive !== 'boolean') input.invalid();
    const data = { userId: input.uuid(value.userId), category: input.choice(value.category, input.hrCategories),
      isActive: value.isActive, expectedVersion: input.integer(value.expectedVersion),
      reasonCode: input.choice(value.reasonCode, ['OWNER_APPROVED_SCOPE','SCOPE_CORRECTION','ACCESS_REVOKED'] as const) };
    return this.write(supplied, companyId, input.uuid(value.requestId), 'ACCESS_CHANGE', data,
      [{ companyId, category: 'access', action: 'manage' }], async (tx, auth) => {
        if (data.userId === auth.userId) throw new ForbiddenException({ code: 'HR_SELF_GRANT_DENIED', detail: 'You cannot change your own HR Company access.' });
        if (!await tx.user.count({ where: { id: data.userId, isActive: true, company: { isActive: true } } })) throw notFound();
        const prior = await tx.hrCompanyAccess.findUnique({ where: { companyId_userId_category: { companyId, userId: data.userId, category: data.category } } });
        if ((prior?.version ?? 0) !== data.expectedVersion) throw conflict();
        const fields = { isActive: data.isActive, reasonCode: data.reasonCode, updatedByUserId: auth.userId };
        const row = prior ? await tx.hrCompanyAccess.update({ where: { id: prior.id }, data: { ...fields, version: prior.version + 1 } }) :
          await tx.hrCompanyAccess.create({ data: { companyId, userId: data.userId, category: data.category, ...fields } });
        await this.record(tx, auth, companyId, row.id, 'ACCESS_CHANGE', { userId: data.userId, category: data.category,
          isActive: row.isActive, version: row.version, reasonCode: data.reasonCode });
        return { id: row.id, version: row.version };
      });
  }

  operational(supplied: AuthenticatedUserContext, projectId: string) {
    input.uuid(projectId);
    return this.read(supplied, [], async (tx, auth) => {
      if (!auth.permissions.includes('hr.operational.view')) throw notFound();
      await this.projects.assertAccess(auth, projectId, tx);
      return tx.employee.findMany({ where: { companyId: auth.companyId, isActive: true,
        projectMembers: { some: { projectId, isActive: true } } }, take: 100, orderBy: { id: 'asc' },
        select: { id: true, employeeCode: true, employeeName: true, jobTitle: true } });
    });
  }
}
