import test from 'node:test';
import assert from 'node:assert/strict';
import {readSS16Ledger,verifySS16Ledger} from './m6-parallel-03-ss16-ledger.mjs';
const id='source',reviewerId='pm';
function effect(id,kind,field,quantity,extra={}){
 return {id,[field]:'source',companyId:'c',warehouseId:'w',materialId:'m',projectId:'p',uomId:'EA',movementType:kind,quantity,reversalOfId:null,materialUomEffectPin:null,...extra};
}
function rev(a,prefix){
 const id='rev-'+a.id,p=a.materialUomEffectPin;
 return {...a,id,movementType:a.movementType+'_REVERSAL',quantity:a.quantity.startsWith('-')?a.quantity.slice(1):'-'+a.quantity,reversalOfId:a.id,effectKey:prefix+a.id,postedByUserId:reviewerId,materialUomEffectPin:p?{...p,stockTransactionId:id,effectSign:-p.effectSign,createdAt:'later'}:null};
}
function verify(kind,before,after,reversed=true){return verifySS16Ledger({kind,id,before,after,reversed,reviewerId});}
function pin(a){return {...a,materialUomEffectPin:{stockTransactionId:a.id,companyId:'c',materialId:'m',sourceUomId:'BOX',sourceQuantity:'1',stockUomId:'EA',stockQuantity:a.quantity.replace('-',''),effectSign:a.quantity.startsWith('-')?-1:1,businessDate:'2026-11-19',basisVersion:1,revisionId:'r1',numerator:'12',denominator:'1',createdAt:'then'}};}
for(const [kind,field,prefix,quantity] of [['GOODS_RECEIPT','goodsReceiptId','receipt-reversal:','12.0000'],['MATERIAL_ISSUE','materialIssueId','material-issue-reversal:','-12'],['MATERIAL_RETURN','materialReturnId','material-return-reversal:','12']]){
 test(kind+' converted plus legacy original compensation',()=>{
  const a=pin(effect('a',kind,field,quantity)),b=effect('b',kind,field,quantity);
  assert.deepEqual(verify(kind,[a,b],[rev(b,prefix),a,rev(a,prefix),b]),{originals:2,reversals:2,pinned:1});
 });
}
test('split custody reverses each individual dispatch/receipt effect in its original project and UOM',()=>{
 const out=pin(effect('out','STOCK_TRANSFER_OUT','stockTransferId','-12',{stockTransferItemId:'line',transferReceiptLineId:null}));
 const i1=pin(effect('i1','STOCK_TRANSFER_IN','stockTransferId','5',{warehouseId:'dest',projectId:'dest-p',stockTransferItemId:'line',transferReceiptLineId:'r1'}));
 const i2=pin(effect('i2','STOCK_TRANSFER_IN','stockTransferId','7',{warehouseId:'dest',projectId:'dest-p',stockTransferItemId:'line',transferReceiptLineId:'r2'}));
 const before=[out,i1,i2],after=[...before,...before.map(a=>rev(a,'stock-transfer-reversal:'))];
 assert.deepEqual(verify('STOCK_TRANSFER',before,after),{originals:3,reversals:3,pinned:3});
 assert.throws(()=>verify('STOCK_TRANSFER',before,after.slice(0,-1)),/REVERSAL_COUNT/);
 const changed=structuredClone(after);changed[5].transferReceiptLineId='r1';
 assert.throws(()=>verify('STOCK_TRANSFER',before,changed),/DIMENSION/);
});
test('rejects changed historic original, wrong rate, fabricated legacy pin, wrong amount and duplicate compensation',()=>{
 const a=pin(effect('a','GOODS_RECEIPT','goodsReceiptId','12')),b=effect('b','GOODS_RECEIPT','goodsReceiptId','2');
 const before=[a,b],after=[a,b,rev(a,'receipt-reversal:'),rev(b,'receipt-reversal:')];
 const bad=(edit,code)=>{const rows=structuredClone(after);edit(rows);assert.throws(()=>verify('GOODS_RECEIPT',before,rows),code);};
 bad(rows=>rows[0].quantity='11',/ORIGINAL_DRIFT/);
 bad(rows=>rows[2].materialUomEffectPin.revisionId='current',/PIN/);
 bad(rows=>rows[3].materialUomEffectPin=rows[2].materialUomEffectPin,/LEGACY_PIN/);
 bad(rows=>rows[2].quantity='-11',/QUANTITY/);
 bad(rows=>rows[3].reversalOfId='a',/RECIPROCAL/);
 bad(rows=>rows[2].postedByUserId='maker',/EFFECT/);
 bad(rows=>rows[2].id='a',/DUPLICATE/);
});
test('blocked correction preserves exact original effects and has no compensating movement',()=>{
 const a=effect('a','MATERIAL_ISSUE','materialIssueId','-1');
 assert.deepEqual(verify('MATERIAL_ISSUE',[a],[a],false),{originals:1,reversals:0,pinned:0});
 assert.throws(()=>verify('MATERIAL_ISSUE',[a],[a,rev(a,'material-issue-reversal:')],false),/BLOCKED_EFFECT/);
});
test('readback uses only source-specific stock query including immutable pin',async()=>{
 const a=effect('a','STOCK_TRANSFER_OUT','stockTransferId','-1');
 const db={stockTransaction:{findMany:async q=>{assert.deepEqual(q,{where:{stockTransferId:id},include:{materialUomEffectPin:true}});return [a];}}};
 assert.deepEqual(await readSS16Ledger(db,'STOCK_TRANSFER',id),[a]);
 await assert.rejects(readSS16Ledger(db,'__proto__',id),/SOURCE/);
});
