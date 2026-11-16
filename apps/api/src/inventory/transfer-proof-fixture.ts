import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { TransferCustodyService } from './transfer-custody.service';
import { StockTransferService } from './stock-transfer.service';
import { transferCustodyFixture } from './transfer-custody-test-fixture';
import { Prisma } from '@prisma/client';

export async function transferProofFixture(db: PrismaService, app: INestApplication, populate = true) {
  const f = await transferCustodyFixture(db, app);
  for (const actor of [f.store, f.pm, f.jai, f.viewer]) actor.auth = (await f.sessions.resolve(actor.session.sessionToken))!;
  const custody = app.get(TransferCustodyService), transfers = app.get(StockTransferService);
  await custody.enable({ auth: f.pm.auth }, f.project.id, { requestKey: randomUUID(), reason: 'Explicit disposable DEC-046 policy' });
  const transfer = await transfers.create({ auth: f.store.auth }, { ...f.transferInput, transferDate: new Date(f.transferInput.transferDate), lines: f.transferInput.lines.map(i => ({ ...i, quantity: new Prisma.Decimal(i.quantity) })) });
  await transfers.submit({ auth: f.store.auth }, transfer.id, f.workflow.workflowCode);
  await transfers.approve({ auth: f.pm.auth }, transfer.id, randomUUID(), 'Independent Khaimook approval');
  await db.projectMember.deleteMany({ where: { projectId: f.unassigned.id, employeeId: f.store.employee.id } });
  if (!populate) return { f, id: transfer.id, document: null };
  let current = await custody.get(f.jai.auth, transfer.id, f.unassigned.id);
  await custody.dispatch({ auth: f.store.auth }, transfer.id, { requestKey: randomUUID(), expectedVersion: current.version, reason: 'Actual synthetic dispatch' });
  current = await custody.get(f.jai.auth, transfer.id, f.unassigned.id);
  const prepared: any = await custody.prepareReceipt({ auth: f.jai.auth }, transfer.id, f.unassigned.id, { requestKey: randomUUID(), expectedVersion: current.version, reason: 'Partial destination delivery' });
  const bytes = Buffer.from('%PDF-1.4 Synthetic transfer delivery evidence; no real signature');
  const document = await app.get(DocumentsService).uploadProjectDocument({ auth: f.jai.auth }, f.unassigned.id, f.documentType.id, { originalname: 'transfer-proof.pdf', mimetype: 'application/pdf', size: bytes.length, buffer: bytes }, { entityType: 'TRANSFER_RECEIPT', entityId: prepared.receiptId });
  current = await custody.get(f.jai.auth, transfer.id, f.unassigned.id);
  await custody.receive({ auth: f.jai.auth }, transfer.id, f.unassigned.id, prepared.receiptId, { requestKey: randomUUID(), expectedVersion: current.version, reason: 'Four accepted; one remains outstanding', documentId: document.id, lines: [{ transferItemId: transfer.items[0]!.id, quantity: '4.0000', note: 'Actual accepted quantity' }] });
  return { f, id: transfer.id, document: { id: document.id, receiptId: prepared.receiptId, bytes } };
}
