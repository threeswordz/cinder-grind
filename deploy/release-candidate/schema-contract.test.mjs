import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySchema, provenanceFields } from './schema-contract.mjs';

const previous = `model Company {
  baseCurrencyCode String @default("SGD") @map("base_currency_code") @db.VarChar(3)
}
${Object.keys(provenanceFields).map((name) => `model ${name} {\n id String @id\n}`).join('\n')}`;
const candidate = Object.entries(provenanceFields).reduce((schema, [model, [name, column]]) =>
  schema.replace(`model ${model} {`, `model ${model} {\n ${name} String? @map("${column}") @db.VarChar(3)`), previous);

test('unchanged schema retains SQL-only mode; bounded nullable provenance selects schema mode', () => {
  assert.equal(classifySchema(previous, previous), 'migration-aware-sql-only');
  assert.equal(classifySchema(previous, candidate), 'migration-aware-thb-schema');
  assert.equal(classifySchema(previous, candidate.replace('@default("SGD")', '@default("THB")')), 'migration-aware-thb-schema');
  assert.equal(classifySchema(candidate, candidate.replace('@default("SGD")', '@default("THB")')), 'migration-aware-thb-schema');
  assert.throws(() => classifySchema(candidate.replace('@default("SGD")', '@default("THB")'), candidate));
});

test('schema classification rejects unrelated/removal/required/defaulted/partial provenance changes', () => {
  for (const invalid of [
    candidate.replace('id String @id', 'id Int @id'),
    candidate.replace('id String @id', ''),
    candidate.replace('contractCurrencyCode String?', 'contractCurrencyCode String'),
    candidate.replace('contractCurrencyCode String?', 'contractCurrencyCode String? @default("THB")'),
    candidate.replace('contractCurrencyCode String? @map("contract_currency_code") @db.VarChar(3)', ''),
    candidate.replace('@default("SGD")', '@default("USD")'),
    candidate + '\nmodel Unapproved {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(previous, invalid));
});

test('Customer BOQ classifier admits only the exact five new models and parent relations', async () => {
  const { readFileSync } = await import('node:fs');
  const current = readFileSync(new URL('../../apps/api/prisma/schema.prisma', import.meta.url), 'utf8');
  // The real predecessor schema, independently stored by Git, is the baseline.
  const { execFileSync } = await import('node:child_process');
  const baseline = execFileSync('git', ['show', 'fc52a867c96a8b3a369b480b9799bad1a5e9f399:apps/api/prisma/schema.prisma'], { encoding: 'utf8' });
  assert.equal(classifySchema(baseline, current), 'migration-aware-customer-boq-schema');
  for (const invalid of [
    current.replace('sharePercent Decimal @map("share_percent") @db.Decimal(7, 4)', 'sharePercent Float'),
    current.replace('currentEditNo Int @map("current_edit_no")', 'currentEditNo Int @default(1) @map("current_edit_no")'),
    current.replace('customerBoqVersion CustomerBoqVersion?', ''),
    current.replace('model CustomerBoqReplay {', 'model OtherReplay {'),
    current.replace(/baseCurrencyCode\s+String\s+@default\("THB"\)/, 'baseCurrencyCode String @default("USD")'),
    current.replace(/contractValue\s+Decimal/, 'contractValue Float'),
    current + '\nmodel Unreviewed {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(baseline, invalid));
  assert.throws(() => classifySchema(current, baseline));
});
