import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { subcontractPhysicalFixture } from './subcontract-physical-test-fixture';

// Disposable CI/recovery fixture. Real login, CSRF, multipart storage and owning endpoints.
export async function subcontractPhysicalProofFixture(db: PrismaService, app: INestApplication, populate = true) {
  const f = await subcontractPhysicalFixture(db), base = await app.getUrl() + '/api/v1';
  const sessions: Record<string, { cookie: string; csrf: string }> = {};
  for (const [name, actor] of Object.entries({ maker: f.maker, ben: f.ben, porn: f.porn, nancy: f.nancy, outsider: f.outsider, technical: f.technical })) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actor.user.email, password: actor.password }) });
    assert.equal(response.status, 201); const body: any = await response.json(), cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
    sessions[name] = { cookie, csrf: body.data.csrfToken };
  }
  async function call(actor: string, path: string, body?: unknown) {
    const session = sessions[actor]!;
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: session.cookie, 'x-csrf-token': session.csrf,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, body === undefined ? 200 : 201, path); return (await response.json() as any).data;
  }
  await call('ben', '/subcontracts/physical/projects/' + f.project.id + '/enable', { requestKey: randomUUID(), reason: 'Explicit isolated technical proof opt-in' });
  const claim = await call('maker', '/subcontracts/agreements/' + f.agreement.id + '/claims', { periodStart: '2026-02-01', periodEnd: '2026-02-20' });
  const line = await call('maker', '/subcontracts/claims/' + claim.id + '/lines', { amount: '1000.00' });
  if (!populate) return { f, sessions, claim, line, document: null, certification: null };
  const bytes = Buffer.from('%PDF-1.4 Synthetic physical acceptance proof; no real signature'), data = new FormData();
  data.set('documentTypeId', f.documentType.id); data.set('file', new Blob([bytes], { type: 'application/pdf' }), 'work-proof.pdf');
  const upload = await fetch(base + '/documents/projects/' + f.project.id + '/targets/SUBCONTRACT_CLAIM/' + claim.id,
    { method: 'POST', headers: { Cookie: sessions.maker!.cookie, 'x-csrf-token': sessions.maker!.csrf }, body: data });
  assert.equal(upload.status, 201); const document: any = (await upload.json() as any).data, id = randomUUID();
  await call('maker', '/subcontracts/physical/claims/' + claim.id + '/capture', { requestKey: randomUUID(), expectedVersion: 1,
    reason: 'Measured source with protected evidence', observations: [{ id, claimLineId: line.id, basis: 'MEASURED', item: 'Installed work', location: 'Area A',
      quantity: '10', uomId: f.uom.id, progressPercent: '80', reason: 'Ten measured units', documentIds: [document.id] }] });
  await call('maker', '/subcontracts/claims/' + claim.id + '/submit', { actionKey: randomUUID(), expectedPhysicalVersion: 2 });
  const source = await call('ben', '/subcontracts/physical/claims/' + claim.id);
  await call('ben', '/subcontracts/physical/claims/' + claim.id + '/decide', { requestKey: randomUUID(), expectedVersion: 2, sourceDigest: source.submission.sourceDigest,
    reason: 'Eight accepted; two held', decisions: [{ observationId: id, acceptedQuantity: '8', acceptedAmount: '731.25', heldDisposition: 'REWORK', reason: 'Two require rework; explicit accepted value' }] });
  const certification = await call('porn', '/subcontracts/claims/' + claim.id + '/certifications', { certifiedGross: '731.25' });
  await call('porn', '/subcontracts/certifications/' + certification.id + '/submit', { actionKey: randomUUID(), workflowCode: f.workflow.workflowCode });
  await call('nancy', '/subcontracts/certifications/' + certification.id + '/approve', { actionKey: randomUUID(), comment: 'Independent canonical financial approval' });
  return { f, sessions, claim, line, document: { id: document.id, bytes }, certification };
}
