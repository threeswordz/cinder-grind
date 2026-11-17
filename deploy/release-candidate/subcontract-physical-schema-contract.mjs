import { createHash } from 'node:crypto';
// DEC-048: exact additive physical facts; every canonical commercial model stays intact.
const models = {
  SubcontractPhysicalPolicy: '109747dd338d9d8d9dd309163419dcc1100d74f6228cd6abcebb72f9806f1339',
  SubcontractPhysicalClaim: '2b812df594c90958b2c507d37f46de3593cdd6d2183b86221b47bb200add168d',
  SubcontractPhysicalRevision: '601eda5bae8fb3d145066d01ac9df5a3be290a885ed8a835e7de0d9516217add',
  SubcontractPhysicalSubmission: '79e00fa7451082070df0005899c8bd367fbae77883c3075dc9c2a3d653386d45',
  SubcontractPhysicalDecision: 'b18b49b541a4e24252bc2c6bb0caeece37f9401b5c6417ab68fb9f10655a6dd0',
  SubcontractPhysicalOperation: 'd678a585b648d8c2946324162fab9ec52a36f946580cbb8343eaf220118adeee',
};
export const physicalTables = ['subcontract_physical_policies', 'subcontract_physical_claims', 'subcontract_physical_revisions',
  'subcontract_physical_submissions', 'subcontract_physical_decisions', 'subcontract_physical_operations'];
export const physicalMigrations = ['20261117101500_subcontract_physical_acceptance', '20261117102500_subcontract_physical_evidence_guards',
  '20261117103500_subcontract_physical_source_qualification', '20261117104500_subcontract_physical_allocation_binding',
  '20261117105500_subcontract_physical_policy_lock_scope', '20261117110500_subcontract_physical_evidence_serialization',
  '20261117111500_subcontract_physical_evidence_lock_qualification', '20261117112500_subcontract_physical_current_line_binding',
  '20261117113500_subcontract_physical_unit_precision'];
export function stripPhysicalSchema(schema) {
  const found = new Set();
  const text = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (!Object.hasOwn(models, name)) return block;
    if (found.has(name) || createHash('sha256').update(block.replace(/\s+/g, ' ')).digest('hex') !== models[name]) {
      throw Error('Physical schema differs from exact DEC-048 contract');
    }
    found.add(name); return '';
  }).replace('// DEC-048: physical source facts attach to the existing canonical Claim.\n// SQL adds scoped foreign keys and deferred source/assessment integrity guards.', '');
  if (found.size && found.size !== 6) throw Error('Partial physical source schema prohibited');
  return { text, present: found.size === 6 };
}
export function physicalMode(mode) {
  const present = typeof mode === 'string' && mode.startsWith('migration-aware-subcontract-physical-');
  return { present, prior: !present ? mode : mode === 'migration-aware-subcontract-physical-schema' ? 'migration-aware-sql-only'
    : 'migration-aware-' + mode.slice('migration-aware-subcontract-physical-'.length) };
}
