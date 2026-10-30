import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SiteExecutionService } from '../site-execution/site-execution.service';
import { DocumentPolicyService } from './document-policy.service';
import { DocumentStorage } from './document-storage';
import { DocumentsService } from './documents.service';
import { DocumentTargetsService } from './document-targets.service';

const companyId = 'company';
const projectId = 'project';
type Link = { entityType: string; entityId: string };
function row(id: string, links: Link[]) {
  return {
    id, companyId, documentTypeId: 'type', fileName: id + '.pdf',
    storageProvider: 'LOCAL', storageKey: id, mimeType: 'application/pdf',
    fileSizeBytes: 4, checksum: null, uploadedAt: new Date(), isActive: true,
    documentType: { id: 'type', documentTypeCode: 'PDF', documentTypeName: 'PDF' },
    uploadedBy: { id: 'uploader', displayName: 'Uploader' }, links,
  };
}
const projectLink = { entityType: 'PROJECT', entityId: projectId };
function fixture() {
  const rows = [
    row('ordinary', [projectLink]),
    row('invoice', [projectLink, { entityType: 'SUPPLIER_INVOICE', entityId: 'invoice-source' }]),
    row('certification', [projectLink, { entityType: 'SUBCONTRACT_CERTIFICATION', entityId: 'cert-source' }]),
    row('combined', [projectLink, { entityType: 'SUPPLIER_INVOICE', entityId: 'invoice-source' },
      { entityType: 'SUBCONTRACT_CERTIFICATION', entityId: 'cert-source' },
      { entityType: 'WBS', entityId: 'wbs' }, { entityType: 'DAILY_SITE_REPORT', entityId: 'site' }]),
    row('other-project-source', [projectLink, { entityType: 'PROJECT', entityId: 'other-project' },
      { entityType: 'SUPPLIER_INVOICE', entityId: 'other-invoice' }]),
    row('transfer', [projectLink, { entityType: 'STOCK_TRANSFER', entityId: 'transfer-source' }]),
    row('hr-private', [projectLink, { entityType: 'HR_PRIVATE_EMPLOYEE', entityId: 'hr-employee' }]),
    row('hr-mixed-alias', [projectLink, { entityType: 'WBS', entityId: 'wbs' },
      { entityType: 'HR_PRIVATE_EMPLOYEE', entityId: 'hr-employee' }]),
    row('hr-forged-case', [projectLink, { entityType: 'hr_private_employee', entityId: 'hr-employee' }]),
  ];
  const effects = { reads: [] as string[], writes: 0, audits: 0 };
  const document = {
    findMany: async ({ where }: { where: { links: { some: Link } } }) =>
      rows.filter((r) => r.links.some((l) => l.entityType === where.links.some.entityType && l.entityId === where.links.some.entityId)),
    findFirst: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: { isActive: boolean } }) => {
      effects.writes++;
      return Object.assign(rows.find((r) => r.id === where.id)!, data);
    },
  };
  const db = {
    document,
    project: { findMany: async ({ where }: { where: { AND: Array<{ id: { in: string[] } }> } }) =>
      where.AND[0]!.id.in.filter((id) => where.AND[1]!.id.in.includes(id)).map((id) => ({ id })) },
    stockTransfer: { findMany: async () => [{ id: 'transfer-source', items: [
      { sourceProjectId: projectId, destinationProjectId: 'other-project' },
    ] }] },
    wbsElement: { findFirst: async () => ({ id: 'wbs' }) },
    dailySiteReport: { findFirst: async () => ({ id: 'site', projectId, status: 'DRAFT' }) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  const access = {
    assertAccess: async () => {},
    scopeWhere: async (auth: AuthenticatedUserContext) => ({
      id: { in: auth.permissions.includes('projects.access_all') ? [projectId, 'other-project'] : [projectId] },
    }),
  } as unknown as ProjectAccessService;
  const audit = { record: async () => { effects.audits++; } } as unknown as AuditService;
  const storage = { read: async (key: string) => { effects.reads.push(key); return Buffer.from('safe'); } } as unknown as DocumentStorage;
  const service = new DocumentsService(db as unknown as PrismaService, access, audit, storage, new DocumentPolicyService());
  const targets = new DocumentTargetsService(db as unknown as PrismaService, access, audit, service);
  const site = new SiteExecutionService(db as unknown as PrismaService, access, audit, service);
  return { service, targets, site, rows, effects };
}
function actor(extra: string[] = []): AuthenticatedUserContext {
  return {
    sessionId: 'session', userId: 'reader', companyId, email: 'reader@example.test',
    displayName: 'Reader', roleCodes: ['TEST'], csrfTokenHash: '0'.repeat(64),
    permissions: ['documents.document.view', 'documents.document.archive', ...extra],
  };
}
const notFound = (error: unknown) => error instanceof NotFoundException &&
  (error.getResponse() as { code: string }).code === 'DOCUMENT_NOT_FOUND';

test('generic document listing and download cannot bypass Finance or Subcontract source permissions', async () => {
  const { service, effects } = fixture();
  const reader = actor();
  assert.deepEqual((await service.listProjectDocuments(reader, projectId)).map((r) => r.id), ['ordinary']);
  for (const id of ['invoice', 'certification', 'combined']) {
    await assert.rejects(() => service.downloadProjectDocument(reader, projectId, id), notFound);
  }
  assert.deepEqual(effects.reads, []);
  assert.equal((await service.downloadProjectDocument(reader, projectId, 'ordinary')).bytes.toString(), 'safe');
});

test('generic document archive and reactivate deny the source bypass without writes or audit events', async () => {
  const { service, effects, rows } = fixture();
  for (const id of ['invoice', 'certification']) {
    for (const active of [false, true]) {
      await assert.rejects(() => service.setProjectDocumentActive({ auth: actor() }, projectId, id, active), notFound);
    }
  }
  assert.equal(effects.writes, 0);
  assert.equal(effects.audits, 0);
  assert.ok(rows.every((r) => r.isActive));
});

test('document access requires every linked protected source and cannot use a WBS alias', async () => {
  const { service, targets, effects } = fixture();
  const invoiceReader = actor(['finance.supplier_invoice.view']);
  assert.deepEqual((await service.listProjectDocuments(invoiceReader, projectId)).map((r) => r.id), ['ordinary', 'invoice']);
  assert.deepEqual(await targets.list(invoiceReader, projectId, 'WBS', 'wbs'), []);
  await assert.rejects(() => service.downloadProjectDocument(invoiceReader, projectId, 'combined'), notFound);
  assert.equal((await service.downloadProjectDocument(invoiceReader, projectId, 'invoice')).bytes.toString(), 'safe');
  await service.setProjectDocumentActive({ auth: invoiceReader }, projectId, 'invoice', false);
  await service.setProjectDocumentActive({ auth: invoiceReader }, projectId, 'invoice', true);
  assert.equal(effects.writes, 2);
  assert.equal(effects.audits, 2);
  const both = actor(['finance.supplier_invoice.view', 'subcontracts.certification.view']);
  assert.equal((await service.downloadProjectDocument(both, projectId, 'combined')).bytes.toString(), 'safe');
});

test('generic document access retains all linked Project and Stock Transfer scope checks', async () => {
  const { service } = fixture();
  const scoped = actor(['finance.supplier_invoice.view', 'inventory.transfer.view']);
  for (const id of ['other-project-source', 'transfer']) {
    await assert.rejects(() => service.downloadProjectDocument(scoped, projectId, id), notFound);
    await assert.rejects(() => service.setProjectDocumentActive({ auth: scoped }, projectId, id, false), notFound);
  }
  const authorized = actor(['projects.access_all', 'finance.supplier_invoice.view', 'inventory.transfer.view']);
  for (const id of ['other-project-source', 'transfer']) {
    assert.equal((await service.downloadProjectDocument(authorized, projectId, id)).bytes.toString(), 'safe');
  }
});

test('Site document metadata cannot reveal a protected source through a second attachment alias', async () => {
  const { site } = fixture();
  assert.deepEqual(await site.listDocuments(actor(['finance.supplier_invoice.view']), 'site'), []);
  const visible = await site.listDocuments(actor(['finance.supplier_invoice.view', 'subcontracts.certification.view']), 'site');
  assert.equal(visible[0]?.id, 'combined');
  assert.equal('links' in visible[0]!, false);
});

test('a failed source association rolls back the upload instead of publishing a Project-only document', async () => {
  const records: unknown[] = [];
  const links: unknown[] = [];
  let removed = 0;
  const db = {
    documentType: { findFirst: async () => ({ id: 'type' }) },
    document: { create: async () => { const created = row('new', []); records.push(created); return created; } },
    documentLink: { create: async ({ data }: { data: Link }) => {
      if (data.entityType === 'SUPPLIER_INVOICE') throw new Error('source link rejected');
      const created = { id: 'project-link', ...data }; links.push(created); return created;
    } },
    supplierInvoice: { findFirst: async () => ({ id: 'invoice-source' }) },
    $transaction: async (fn: (tx: unknown) => unknown) => {
      const recordCount = records.length;
      const linkCount = links.length;
      try { return await fn(db); } catch (error) {
        records.length = recordCount; links.length = linkCount; throw error;
      }
    },
  };
  const access = { assertAccess: async () => {} } as unknown as ProjectAccessService;
  const audit = { record: async () => {} } as unknown as AuditService;
  const storage = {
    put: async () => ({ storageProvider: 'LOCAL', storageKey: 'new' }),
    remove: async () => { removed++; },
  } as unknown as DocumentStorage;
  const documents = new DocumentsService(db as unknown as PrismaService, access, audit, storage, new DocumentPolicyService());
  const targets = new DocumentTargetsService(db as unknown as PrismaService, access, audit, documents);
  await assert.rejects(() => targets.upload(
    { auth: actor(['finance.supplier_invoice.view']) }, projectId, 'SUPPLIER_INVOICE', 'invoice-source', 'type',
    { originalname: 'invoice.pdf', mimetype: 'application/pdf', size: 4, buffer: Buffer.from('test') },
  ), /source link rejected/);
  assert.equal(records.length, 0);
  assert.equal(links.length, 0);
  assert.equal(removed, 1);
});

test('BOQ source documents require every cost/commercial read capability across generic metadata, bytes, archive and WBS aliases',async()=>{
  const {service,targets,rows,effects}=fixture();
  rows.push(row('cost-boq',[projectLink,{entityType:'BOQ',entityId:'boq'}]),
    row('cost-revision',[projectLink,{entityType:'BUDGET_REVISION',entityId:'revision'}]),
    row('customer-boq',[projectLink,{entityType:'CUSTOMER_BOQ',entityId:'customer'},{entityType:'WBS',entityId:'wbs'}]),
    row('mixed-boq',[projectLink,{entityType:'BOQ',entityId:'boq'},{entityType:'CUSTOMER_BOQ',entityId:'customer'}]));
  const quantity=actor(['budget.quantity.view']);
  assert.deepEqual(await service.listProjectDocuments(quantity,projectId),[],'unclassified old bytes are not presumed quantity safe');
  for(const permissions of [['budget.quantity.view'],['budget.boq.view'],['budget.revision.view'],['budget.customer.view'],['budget.boq.view','budget.revision.view']]){
    const reader=actor(permissions);
    for(const id of ['customer-boq','mixed-boq']){
      await assert.rejects(()=>service.downloadProjectDocument(reader,projectId,id),notFound);
      await assert.rejects(()=>service.setProjectDocumentActive({auth:reader},projectId,id,false),notFound);
    }
    assert.deepEqual(await targets.list(reader,projectId,'WBS','wbs'),[]);
  }
  assert.deepEqual(effects.reads,[]);assert.equal(effects.writes,0);
  const cost=actor(['budget.boq.view']);
  assert.equal((await service.downloadProjectDocument(cost,projectId,'cost-boq')).bytes.toString(),'safe');
  await assert.rejects(()=>service.downloadProjectDocument(cost,projectId,'cost-revision'),notFound);
  const commercial=actor(['budget.boq.view','budget.revision.view','budget.customer.view']);
  assert.equal((await service.downloadProjectDocument(commercial,projectId,'customer-boq')).bytes.toString(),'safe');
  assert.deepEqual((await targets.list(commercial,projectId,'WBS','wbs')).map(r=>r.id),['customer-boq']);
  const finance=actor(['budget.quantity.view','finance.supplier_invoice.view']);
  assert.equal((await service.downloadProjectDocument(finance,projectId,'invoice')).bytes.toString(),'safe','explicit Finance source authority remains separate');
});

test('summary authority never opens unclassified Project bytes while separately authorized Finance sources remain available',async()=>{
  const {service,effects}=fixture();
  const summary=actor(['budget.project_summary.view']);
  assert.deepEqual(await service.listProjectDocuments(summary,projectId),[]);
  await assert.rejects(()=>service.downloadProjectDocument(summary,projectId,'ordinary'),notFound);
  await assert.rejects(()=>service.setProjectDocumentActive({auth:summary},projectId,'ordinary',false),notFound);
  assert.equal(effects.reads.length,0);assert.equal(effects.writes,0);
  const finance=actor(['budget.project_summary.view','finance.supplier_invoice.view']);
  assert.equal((await service.downloadProjectDocument(finance,projectId,'invoice')).bytes.toString(),'safe');
});

test('HR-private mixed aliases deny generic document list, direct download, metadata and archive for all Project roles',async()=>{
  const {service,targets,effects,rows}=fixture();
  const full=actor(['projects.access_all','budget.boq.view','budget.revision.view',
    'finance.supplier_invoice.view','subcontracts.certification.view','hr.identity.view','hr.documents.view',
    'documents.document.view','documents.document.archive']);
  const hidden=['hr-private','hr-mixed-alias','hr-forged-case'];
  const listed=await service.listProjectDocuments(full,projectId);
  for(const id of hidden){
    assert.equal(listed.some(x=>x.id===id),false,'HR-private metadata leaked: '+id);
    await assert.rejects(()=>service.downloadProjectDocument(full,projectId,id),notFound);
    for(const active of [false,true])
      await assert.rejects(()=>service.setProjectDocumentActive({auth:full},projectId,id,active),notFound);
  }
  const alias=await targets.list(full,projectId,'WBS','wbs');
  assert.equal(alias.some(x=>hidden.includes(x.id)),false);
  assert.ok(rows.filter(x=>hidden.includes(x.id)).every(x=>x.isActive));
  assert.equal(effects.reads.some(x=>hidden.includes(x)),false);
  assert.equal(effects.writes,0);
  assert.equal(effects.audits,0);
});
