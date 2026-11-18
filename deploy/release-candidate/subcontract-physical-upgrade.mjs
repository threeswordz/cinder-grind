import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { physicalTables } from './subcontract-physical-schema-contract.mjs';
const require = createRequire(resolve('apps/api/package.json'));

export async function physicalRecovery(mode, manifest, databaseUrl, storage) {
  const url = new URL(databaseUrl);
  assert.equal(process.platform, 'linux'); assert.equal(process.versions.node, '24.21.0');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.match(url.pathname, /^\/(?:erp_physical_validation_[0-9]{2}|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
  assert.ok(['protect', 'restored'].includes(mode)); assert.ok(storage && manifest);
  process.env.DATABASE_URL = url.href; process.env.STORAGE_ROOT = storage; require('reflect-metadata');
  const { PrismaService } = require('./dist/prisma/prisma.service.js'), { NestFactory } = require('@nestjs/core'), { AppModule } = require('./dist/app.module.js');
  const { ProblemDetailsFilter } = require('./dist/common/problem-details.filter.js');
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ProblemDetailsFilter()); await app.listen(0, '127.0.0.1');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex'), base = await app.getUrl() + '/api/v1';
  async function snapshot(company) {
    const result = {};
    for (const table of [...physicalTables, 'subcontract_claims', 'subcontract_claim_lines', 'subcontract_claim_assessments', 'subcontract_certifications',
      'subcontract_action_replays', 'subcontract_agreements', 'documents', 'document_links', 'users', 'employees', 'project_members', 'role_permissions', 'stock_transactions', 'payments']) {
      const where = ['subcontract_physical_revisions', 'subcontract_physical_submissions', 'subcontract_physical_decisions'].includes(table)
        ? 'claim_id IN (SELECT id FROM subcontract_claims WHERE company_id=$1::uuid)'
        : table === 'document_links' ? 'document_id IN (SELECT id FROM documents WHERE company_id=$1::uuid)'
        : table === 'project_members' ? 'project_id IN (SELECT id FROM projects WHERE company_id=$1::uuid)'
        : table === 'role_permissions' ? 'role_id IN (SELECT id FROM roles WHERE company_id=$1::uuid)' : 'company_id=$1::uuid';
      const [row] = await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${where}`, company);
      result[table] = row;
    }
    return result;
  }
  async function get(cookie, path, status = 200) {
    const response = await fetch(base + path, { headers: cookie ? { Cookie: cookie } : {} });
    assert.equal(response.status, status, path);
    if (status !== 200) { await response.body?.cancel(); return null; }
    return (await response.json()).data;
  }
  try {
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, url.pathname.slice(1));
    if (mode === 'protect') {
      const { f, sessions, claim, document, certification } = await require('./dist/subcontracts/subcontract-physical-proof-fixture.js').subcontractPhysicalProofFixture(db, app, true);
      const path = '/subcontracts/physical/claims/' + claim.id, expected = await get(sessions.ben.cookie, path);
      assert.equal(expected.decision.assessedAmount, '731.25'); assert.equal(expected.decision.decisions[0].acceptedQuantity, '8.0000'); assert.equal(expected.decision.decisions[0].heldQuantity, '2.0000');
      const financial = await db.subcontractCertification.findUniqueOrThrow({ where: { id: certification.id } });
      assert.equal(financial.state, 'APPROVED'); assert.equal(financial.retainedAmount.toFixed(2), '36.56');
      const state = { company: f.company.id, project: f.project.id, claim: claim.id, path, expected, snapshot: await snapshot(f.company.id),
        document: { id: document.id, size: document.bytes.length, checksum: hash(document.bytes) }, sessions,
        users: [f.maker, f.ben, f.porn, f.nancy, f.outsider, f.technical].map(actor => actor.user.id) };
      await writeFile(manifest, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
      console.log('PHYSICAL_ACCEPTED_EIGHT_HELD_TWO_EXPLICIT_AMOUNT_CERTIFICATION_EVIDENCE_PROTECTED');
    } else {
      const state = JSON.parse(await readFile(manifest, 'utf8'));
      assert.deepEqual(await snapshot(state.company), state.snapshot);
      assert.deepEqual(await get(state.sessions.ben.cookie, state.path), state.expected);
      await get(state.sessions.outsider.cookie, state.path, 403); await get(state.sessions.technical.cookie, state.path, 403); await get(null, state.path, 401);
      const masked = await get(state.sessions.maker.cookie, state.path);
      assert.equal(masked.decision.assessedAmount, undefined); assert.ok(masked.decision.decisions.every(d => d.acceptedAmount === undefined));
      for (const suffix of ['/' + state.document.id + '/download', '/targets/SUBCONTRACT_CLAIM/' + state.claim + '/' + state.document.id + '/download']) {
        const path = '/documents/projects/' + state.project + suffix;
        const response = await fetch(base + path, { headers: { Cookie: state.sessions.ben.cookie } }); assert.equal(response.status, 200);
        const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(bytes), state.document.checksum); assert.equal(bytes.length, state.document.size);
        await get(state.sessions.outsider.cookie, path, 403);
      }
      assert.deepEqual(await snapshot(state.company), state.snapshot);
      await db.userSession.updateMany({ where: { userId: { in: state.users }, revokedAt: null }, data: { revokedAt: new Date() } });
      await get(state.sessions.ben.cookie, state.path, 401);
      console.log('PHYSICAL_RESTORED_ACCEPTED_HELD_CERTIFICATION_RETENTION_BYTES_SCOPE_AND_REVOKED_SESSION_PASS');
    }
  } finally { await app.close(); await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, manifest] = process.argv.slice(2), storage = process.env.SUBCONTRACT_PHYSICAL_RECOVERY_STORAGE_ROOT, url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED, 'YES'); assert.equal(process.env.SUBCONTRACT_PHYSICAL_SCHEMA_UPGRADE, 'YES');
  assert.match(url.pathname, /^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);
  assert.match(storage ?? '', /^\/tmp\/construction-erp-v10e-migration\.[^/]+\/physical-(?:source|restored)$/);
  assert.match(manifest ?? '', /^\/tmp\/construction-erp-v10e-migration\.[^/]+\/physical-protected\.json$/);
  try { await physicalRecovery(mode, manifest, url.href, storage); }
  catch { console.error('PHYSICAL_POPULATED_RECOVERY_FAILED'); process.exitCode = 1; }
}
