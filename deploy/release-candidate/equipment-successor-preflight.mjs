// Bounded migration preflight only. Does not admit a release or assert populated recovery.
import {execFileSync} from 'node:child_process';
export const predecessor='a8e1f688617b5c54656467c61923b6d8e4039007';
export const migrationRoot='apps/api/prisma/migrations/';
export const expected=Object.freeze({
 [migrationRoot+'20261124023000_ss11_equipment_custody/migration.sql']:'ce16f51eae3d597de431d5b890b70fc17fc63944',
 [migrationRoot+'20261124221500_jai_asset_register/migration.sql']:'8d730d5aebf75d98b9e47fd502a69242e951e56e'
});
export function assertEquipmentSuccessor(before,after,previousSchema,candidateSchema){
 if(typeof previousSchema!=='string'||!previousSchema||previousSchema!==candidateSchema)
  throw Error('Unexpected Prisma schema change');
 for(const [path,blob] of Object.entries(before)){
  if(after[path]!==blob)throw Error('Predecessor migration modified or removed: '+path);
 }
 const additions=Object.keys(after).filter(path=>!Object.hasOwn(before,path)).sort();
 if(JSON.stringify(additions)!==JSON.stringify(Object.keys(expected).sort()))throw Error('Unexpected migration addition set');
 for(const [path,blob] of Object.entries(expected)){
  if(after[path]!==blob)throw Error('Equipment successor migration differs: '+path);
 }
 return true;
}
function tree(ref){
 const rows=execFileSync('git',['ls-tree','-r','-z',ref,'--',migrationRoot],{encoding:'utf8'}).split('\0').filter(Boolean);
 return Object.fromEntries(rows.map(row=>{
  const [metadata,path]=row.split('\t');
  const [mode,type,sha]=metadata.split(' ');
  if(mode!=='100644'||type!=='blob'||!path)throw Error('Unexpected migration tree entry');
  return [path,sha];
 }));
}
const schema=ref=>execFileSync('git',['rev-parse',ref+':apps/api/prisma/schema.prisma'],{encoding:'utf8'}).trim();
export function assertExactEquipmentSuccessor(candidate='HEAD'){
 return assertEquipmentSuccessor(tree(predecessor),tree(candidate),schema(predecessor),schema(candidate));
}
