import { stripHrSchema } from './hr-schema-contract.mjs';
import { stripHrDocumentSchema } from './hr-document-schema-contract.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// DEC-033 authorizes these four nullable provenance columns and the Company
// default. Other schema evolution needs its own reviewed rehearsal contract.
export const provenanceFields = {
  Project: ['contractCurrencyCode', 'contract_currency_code'],
  Boq: ['currencyCode', 'currency_code'],
  SupplierQuotation: ['currencyCode', 'currency_code'],
  QuotationAward: ['currencyCode', 'currency_code'],
};

// DEC-037/BUD-012-016: exact five-model persistence increment, not a general
// successor-schema exemption. Any field/relation/type change needs new review.
const customerModels = {
  "CustomerBoqVersion": "d94d38e73dd11a6b477eefaf35688c27e81eab55297885053e16c7a54f64a0d2",
  "CustomerBoqEdit": "dc00b0b27c3315ced8c37d2ff6f367fa6d9acb26ce3851887b309cff28c29974",
  "CustomerBoqLine": "7d92e3a85a52c8842b0f407eb331280c927d3ceec738fac654fc995e4d1ba529",
  "CustomerBoqMapping": "dea45a67e083d34609b51a208c591fc185e6951b47f58d238cc2fad36736e39d",
  "CustomerBoqReplay": "fdfd1d49188f0498e116a1e60f8dff85dfcc6c4c9e24c0a4bfbb1556b1c5c9b0"
};
const customerRelations = {
  Company: ['customerBoqVersions CustomerBoqVersion[]', 'customerBoqReplays CustomerBoqReplay[]'],
  Project: ['customerBoqVersions CustomerBoqVersion[]'],
  User: ['createdCustomerBoqVersions CustomerBoqVersion[] @relation("CustomerBoqCreator")',
    'submittedCustomerBoqVersions CustomerBoqVersion[] @relation("CustomerBoqSubmitter")',
    'customerBoqEdits CustomerBoqEdit[]', 'customerBoqReplays CustomerBoqReplay[]'],
  BudgetRevision: ['customerBoqVersions CustomerBoqVersion[]'],
  BudgetRevisionLine: ['customerBoqMappings CustomerBoqMapping[]'],
  UnitOfMeasure: ['customerBoqLines CustomerBoqLine[]'],
  ApprovalInstance: ['customerBoqVersion CustomerBoqVersion?'],
};
function stripCustomer(schema) {
  const models = new Set(), relations = new Set();
  const stripped = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (Object.hasOwn(customerModels, name)) {
      if (models.has(name) || createHash('sha256').update(block.replace(/\s+/g, ' ')).digest('hex') !== customerModels[name]) {
        throw new Error('Customer BOQ schema differs from the exact reviewed persistence contract.');
      }
      models.add(name); return '';
    }
    return block.split('\n').filter((line) => {
      const normalized = line.trim().replace(/\s+/g, ' ');
      if (!(customerRelations[name] ?? []).includes(normalized)) return true;
      const key = name + ':' + normalized;
      if (relations.has(key)) throw new Error('Duplicate Customer BOQ relation.');
      relations.add(key); return false;
    }).join('\n');
  }).replace('// Independently approved commercial versions; edits and their source links are append-only.', '');
  if ((models.size && models.size !== 5) || (relations.size && relations.size !== 11) || Boolean(models.size) !== Boolean(relations.size)) {
    throw new Error('Partial Customer BOQ schema is not supported.');
  }
  return { text: stripped, present: models.size === 5 };
}

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

function classifyBaseSchema(previous, candidate) {
  if (previous === candidate) return 'migration-aware-sql-only';
  const oldCustomer = stripCustomer(previous);
  const newCustomer = stripCustomer(candidate);
  if (oldCustomer.present && !newCustomer.present) throw new Error('Customer BOQ schema removal is prohibited.');
  const before = normalize(oldCustomer.text, true);
  const after = normalize(newCustomer.text, true);
  if (before.text !== after.text || after.found.size !== 4 || ![0, 4].includes(before.found.size) ||
      (/baseCurrencyCode\s+String\s+@default\("THB"\)/.test(previous) && /baseCurrencyCode\s+String\s+@default\("SGD"\)/.test(candidate))) {
    throw new Error('Schema change is outside the bounded DEC-033 provenance/default contract.');
  }
  return newCustomer.present && !oldCustomer.present ? 'migration-aware-customer-boq-schema' : 'migration-aware-thb-schema';
}

function classifyPriorContracts(previous, candidate) {
  if (previous === candidate) return 'migration-aware-sql-only';
  const before = stripHrSchema(previous), after = stripHrSchema(candidate);
  if (before.present && !after.present) throw new Error('HR schema removal is prohibited.');
  if (!before.present && after.present) {
    if (before.text.replace(/\s+/g,' ').trim() === after.text.replace(/\s+/g,' ').trim()) return 'migration-aware-hr-schema';
    const base = classifyBaseSchema(before.text, after.text);
    if (base !== 'migration-aware-customer-boq-schema') throw new Error('HR upgrade cannot absorb an unrelated schema change.');
    return 'migration-aware-hr-customer-boq-schema';
  }
  return classifyBaseSchema(before.text, after.text);
}

export function classifySchema(previous, candidate) {
  if (previous === candidate) return 'migration-aware-sql-only';
  // Strip only the EXACT approved five parent additions and one new model.
  // Classify the historical THB/Customer BOQ/HR contracts independently; the
  // new mode does not relax their previously reviewed constraints.
  const oldDocument = stripHrDocumentSchema(previous);
  const newDocument = stripHrDocumentSchema(candidate);
  if (oldDocument.present && !newDocument.present) {
    throw new Error('HR private Document custody removal is prohibited.');
  }
  const base = classifyPriorContracts(oldDocument.text, newDocument.text);
  if (!oldDocument.present && newDocument.present) {
    return base === 'migration-aware-sql-only'
      ? 'migration-aware-hr-document-schema'
      : 'migration-aware-hr-document-' + base.slice('migration-aware-'.length);
  }
  return base;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [previous, candidate] = process.argv.slice(2);
  if (!previous || !candidate) throw new Error('Usage: schema-contract.mjs <previous.prisma> <candidate.prisma>');
  console.log(classifySchema(readFileSync(previous, 'utf8'), readFileSync(candidate, 'utf8')));
}
