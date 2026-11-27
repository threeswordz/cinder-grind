// Read-only acceptance proof: compensate original stock effects, not source-line quantities.
import {isDeepStrictEqual} from 'node:util';
const need=(ok,code)=>{if(!ok)throw Error('M6_SS16_LEDGER_'+code);};
const kinds={
 GOODS_RECEIPT:{field:'goodsReceiptId',types:['GOODS_RECEIPT'],prefix:'receipt-reversal:'},
 MATERIAL_ISSUE:{field:'materialIssueId',types:['MATERIAL_ISSUE'],prefix:'material-issue-reversal:'},
 MATERIAL_RETURN:{field:'materialReturnId',types:['MATERIAL_RETURN'],prefix:'material-return-reversal:'},
 STOCK_TRANSFER:{field:'stockTransferId',types:['STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN'],prefix:'stock-transfer-reversal:'},
};
const dimensions=['companyId','warehouseId','materialId','projectId','uomId','goodsReceiptId','goodsReceiptItemId','materialIssueId','materialIssueItemId','materialReturnId','materialReturnItemId','stockTransferId','stockTransferItemId','transferReceiptLineId','wbsId','costCodeId','activityId'];
const json=v=>JSON.parse(JSON.stringify(v));
function units(value){
 const m=/^(-?)([0-9]{1,14})(?:\.([0-9]{1,4}))?$/.exec(String(value));
 need(m,'QUANTITY');
 return (m[1]? -1n:1n)*(BigInt(m[2])*10000n+BigInt((m[3]??'').padEnd(4,'0')));
}
function pinData(pin){const {stockTransactionId,createdAt,effectSign,...rest}=pin;return rest;}
export async function readSS16Ledger(db,kind,id){
 need(Object.hasOwn(kinds,kind)&&typeof id==='string'&&id.length>0,'SOURCE');
 return json(await db.stockTransaction.findMany({where:{[kinds[kind].field]:id},include:{materialUomEffectPin:true}}));
}
export function verifySS16Ledger({kind,id,before,after,reversed,reviewerId}){
 need(Object.hasOwn(kinds,kind)&&typeof id==='string'&&id.length>0&&typeof reversed==='boolean','SOURCE');
 const k=kinds[kind];
 need(Array.isArray(before)&&Array.isArray(after)&&before.length>0,'EMPTY');
 need(new Set(before.map(x=>x.id)).size===before.length&&new Set(after.map(x=>x.id)).size===after.length,'DUPLICATE');
 const byId=new Map(after.map(x=>[x.id,x]));
 for(const original of before){
  need(typeof original.id==='string'&&original[k.field]===id&&k.types.includes(original.movementType)&&!original.reversalOfId,'ORIGINAL');
  need(isDeepStrictEqual(original,byId.get(original.id)),'ORIGINAL_DRIFT');
 }
 if(!reversed){need(after.length===before.length,'BLOCKED_EFFECT');return {originals:before.length,reversals:0,pinned:0};}
 need(typeof reviewerId==='string'&&reviewerId.length>0&&after.length===before.length*2,'REVERSAL_COUNT');
 const oldIds=new Set(before.map(x=>x.id));
 const added=after.filter(x=>!oldIds.has(x.id));
 let pinned=0;
 for(const original of before){
  const matches=added.filter(x=>x.reversalOfId===original.id);
  need(matches.length===1,'RECIPROCAL');
  const rev=matches[0];
  need(rev.movementType===original.movementType+'_REVERSAL'&&rev.effectKey===k.prefix+original.id&&rev.postedByUserId===reviewerId,'EFFECT');
  need(dimensions.every(key=>rev[key]===original[key]),'DIMENSION');
  const quantity=units(original.quantity);
  need(quantity!==0n&&units(rev.quantity)===-quantity,'QUANTITY');
  const a=original.materialUomEffectPin,b=rev.materialUomEffectPin;
  if(a){
   need(b&&a.stockTransactionId===original.id&&b.stockTransactionId===rev.id&&
    a.effectSign===(quantity<0n?-1:1)&&b.effectSign===-a.effectSign&&
    units(a.stockQuantity)===(quantity<0n?-quantity:quantity)&&a.stockUomId===original.uomId&&
    isDeepStrictEqual(pinData(a),pinData(b)),'PIN');
   pinned++;
  }else need(b===null,'LEGACY_PIN');
 }
 return {originals:before.length,reversals:added.length,pinned};
}
