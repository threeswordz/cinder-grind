import {createHash} from 'node:crypto';
// DEC-050 A: exactly three prepared definition facts; old inventory models are unchanged.
const models = {
  "MaterialUomBasis": "9bb31543ec6b4acfb5a0607d44eb60d1a494789c315fc38bccaefab8e849e81d",
  "MaterialUomRevision": "b09c8ca614a3e5ea14b0d02cd117c4fd4d325858c17d15970883ffdfcef7fdd2",
  "MaterialUomOperation": "75b1e405f49fd63541595d91221259d4ee613b28d4af8fa9c89d6ec5d44f74de"
};
export const materialUomTables=['material_uom_bases','material_uom_revisions','material_uom_operations'];
export const materialUomMigrations=['20261118130000_material_uom_definitions','20261118131000_material_uom_definition_guards','20261118132000_material_uom_reference_pins'];
export function stripMaterialUomSchema(schema){
 const found=new Set();
 const text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
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
