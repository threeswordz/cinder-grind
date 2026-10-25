import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// DEC-033 authorizes these four nullable provenance columns and the Company
// default. Other schema evolution needs its own reviewed rehearsal contract.
export const provenanceFields = {
  Project: ['contractCurrencyCode', 'contract_currency_code'],
  Boq: ['currencyCode', 'currency_code'],
  SupplierQuotation: ['currencyCode', 'currency_code'],
  QuotationAward: ['currencyCode', 'currency_code'],
};

function normalize(schema, candidate) {
  let model;
  const found = new Set();
  const lines = schema.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return { found, text: lines.filter((line) => {
    const start = /^model (\w+) \{$/.exec(line);
    if (start) model = start[1];
    if (line === '}') model = undefined;
    const field = provenanceFields[model];
    if (candidate && field && line.startsWith(field[0] + ' ')) {
      const expected = `${field[0]} String? @map("${field[1]}") @db.VarChar(3)`;
      if (line.replace(/\s+/g, ' ') !== expected || found.has(model)) {
        throw new Error('Provenance fields must be nullable VARCHAR(3) without a default or backfill.');
      }
      found.add(model);
      return false;
    }
    return true;
  }).map((line) => line.replace(/\s+/g, ' ')
    .replace(/^(baseCurrencyCode String @default\()"THB"(\).*)$/, '$1"SGD"$2'))
    .join('\n') };
}

export function classifySchema(previous, candidate) {
  if (previous === candidate) return 'migration-aware-sql-only';
  const before = normalize(previous, true);
  const after = normalize(candidate, true);
  if (before.text !== after.text || after.found.size !== 4 || ![0, 4].includes(before.found.size) ||
      (/baseCurrencyCode\s+String\s+@default\("THB"\)/.test(previous) && /baseCurrencyCode\s+String\s+@default\("SGD"\)/.test(candidate))) {
    throw new Error('Schema change is outside the bounded DEC-033 provenance/default contract.');
  }
  return 'migration-aware-thb-schema';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [previous, candidate] = process.argv.slice(2);
  if (!previous || !candidate) throw new Error('Usage: schema-contract.mjs <previous.prisma> <candidate.prisma>');
  console.log(classifySchema(readFileSync(previous, 'utf8'), readFileSync(candidate, 'utf8')));
}
