import {createHash} from 'node:crypto';
// DEC-050 A: exactly three prepared definition facts; old inventory models are unchanged.
const models = {
  "MaterialUomBasis": "9bb31543ec6b4acfb5a0607d44eb60d1a494789c315fc38bccaefab8e849e81d",
  "MaterialUomRevision": "b09c8ca614a3e5ea14b0d02cd117c4fd4d325858c17d15970883ffdfcef7fdd2",
  "MaterialUomOperation": "75b1e405f49fd63541595d91221259d4ee613b28d4af8fa9c89d6ec5d44f74de"
};
export const materialUomTables=['material_uom_bases','material_uom_revisions','material_uom_operations'];

// DEC-050 B: ONLY these fourteen nullable stock/reservation projection fields.
// This strict, model-local stripping lets older immutable predecessor classifiers
// continue proving the unchanged original schema; it is not a broad waiver.
export const materialUomStockFields = {
  StockTransaction: [
    'stockUomId String? @map("stock_uom_id") @db.Uuid',
    'stockQuantity Decimal? @map("stock_quantity") @db.Decimal(18, 4)',
    'conversionBusinessDate DateTime? @map("conversion_business_date") @db.Date',
    'conversionRevisionId String? @map("conversion_revision_id") @db.Uuid',
    'conversionBasisVersion Int? @map("conversion_basis_version")',
    'conversionNumerator String? @map("conversion_numerator") @db.VarChar(38)',
    'conversionDenominator String? @map("conversion_denominator") @db.VarChar(38)',
  ],
  MaterialReservation: [
    'stockUomId String? @map("stock_uom_id") @db.Uuid',
    'stockQuantity Decimal? @map("stock_quantity") @db.Decimal(18, 4)',
    'conversionBusinessDate DateTime? @map("conversion_business_date") @db.Date',
    'conversionRevisionId String? @map("conversion_revision_id") @db.Uuid',
    'conversionBasisVersion Int? @map("conversion_basis_version")',
    'conversionNumerator String? @map("conversion_numerator") @db.VarChar(38)',
    'conversionDenominator String? @map("conversion_denominator") @db.VarChar(38)',
  ],
};
export const materialUomStockMigrations=[
  '20261119140000_material_uom_stock_fact_provenance',
  '20261119141000_material_uom_reservation_stock_basis',
];
const stockComments=new Set([
  '// DEC-050 B: optional, immutable canonical stock projection for new controlled effects.',
  '// Existing source quantity/uomId remain unchanged and retain their source SQL guards.',
  '// NULL is the explicit historical/legacy mode, never a reinterpretation.',
  '// DEC-050 B: optional pinned canonical reservation dimension; legacy rows stay untouched.',
]);
export function stripMaterialUomStockSchema(schema) {
  const found=new Map();
  const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
    const expected=materialUomStockFields[name];
    if(!expected)return block;
    const expectedByName=new Map(expected.map(value=>[value.split(' ')[0],value]));
    const seen=new Set();
    const result=block.split('\n').filter(line=>{
      const normalized=line.trim().replace(/\s+/g,' ');
      if(stockComments.has(normalized))return false;
      const field=normalized.split(' ')[0];
      if(!expectedByName.has(field))return true;
      if(seen.has(field)||expectedByName.get(field)!==normalized)
        throw Error('Material UOM stock projection differs from the exact DEC-050 B contract: '+name+'.'+field);
      seen.add(field);return false;
    }).join('\n');
    found.set(name,seen.size);
    if(seen.size&&seen.size!==expected.length)
      throw Error('Partial material UOM stock projection prohibited: '+name);
    return result;
  });
  const count=[...found.values()].reduce((sum,n)=>sum+n,0);
  if(count!==0&&count!==14)throw Error('Partial material UOM stock projection prohibited');
  return {text,present:count===14};
}

export const materialUomMigrations=['20261118130000_material_uom_definitions','20261118131000_material_uom_definition_guards','20261118132000_material_uom_reference_pins'];
export function stripMaterialUomSchema(schema){
 const stock=stripMaterialUomStockSchema(schema);
 const found=new Set();
 const text=stock.text.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(!Object.hasOwn(models,name))return block;
  if(found.has(name)||createHash('sha256').update(block.replace(/\s+/g,' ')).digest('hex')!==models[name])throw Error('Material UOM schema differs from exact DEC-050 A contract');
  found.add(name);return '';
 }).replace('// DEC-050 Stage A: prepared immutable definitions, not inventory activation.','');
 if(found.size&&found.size!==3)throw Error('Partial material UOM definition schema prohibited');
 return {text,present:found.size===3};
}
export function materialUomMode(mode){
 const present=typeof mode==='string'&&mode.startsWith('migration-aware-material-uom-');
 return {present,prior:!present?mode:mode==='migration-aware-material-uom-schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice('migration-aware-material-uom-'.length)};
}
