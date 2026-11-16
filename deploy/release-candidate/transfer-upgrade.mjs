// Registered disposable populated restore proof; never a Mac or retained-data operator.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transferTables } from './transfer-schema-contract.mjs';
const require = createRequire(resolve('apps/api/package.json'));
export async function transferRecovery(mode, manifest, databaseUrl, storage) {
  const url = new URL(databaseUrl);
  assert.equal(process.platform, 'linux');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  assert.match(url.pathname, /^\/(?:construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
  assert.ok(['protect','restored'].includes(mode)); assert.ok(storage && manifest);
  process.env.DATABASE_URL = url.href; process.env.STORAGE_ROOT = storage; require('reflect-metadata');
  const { PrismaService } = require('./dist/prisma/prisma.service.js'), { NestFactory } = require('@nestjs/core'), { AppModule } = require('./dist/app.module.js');
  const { ProblemDetailsFilter } = require('./dist/common/problem-details.filter.js');
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false }); app.setGlobalPrefix('api/v1'); app.useGlobalFilters(new ProblemDetailsFilter()); await app.listen(0, '127.0.0.1');
  const hash = b => createHash('sha256').update(b).digest('hex'), base = await app.getUrl() + '/api/v1';
  async function snapshot(company) {
    const result = {};
    for (const table of [...transferTables, 'stock_transfers', 'stock_transfer_items', 'stock_transactions', 'documents', 'document_links']) {
      const where = ['transfer_project_policies','transfer_custodies','transfer_operations','stock_transfers','stock_transactions','documents'].includes(table) ? 'company_id=$1::uuid'
        : table === 'document_links' ? 'document_id IN (SELECT id FROM documents WHERE company_id=$1::uuid)'
        : table === 'stock_transfer_items' ? 'stock_transfer_id IN (SELECT id FROM transfer_custodies WHERE company_id=$1::uuid)'
        : table === 'transfer_receipt_lines' ? 'receipt_id IN (SELECT id FROM transfer_receipts WHERE transfer_id IN (SELECT transfer_id FROM transfer_custodies WHERE company_id=$1::uuid))'
        : 'transfer_id IN (SELECT transfer_id FROM transfer_custodies WHERE company_id=$1::uuid)';
      const [row] = await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${where}`, company);
      result[table] = row;
    }
    return result;
  }
  async function call(token, path, status = 200) {
    const response = await fetch(base + path, { headers: token ? { Cookie: 'erp_session=' + token } : {} });
    assert.equal(response.status, status, path);
    return status === 200 ? (await response.json()).data : null;
  }
  try {
    assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name, url.pathname.slice(1));
    if (mode === 'protect') {
      const { f, id, document } = await require('./dist/inventory/transfer-proof-fixture.js').transferProofFixture(db, app, true);
      const path = '/inventory/transfer-custody/projects/' + f.unassigned.id + '/transfers/' + id;
      const expected = await call(f.jai.session.sessionToken, path);
      assert.equal(expected.lines[0].accepted, '4.0000'); assert.equal(expected.lines[0].outstanding, '1.0000');
      const receipt = expected.receipts.find(r => r.postedAt); assert.ok(receipt);
      const evidencePath = '/documents/projects/' + f.unassigned.id + '/targets/TRANSFER_RECEIPT/' + receipt.id + '/' + document.id + '/download';
      const response = await fetch(base + evidencePath, { headers: { Cookie: 'erp_session=' + f.jai.session.sessionToken } }); assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const state = { company: f.company.id, id, path, expected, snapshot: await snapshot(f.company.id), evidencePath, evidenceHash: hash(bytes), evidenceSize: bytes.length,
        receiver: f.jai.session.sessionToken, denied: f.config.session.sessionToken, users: [f.store,f.jai,f.pm,f.config,f.outsider,f.viewer,f.buyer,f.buyerChecker].map(a => a.user.id) };
      await writeFile(manifest, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
      console.log('TRANSFER_DISPATCH_PARTIAL_RECEIPT_OUTSTANDING_EVIDENCE_PROTECTED');
    } else {
      const state = JSON.parse(await readFile(manifest, 'utf8'));
      assert.deepEqual(await snapshot(state.company), state.snapshot);
      assert.deepEqual(await call(state.receiver, state.path), state.expected);
      await call(state.denied, state.path, 403); await call(null, state.path, 401);
      const response = await fetch(base + state.evidencePath, { headers: { Cookie: 'erp_session=' + state.receiver } }); assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(hash(bytes), state.evidenceHash); assert.equal(bytes.length, state.evidenceSize);
      await call(state.denied, state.evidencePath, 403);
      assert.deepEqual(await snapshot(state.company), state.snapshot);
      await db.userSession.updateMany({ where: { userId: { in: state.users }, revokedAt: null }, data: { revokedAt: new Date() } });
      console.log('TRANSFER_RESTORED_PARTIAL_RECEIPT_STOCK_OUTSTANDING_EVIDENCE_ACCESS_PASS');
    }
  } finally { await app.close(); await db.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, manifest] = process.argv.slice(2), storage = process.env.TRANSFER_RECOVERY_STORAGE_ROOT, url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.GITHUB_ACTIONS, 'true'); assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED, 'YES'); assert.equal(process.env.TRANSFER_SCHEMA_UPGRADE, 'YES');
  assert.match(url.pathname, /^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);
  assert.match(storage ?? '', /^\/tmp\/construction-erp-v10e-migration\.[^/]+\/transfer-(?:source|restored)$/);
  assert.match(manifest ?? '', /^\/tmp\/construction-erp-v10e-migration\.[^/]+\/transfer-protected\.json$/);
  try { await transferRecovery(mode, manifest, url.href, storage); } catch { console.error('TRANSFER_POPULATED_RECOVERY_FAILED'); process.exitCode = 1; }
}
