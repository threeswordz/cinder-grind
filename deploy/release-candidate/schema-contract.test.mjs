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
