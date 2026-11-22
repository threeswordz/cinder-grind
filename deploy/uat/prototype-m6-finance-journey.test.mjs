import test from 'node:test';
import assert from 'node:assert/strict';
import {executeM6FinanceJourney,validateM6FinanceSource} from './prototype-m6-finance-journey.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fixture={companyId:uuid(1),projectId:uuid(2)};
const source={supplierId:uuid(3),purchaseOrderLineId:uuid(4),goodsReceiptItemId:uuid(5),
 amount:'125.00',invoiceDate:'2026-11-22',paymentDate:'2026-11-22',currencyCode:'THB',
 supplierReference:'PROTO_M6_SUPPLIER_01',syntheticOnly:true};
const keys=Object.fromEntries(['invoice','invoiceSubmit','invoiceApprove','payment','allocate','paymentSubmit','paymentApprove']
 .map((key,i)=>[key,uuid(20+i)]));
function mockClient(failAt){
 const calls=[],out=[];
 const client={
  login:async(key,actor,company)=>{assert.equal(company,fixture.companyId);out.push('login:'+key);return {key};},
  logout:async(key,session)=>{out.push('logout:'+key);assert.equal(session.key,key);},
  call:async(actor,label,path,expected,body)=>{
   calls.push({actor:actor?.key,label,path,expected,body});
   if(label===failAt)throw new Error('SYNTHETIC_HTTP_FAILURE');
   let data;
   if(label==='M6_INVOICE_WORKFLOW')data=[{workflowCode:'PROTO_M6_SUPPLIER_INVOICE'}];
   else if(label==='M6_PAYMENT_WORKFLOW')data=[{workflowCode:'PROTO_M6_PAYMENT'}];
   else if(label==='M6_INVOICE_CREATE')data={id:uuid(11),state:'DRAFT'};
   else if(label==='M6_INVOICE_SUBMIT')data={id:uuid(11),state:'SUBMITTED'};
   else if(label==='M6_INVOICE_NANCY_APPROVE'||label==='M6_INVOICE_APPROVED_READBACK')data={id:uuid(11),state:'APPROVED'};
   else if(label==='M6_PAYMENT_CREATE')data={id:uuid(12),state:'DRAFT'};
   else if(label==='M6_PAYMENT_SUBMIT')data={id:uuid(12),state:'SUBMITTED'};
   else if(label==='M6_PAYMENT_NANCY_APPROVE')data={id:uuid(12),state:'APPROVED'};
   else if(label==='M6_PAYMENT_APPROVED_READBACK')data={id:uuid(12),state:'APPROVED',
     supplierAllocations:[{supplierInvoiceId:uuid(11)}]};
   return {value:{data}};
  },
 };
 return {client,calls,out};
}
test('strict source does not allow unknown PO/GR, non-THB or real supplier',()=>{
 validateM6FinanceSource(fixture,source);
 for(const patch of [
  {purchaseOrderLineId:'not-an-id'},{goodsReceiptItemId:null},
  {currencyCode:'SGD'},{syntheticOnly:false},{amount:'125'},{supplierReference:'ACME_REAL'}
 ])assert.throws(()=>validateM6FinanceSource(fixture,{...source,...patch}));
});
test('Porn→Nancy supplier invoice and payment route order and final session revocation',async()=>{
 const x=mockClient();const result=await executeM6FinanceJourney({client:x.client,
  actors:{PORN:{},NANCY:{}},fixture,source,keys});
 assert.equal(result.status,'M6_SUPPLIER_INVOICE_AND_PAYMENT_HTTP_VERIFIED');
 assert.equal(result.sessionsRevoked,true);assert.equal(result.productionAuthorized,false);
 assert.deepEqual(x.out,['login:M6_PORN','login:M6_NANCY','logout:M6_NANCY','logout:M6_PORN']);
 assert.deepEqual(x.calls.filter(x=>x.expected===403).map(x=>x.label),
  ['M6_INVOICE_MAKER_CANNOT_APPROVE','M6_PAYMENT_MAKER_CANNOT_APPROVE']);
 assert.equal(x.calls.filter(x=>x.expected===201).length,7);
 assert.equal(x.calls.filter(x=>x.expected===401).length,2);
 const pays=x.calls.find(x=>x.label==='M6_PAYMENT_CREATE');assert.equal(pays.body.direction,'OUTBOUND');
 assert.equal(pays.body.paymentMethod,'SYNTHETIC_INTERNAL');
});
test('failure leaves partial attempt visible and revokes both sessions without retry',async()=>{
 const x=mockClient('M6_PAYMENT_CREATE');
 await assert.rejects(executeM6FinanceJourney({client:x.client,actors:{PORN:{},NANCY:{}},
  fixture,source,keys}),/SYNTHETIC_HTTP_FAILURE/);
 assert.equal(x.calls.filter(c=>c.label==='M6_PAYMENT_CREATE').length,1);
 assert.deepEqual(x.out.slice(-2),['logout:M6_NANCY','logout:M6_PORN']);
});
test('invalid action keys cause zero login and zero writes',async()=>{
 const x=mockClient();await assert.rejects(executeM6FinanceJourney({client:x.client,
  actors:{PORN:{},NANCY:{}},fixture,source,keys:{...keys,payment:keys.invoice}}),
  /M6_ACTION_KEYS_INVALID/);assert.deepEqual(x.calls,[]);assert.deepEqual(x.out,[]);
});
