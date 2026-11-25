// Purchasing outer layers are prepared only; global release admission remains closed.
import {normalizeSchema} from './pm02-schema-preparation.mjs';
import {stripPur04Schema} from './pur04-schema-preparation.mjs';
import {classifySchema} from './schema-contract.mjs';
export const pur01Migration='20261123185000_pur01_quote_exception_reason';
export const pur01MigrationBlob='7825f4546a427a1bbe2afc793daac258ae5de08c';
export const pur01Column='supplier_quote_exception_reason';
export const pur01Field='supplierQuoteExceptionReason String? @map("supplier_quote_exception_reason") @db.VarChar(2000)';
export function stripPur01Schema(schema){
 let count=0,found=0;
 const text=schema.replace(/^model PurchaseOrder \{[\s\S]*?^\}/gm,block=>{
  count++;
  return block.split('\n').filter(line=>{
   if(normalizeSchema(line)!==pur01Field)return true;
   found++;return false;
  }).join('\n');
 });
 if(count!==1||found>1)throw Error('Exactly one PurchaseOrder model and at most one PUR01 field required');
 return {text,present:found===1};
}
export function assertExactPur01Increment(previous,candidate){
 const a=stripPur01Schema(previous),b=stripPur01Schema(candidate);
 if(a.present||!b.present||normalizeSchema(a.text)!==normalizeSchema(b.text))throw Error('Not the exact forward-only PUR01 increment');
 return true;
}
function wrap(mode,layer){return mode==='migration-aware-sql-only'?'migration-aware-'+layer+'-schema':'migration-aware-'+layer+'-'+mode.slice('migration-aware-'.length);}
export function classifyPurchasingPreparation(previous,candidate){
 const a=stripPur01Schema(previous),b=stripPur01Schema(candidate);
 const c=stripPur04Schema(a.text),d=stripPur04Schema(b.text);
 if(a.present&&!b.present||c.present&&!d.present)throw Error('Purchasing schema removal prohibited');
 if(a.present&&!c.present||b.present&&!d.present)throw Error('PUR01 requires complete PUR04 schema');
 const base=normalizeSchema(c.text)===normalizeSchema(d.text)?'migration-aware-sql-only':classifySchema(c.text,d.text);
 const pur04=!c.present&&d.present?wrap(base,'pur04'):base;
 return !a.present&&b.present?wrap(pur04,'pur01'):pur04;
}
