// PUR04 preparation: exact nine nullable commercial fields, no release admission.
import {normalizeSchema} from './pm02-schema-preparation.mjs';
export const pur04Migration='20261123181000_pur04_po_commercial_header';
export const pur04MigrationBlob='072293acec77a8a9c911dc78d1b0a39175820412';
export const pur04Fields=Object.freeze([
 'deliveryLocation String? @map("delivery_location") @db.VarChar(500)',
 'deliveryContact String? @map("delivery_contact") @db.VarChar(200)',
 'deliveryTerms String? @map("delivery_terms") @db.Text',
 'paymentTerms String? @map("payment_terms") @db.Text',
 'creditTerms String? @map("credit_terms") @db.Text',
 'discountAmount Decimal? @map("discount_amount") @db.Decimal(18, 2)',
 'freightAmount Decimal? @map("freight_amount") @db.Decimal(18, 2)',
 'additionalChargeAmount Decimal? @map("additional_charge_amount") @db.Decimal(18, 2)',
 'vatRatePercent Decimal? @map("vat_rate_percent") @db.Decimal(5, 2)',
]);
export const pur04Columns=Object.freeze(pur04Fields.map(f=>f.match(/@map\("([^"]+)"\)/)[1]));
export function stripPur04Schema(schema){
 const found=new Set();let count=0;
 const text=schema.replace(/^model PurchaseOrder \{[\s\S]*?^\}/gm,block=>{
  count++;
  return block.split('\n').filter(line=>{
   const value=normalizeSchema(line);
   if(!pur04Fields.includes(value))return true;
   if(found.has(value))throw Error('Duplicate PUR04 field');
   found.add(value);return false;
  }).join('\n');
 });
 if(count!==1)throw Error('Exactly one PurchaseOrder model required');
 if(found.size!==0&&found.size!==pur04Fields.length)throw Error('Partial or modified PUR04 metadata');
 return {text,present:found.size!==0};
}
export function assertExactPur04Increment(previous,candidate){
 const a=stripPur04Schema(previous),b=stripPur04Schema(candidate);
 if(a.present||!b.present||normalizeSchema(a.text)!==normalizeSchema(b.text))
  throw Error('Not the exact forward-only PUR04 increment');
 return true;
}
