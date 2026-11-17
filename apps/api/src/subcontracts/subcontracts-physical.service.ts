import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { DocumentStorage } from '../documents/document-storage';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { PhysicalDb, physicalActor } from './subcontract-physical-actor';
import { PHYSICAL, PhysicalObservation, physicalCapture, physicalDecision, physicalUuid } from './subcontract-physical-contract';
import { requiredSubcontractString, subcontractObject } from './subcontract-validation';

type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type Tx = Prisma.TransactionClient;
type Evidence = { id: string; checksum: string; size: number; fileName: string; mimeType: string };
type PreparedDecision = ReturnType<typeof physicalDecision>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function conflict(code: string): never { throw new ConflictException({ code }); }

@Injectable()
export class SubcontractsPhysicalService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService,
    private readonly audit: AuditService, private readonly storage: DocumentStorage) {}

  private async transaction<T>(work: (tx: Tx) => Promise<T>) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: 'ReadCommitted', timeout: 30000 }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' || error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))) {
            if (attempt < 2) continue; conflict('PHYSICAL_RETRY_REQUIRED');
          }
          if (error.code === 'P2002') conflict('PHYSICAL_CONCURRENT_CONFLICT');
          const safe = String(error.meta?.message ?? '').match(/PHYSICAL_[A-Z_]+/)?.[0];
          if (safe) conflict(safe);
        }
        throw error;
      }
    }
    return conflict('PHYSICAL_RETRY_REQUIRED');
  }

  private async key(tx: Tx, auth: AuthenticatedUserContext, requestKey: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['physical-key', auth.companyId, auth.userId, requestKey].join(':')},0))`;
  }

  private async lock(tx: Tx, auth: AuthenticatedUserContext, claimId: string) {
    const visible = await tx.subcontractClaim.findFirst({ where: { id: claimId, companyId: auth.companyId }, select: { agreementId: true, projectId: true } });
    if (!visible) throw new NotFoundException({ code: 'PHYSICAL_CLAIM_NOT_FOUND' });
    await this.access.assertAccess(auth, visible.projectId, tx);
    await tx.$queryRaw`SELECT id FROM subcontract_agreements WHERE id=${visible.agreementId}::uuid AND company_id=${auth.companyId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM subcontract_claims WHERE id=${claimId}::uuid AND company_id=${auth.companyId}::uuid FOR UPDATE`;
    const claim = await tx.subcontractClaim.findUniqueOrThrow({ where: { id: claimId } });
    const source = await tx.subcontractPhysicalClaim.findUnique({ where: { claimId } });
    if (!source || source.companyId !== auth.companyId) throw new NotFoundException({ code: 'PHYSICAL_CLAIM_NOT_CONTROLLED' });
    return { claim, source };
  }

  async controlled(claimId: string, db: PhysicalDb) { return db.subcontractPhysicalClaim.findUnique({ where: { claimId } }); }

  async authorize(auth: AuthenticatedUserContext, claimId: string, db: PhysicalDb, extra: string[] = []) {
    const controlled = await this.controlled(claimId, db);
    if (!controlled) return null;
    const actor = await physicalActor(auth, db, [PHYSICAL + 'view', 'subcontracts.claim.view', ...extra]);
    if (controlled.companyId !== actor.companyId) throw new NotFoundException({ code: 'PHYSICAL_CLAIM_NOT_FOUND' });
    await this.access.assertAccess(actor, controlled.projectId, db);
    return actor;
  }

  async enable(context: Context, projectId: string, value: unknown) {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException({ code: 'PHYSICAL_SYNTHETIC_ONLY' });
    const body = subcontractObject(value), requestKey = physicalUuid(body.requestKey, 'requestKey');
    const reason = requiredSubcontractString(body, 'reason', 2000);
    return this.transaction(async tx => {
      const auth = await physicalActor(context.auth, tx, [PHYSICAL + 'configure', PHYSICAL + 'view']);
      await this.access.assertAccess(auth, projectId, tx); await this.key(tx, auth, requestKey);
      const digest = hash(['ENABLE', projectId, reason]), old = await this.prior(tx, auth, requestKey, 'ENABLE', digest);
      if (old) return old.outcome;
      await tx.subcontractPhysicalPolicy.create({ data: { projectId, companyId: auth.companyId, enabledByUserId: auth.userId, reason } });
      const outcome = { projectId, enabled: true };
      await this.operation(context, tx, projectId, null, requestKey, 'ENABLE', digest, outcome);
      return outcome;
    });
  }

  private async prior(tx: Tx, auth: AuthenticatedUserContext, requestKey: string, action: string, bodyDigest: string) {
    const old = await tx.subcontractPhysicalOperation.findUnique({ where: { companyId_actorUserId_requestKey: { companyId: auth.companyId, actorUserId: auth.userId, requestKey } } });
    if (old && (old.action !== action || old.bodyDigest !== bodyDigest)) conflict('PHYSICAL_REPLAY_CONFLICT');
    return old;
  }

  private async operation(context: Context, tx: Tx, projectId: string, claimId: string | null, requestKey: string, action: string, bodyDigest: string, outcome: Prisma.InputJsonValue) {
    await tx.subcontractPhysicalOperation.create({ data: { companyId: context.auth.companyId, actorUserId: context.auth.userId, projectId, claimId, requestKey, action, bodyDigest, outcome } });
    await this.audit.record({ ...context, entityType: 'SUBCONTRACT_CLAIM', entityId: claimId ?? projectId, action: 'PHYSICAL_' + action, newValues: outcome }, tx);
  }

  async capture(context: Context, claimId: string, value: unknown) {
    const input = physicalCapture(value);
    return this.transaction(async tx => {
      const auth = await physicalActor(context.auth, tx, [PHYSICAL + 'view', PHYSICAL + 'edit', 'subcontracts.claim.view', 'subcontracts.claim.edit']);
      await this.key(tx, auth, input.requestKey);
      const { claim, source } = await this.lock(tx, auth, claimId), digest = hash(['CAPTURE', claimId, input]);
      const old = await this.prior(tx, auth, input.requestKey, 'CAPTURE', digest);
      if (old) return old.outcome;
      if (claim.state !== 'DRAFT' || source.version !== input.expectedVersion) conflict('PHYSICAL_DRAFT_VERSION_CONFLICT');
      await tx.subcontractPhysicalClaim.update({ where: { claimId }, data: { version: { increment: 1 } } });
      const revision = await tx.subcontractPhysicalRevision.create({ data: {
        claimId, version: source.version + 1, actorUserId: auth.userId, reason: input.reason,
        observations: input.observations as unknown as Prisma.InputJsonValue,
      } });
      // The row-version and revision are one transaction; SQL verifies both.
      const outcome = { claimId, revisionId: revision.id, version: source.version + 1 };
      await this.operation(context, tx, claim.projectId, claimId, input.requestKey, 'CAPTURE', digest, outcome);
      return outcome;
    });
  }

  private async evidence(tx: PhysicalDb, claimId: string, revisionId: string) {
    const rows = await tx.$queryRaw<Array<{ evidence: Evidence[] }>>`SELECT erp_physical_evidence(${claimId}::uuid,${revisionId}::uuid) AS evidence`;
    const evidence = rows[0]?.evidence;
    if (!evidence?.length) conflict('PHYSICAL_EVIDENCE_REQUIRED');
    for (const item of evidence) {
      const document = await tx.document.findUnique({ where: { id: item.id }, select: { storageKey: true } });
      if (!document) conflict('PHYSICAL_EVIDENCE_REQUIRED');
      const bytes = await this.storage.read(document.storageKey);
      if (bytes.length !== item.size || createHash('sha256').update(bytes).digest('hex') !== item.checksum) conflict('PHYSICAL_EVIDENCE_BYTES_CHANGED');
    }
    return evidence;
  }

  async freeze(context: Context, tx: Tx, claimId: string, expectedVersion?: number) {
    const auth = await this.authorize(context.auth, claimId, tx, [PHYSICAL + 'edit', 'subcontracts.claim.submit', 'documents.document.view']);
    if (!auth) return;
    const source = await tx.subcontractPhysicalClaim.findUniqueOrThrow({ where: { claimId } });
    if (source.version !== expectedVersion) conflict('PHYSICAL_DRAFT_VERSION_CONFLICT');
    const revision = await tx.subcontractPhysicalRevision.findUnique({ where: { claimId_version: { claimId, version: source.version } } });
    if (!revision) conflict('PHYSICAL_OBSERVATIONS_REQUIRED');
    const evidence = await this.evidence(tx, claimId, revision.id);
    const row = await tx.subcontractPhysicalSubmission.create({ data: { claimId, revisionId: revision.id, actorUserId: auth.userId,
      sourceDigest: '0'.repeat(64), commercialSource: {}, evidence: [] } });
    if (JSON.stringify(row.evidence) !== JSON.stringify(evidence)) conflict('PHYSICAL_EVIDENCE_CHANGED_DURING_SUBMIT');
  }

  async assertSource(auth: AuthenticatedUserContext, claimId: string, tx: PhysicalDb) {
    if (!await this.authorize(auth, claimId, tx, ['documents.document.view'])) return;
    await tx.$executeRaw`SELECT erp_physical_assert_source(${claimId}::uuid)`;
    const submission = await tx.subcontractPhysicalSubmission.findUnique({ where: { claimId } });
    if (!submission) conflict('PHYSICAL_SUBMISSION_REQUIRED');
    await this.evidence(tx, claimId, submission.revisionId);
  }

  async prepareDecision(context: Context, tx: Tx, claimId: string, value: unknown): Promise<PreparedDecision | null> {
    const controlled = await this.controlled(claimId, tx);
    if (!controlled) {
      if (value !== undefined) conflict('PHYSICAL_CLAIM_NOT_CONTROLLED');
      return null;
    }
    const auth = await this.authorize(context.auth, claimId, tx, [PHYSICAL + 'decide', 'subcontracts.assessment.assess', 'documents.document.view']);
    if (value === undefined) conflict('PHYSICAL_DECISION_REQUIRED');
    await this.assertSource(context.auth, claimId, tx);
    const submission = await tx.subcontractPhysicalSubmission.findUniqueOrThrow({ where: { claimId } });
    const revision = await tx.subcontractPhysicalRevision.findUniqueOrThrow({ where: { id: submission.revisionId } });
    const claim = await tx.subcontractClaim.findUniqueOrThrow({ where: { id: claimId } });
    if ([claim.createdByUserId, claim.submittedByUserId, submission.actorUserId, revision.actorUserId].includes(auth!.userId)) {
      throw new ForbiddenException({ code: 'PHYSICAL_SELF_APPROVAL_DENIED' });
    }
    const lines = await tx.subcontractClaimLine.findMany({ where: { claimId } });
    const decision = physicalDecision(value, revision.observations as unknown as PhysicalObservation[], new Map(lines.map(row => [row.id, row.amount.toFixed(2)])));
    if (decision.expectedVersion !== controlled.version || decision.sourceDigest !== submission.sourceDigest) conflict('PHYSICAL_SUBMITTED_SOURCE_CONFLICT');
    return decision;
  }

  async recordDecision(context: Context, tx: Tx, claimId: string, assessmentId: string, decision: PreparedDecision) {
    await tx.subcontractPhysicalDecision.create({ data: { claimId, assessmentId, actorUserId: context.auth.userId, reason: decision.reason,
      decisions: decision.decisions as unknown as Prisma.InputJsonValue, assessedAmount: decision.assessedAmount } });
    await this.audit.record({ ...context, entityType: 'SUBCONTRACT_CLAIM', entityId: claimId, action: 'PHYSICAL_DECIDE',
      newValues: { assessmentId, sourceDigest: decision.sourceDigest, assessedAmount: decision.assessedAmount, decisions: decision.decisions } }, tx);
  }

  async eligible(auth: AuthenticatedUserContext, claimId: string, tx: PhysicalDb) {
    if (!await this.controlled(claimId, tx)) return;
    await this.assertSource(auth, claimId, tx);
    const decision = await tx.subcontractPhysicalDecision.findUnique({ where: { claimId } });
    if (!decision || !(decision.decisions as unknown as Array<{ accepted: boolean }>).some(row => row.accepted)) conflict('PHYSICAL_CERTIFICATION_NOT_ELIGIBLE');
  }

  async get(auth: AuthenticatedUserContext, claimId: string) {
    auth = await physicalActor(auth, this.prisma, [PHYSICAL + 'view', 'subcontracts.claim.view']);
    const source = await this.controlled(claimId, this.prisma);
    if (!source) {
      const claim = await this.prisma.subcontractClaim.findFirst({ where: { id: claimId, companyId: auth.companyId }, select: { projectId: true } });
      if (!claim) throw new NotFoundException({ code: 'PHYSICAL_CLAIM_NOT_FOUND' });
      await this.access.assertAccess(auth, claim.projectId);
      return { controlled: false as const };
    }
    const actor = await this.authorize(auth, claimId, this.prisma);
    const claim = await this.prisma.subcontractClaim.findUniqueOrThrow({ where: { id: claimId } });
    const revisions = await this.prisma.subcontractPhysicalRevision.findMany({ where: { claimId }, orderBy: { version: 'desc' } });
    const submission = await this.prisma.subcontractPhysicalSubmission.findUnique({ where: { claimId } });
    const decision = await this.prisma.subcontractPhysicalDecision.findUnique({ where: { claimId } });
    const monetary = actor!.permissions.includes('subcontracts.assessment.view');
    const documents = actor!.permissions.includes('documents.document.view');
    const has = (...codes: string[]) => codes.every(code => actor!.permissions.includes(code));
    const usedUoms = revisions.flatMap(row => (row.observations as unknown as PhysicalObservation[]).flatMap(o => o.uomId ? [o.uomId] : []));
    const uoms = await this.prisma.unitOfMeasure.findMany({ where: { companyId: auth.companyId,
      OR: [{ isActive: true }, { id: { in: usedUoms } }] },
      select: { id: true, uomCode: true, uomName: true, decimalPlaces: true, isActive: true }, orderBy: { uomCode: 'asc' } });
    const frozenUoms = submission ? (submission.commercialSource as unknown as { uoms: typeof uoms }).uoms : [];
    const sameUnit = (a: typeof uoms[number], b: typeof uoms[number]) => a.id === b.id && a.uomCode === b.uomCode &&
      a.uomName === b.uomName && a.decimalPlaces === b.decimalPlaces && a.isActive === b.isActive;
    const unitSourceCurrent = !submission || Boolean(frozenUoms && frozenUoms.every(unit => uoms.some(current => sameUnit(unit, current))));
    const historicalUoms = new Map([...uoms, ...(frozenUoms ?? [])].map(unit => [unit.id, unit]));
    // Choices are scoped physical facts only. SQL rechecks the reservation under
    // the canonical Agreement lock at submission and decision time.
    const held = await this.prisma.$queryRaw<Array<{ claimNumber: string; observation: PhysicalObservation; remaining: string }>>`
      WITH RECURSIVE ancestors(id) AS (
        SELECT replacement_for_claim_id FROM subcontract_claims WHERE id=${claimId}::uuid
        UNION SELECT sc.replacement_for_claim_id FROM subcontract_claims sc JOIN ancestors a ON sc.id=a.id
          WHERE sc.replacement_for_claim_id IS NOT NULL
      ), choices AS (
        SELECT sc.claim_number AS "claimNumber", x AS observation,
          CASE WHEN x->>'basis'='MEASURED' THEN (d->>'heldQuantity')::numeric - coalesce((
            SELECT sum((cx->>'quantity')::numeric) FROM subcontract_physical_submissions cs
            JOIN subcontract_physical_revisions cr ON cr.id=cs.revision_id
            JOIN subcontract_claims cc ON cc.id=cs.claim_id CROSS JOIN LATERAL jsonb_array_elements(cr.observations) cx
            WHERE cc.company_id=${auth.companyId}::uuid AND cc.project_id=${claim.projectId}::uuid
              AND cc.agreement_id=${claim.agreementId}::uuid AND cc.id<>${claimId}::uuid
              AND cc.state IN ('SUBMITTED','ASSESSED') AND cx->>'heldSourceId'=x->>'id'),0)
          ELSE CASE WHEN (d->>'accepted')::boolean THEN 0 ELSE 1 END - (
            SELECT count(*) FROM subcontract_physical_submissions cs
            JOIN subcontract_physical_revisions cr ON cr.id=cs.revision_id
            JOIN subcontract_claims cc ON cc.id=cs.claim_id CROSS JOIN LATERAL jsonb_array_elements(cr.observations) cx
            WHERE cc.company_id=${auth.companyId}::uuid AND cc.project_id=${claim.projectId}::uuid
              AND cc.agreement_id=${claim.agreementId}::uuid AND cc.id<>${claimId}::uuid
              AND cc.state IN ('SUBMITTED','ASSESSED') AND cx->>'heldSourceId'=x->>'id') END AS remaining
        FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
        JOIN subcontract_physical_decisions pd ON pd.claim_id=s.claim_id JOIN subcontract_claims sc ON sc.id=s.claim_id
        CROSS JOIN LATERAL jsonb_array_elements(r.observations) x CROSS JOIN LATERAL jsonb_array_elements(pd.decisions) d
        WHERE sc.company_id=${auth.companyId}::uuid AND sc.project_id=${claim.projectId}::uuid
          AND sc.agreement_id=${claim.agreementId}::uuid AND sc.id<>${claimId}::uuid
          AND (sc.state='ASSESSED' OR sc.id IN (SELECT id FROM ancestors)) AND d->>'observationId'=x->>'id'
      ) SELECT "claimNumber", observation, remaining::text FROM choices WHERE remaining>0 ORDER BY "claimNumber", observation->>'item'`;
    const heldIds = [...new Set(revisions.flatMap(row => (row.observations as unknown as PhysicalObservation[])
      .flatMap(o => o.heldSourceId ? [o.heldSourceId] : [])))];
    const heldOrigins = heldIds.length ? await this.prisma.$queryRaw<Array<{ id: string; claimNumber: string; item: string; location: string }>>`
      SELECT x->>'id' AS id, sc.claim_number AS "claimNumber", x->>'item' AS item, x->>'location' AS location
      FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
      JOIN subcontract_claims sc ON sc.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
      WHERE sc.company_id=${auth.companyId}::uuid AND sc.project_id=${claim.projectId}::uuid
        AND sc.agreement_id=${claim.agreementId}::uuid AND x->>'id'=ANY(${heldIds}::text[])` : [];
    const actorIds = [...new Set([...revisions.map(row => row.actorUserId), submission?.actorUserId, decision?.actorUserId].filter((id): id is string => Boolean(id)))];
    const names = new Map((await this.prisma.user.findMany({ where: { companyId: auth.companyId, id: { in: actorIds } },
      select: { id: true, displayName: true } })).map(row => [row.id, row.displayName]));
    return { controlled: true as const, claimId, version: source.version, uoms: [...historicalUoms.values()], unitSourceCurrent, heldOrigins,
      canCapture: claim.state === 'DRAFT' && has(PHYSICAL + 'edit', 'subcontracts.claim.edit', 'documents.document.view'),
      canSubmit: claim.state === 'DRAFT' && has(PHYSICAL + 'edit', 'subcontracts.claim.submit', 'documents.document.view'),
      canDecide: unitSourceCurrent && claim.state === 'SUBMITTED' && has(PHYSICAL + 'decide', 'subcontracts.assessment.assess', 'documents.document.view') &&
        ![claim.createdByUserId, claim.submittedByUserId, submission?.actorUserId, revisions[0]?.actorUserId].includes(auth.userId),
      heldSources: held.map(({ claimNumber, observation: o, remaining }) => ({ id: o.id, claimNumber, item: o.item,
        location: o.location, basis: o.basis, basisDescription: o.basisDescription, uomId: o.uomId,
        remainingQuantity: o.basis === 'MEASURED' ? new Prisma.Decimal(remaining).toFixed(4) : null })),
      revisions: revisions.map(row => ({ ...row, actorName: names.get(row.actorUserId),
        observations: (row.observations as unknown as PhysicalObservation[]).map(o => ({ ...o, documentIds: documents ? o.documentIds : [] })) })),
      submission: submission && { revisionId: submission.revisionId, sourceDigest: submission.sourceDigest, actorUserId: submission.actorUserId,
        actorName: names.get(submission.actorUserId), evidence: documents ? submission.evidence : [], createdAt: submission.createdAt },
      decision: decision && { actorUserId: decision.actorUserId, actorName: names.get(decision.actorUserId), reason: decision.reason, createdAt: decision.createdAt,
        ...(monetary ? { assessedAmount: decision.assessedAmount } : {}),
        decisions: (decision.decisions as unknown as Array<Record<string, unknown>>).map(row => {
          if (monetary) return row; const { acceptedAmount, ...physical } = row; return physical;
        }) } };
  }
}
