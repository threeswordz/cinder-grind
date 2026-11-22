// Bounded new M6 finance HTTP journey: original Procurement/GR sources are
// read, never replayed. All business mutations use existing authenticated APIs.
// No automatic retry, administrative approval, SQL status edits or cash transfer.
import {randomUUID} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const day=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&
  !Number.isNaN(Date.parse(s+'T00:00:00Z'));
const amount=s=>typeof s==='string'&&/^[1-9]\d{0,9}\.\d{2}$/.test(s);
const state=(data,id,kind,expected)=>{
 need(data?.id===id&&data.state===expected,'M6_'+kind+'_STATE_MISMATCH');return data;
};

// Each source identifier must be obtained from a freshly authenticated,
// approved same-Company/Supplier/Project PO and canonical received GR item.
// The existing API repeats those scope and amount checks inside transactions.
export function validateM6FinanceSource(fixture,source){
 need(uuid(fixture?.companyId)&&uuid(fixture?.projectId)&&uuid(source?.supplierId)&&
   uuid(source?.purchaseOrderLineId)&&uuid(source?.goodsReceiptItemId)&&
   amount(source?.amount)&&day(source?.invoiceDate)&&day(source?.paymentDate)&&
   source.currencyCode==='THB'&&source.syntheticOnly===true,
   'M6_FINANCE_SOURCE_NOT_EXPLICIT');
 need(source?.supplierReference?.startsWith('PROTO_M6_')&&
   source.supplierReference.length<=100&&/^[A-Z0-9_-]+$/.test(source.supplierReference),
   'M6_NON_SYNTHETIC_SUPPLIER_REFERENCE');
}

export async function executeM6FinanceJourney({client,actors,fixture,source,keys}={}){
 need(client&&['login','logout','call'].every(k=>typeof client[k]==='function')&&
   actors?.PORN&&actors?.NANCY,'M6_ACTOR_HTTP_CLIENT_REQUIRED');
 validateM6FinanceSource(fixture,source);
 const useKeys=keys??Object.fromEntries(['invoice','invoiceSubmit','invoiceApprove',
   'payment','allocate','paymentSubmit','paymentApprove'].map(k=>[k,randomUUID()]));
 need(Object.keys(useKeys).length===7&&Object.values(useKeys).every(uuid)&&
   new Set(Object.values(useKeys)).size===7,'M6_ACTION_KEYS_INVALID');
 const p=fixture.projectId,c=fixture.companyId;
 const sessions={},call=async(actor,label,path,expected,body)=>{
   const {value}=await client.call(sessions[actor],label,path,expected,body);
   return value?.data;
 };
 let error,result;
 try{
   sessions.PORN=await client.login('M6_PORN',actors.PORN,c);
   sessions.NANCY=await client.login('M6_NANCY',actors.NANCY,c);
   const workflowOptions=await call('PORN','M6_INVOICE_WORKFLOW',
     '/finance/supplier-invoice-workflow-options',200);
   need(Array.isArray(workflowOptions)&&workflowOptions.some(w=>w.workflowCode==='PROTO_M6_SUPPLIER_INVOICE'),
     'M6_INVOICE_WORKFLOW_MISSING');
   const invoice=await call('PORN','M6_INVOICE_CREATE',
     '/finance/projects/'+p+'/supplier-invoices',201,{
       supplierId:source.supplierId,supplierReference:source.supplierReference,
       invoiceDate:source.invoiceDate,createKey:useKeys.invoice,
       lines:[{description:'Synthetic M6 approved PO and GR invoice',amount:source.amount,
         purchaseOrderLineId:source.purchaseOrderLineId,goodsReceiptItemId:source.goodsReceiptItemId}],
     });
   need(uuid(invoice?.id),'M6_INVOICE_CREATE_ID_INVALID');
   state(invoice,invoice.id,'INVOICE','DRAFT');
   const invoiceId=invoice.id;
   state(await call('PORN','M6_INVOICE_SUBMIT','/finance/supplier-invoices/'+invoiceId+'/submit',201,
     {workflowCode:'PROTO_M6_SUPPLIER_INVOICE',actionKey:useKeys.invoiceSubmit}),invoiceId,'INVOICE','SUBMITTED');
   await call('PORN','M6_INVOICE_MAKER_CANNOT_APPROVE','/finance/supplier-invoices/'+invoiceId+'/approve',403,
     {actionKey:randomUUID()});
   state(await call('NANCY','M6_INVOICE_NANCY_APPROVE','/finance/supplier-invoices/'+invoiceId+'/approve',201,
     {actionKey:useKeys.invoiceApprove,comment:'Synthetic independent M6 supplier invoice approval'}),
     invoiceId,'INVOICE','APPROVED');
   state(await call('NANCY','M6_INVOICE_APPROVED_READBACK','/finance/supplier-invoices/'+invoiceId,200),
     invoiceId,'INVOICE','APPROVED');
   const paymentWorkflows=await call('PORN','M6_PAYMENT_WORKFLOW','/finance/payment-workflow-options',200);
   need(Array.isArray(paymentWorkflows)&&paymentWorkflows.some(w=>w.workflowCode==='PROTO_M6_PAYMENT'),
     'M6_PAYMENT_WORKFLOW_MISSING');
   const payment=await call('PORN','M6_PAYMENT_CREATE','/finance/projects/'+p+'/payments',201,{
     direction:'OUTBOUND',paymentDate:source.paymentDate,supplierId:source.supplierId,
     amount:source.amount,paymentMethod:'SYNTHETIC_INTERNAL',
     reference:source.supplierReference,createKey:useKeys.payment,
   });
   need(uuid(payment?.id),'M6_PAYMENT_CREATE_ID_INVALID');
   state(payment,payment.id,'PAYMENT','DRAFT');
   const paymentId=payment.id;
   await call('PORN','M6_PAYMENT_ALLOCATE','/finance/payments/'+paymentId+'/allocations',201,{
     targetType:'SUPPLIER_INVOICE',targetId:invoiceId,amount:source.amount,actionKey:useKeys.allocate,
   });
   state(await call('PORN','M6_PAYMENT_SUBMIT','/finance/payments/'+paymentId+'/submit',201,
     {workflowCode:'PROTO_M6_PAYMENT',actionKey:useKeys.paymentSubmit}),paymentId,'PAYMENT','SUBMITTED');
   await call('PORN','M6_PAYMENT_MAKER_CANNOT_APPROVE','/finance/payments/'+paymentId+'/approve',403,
     {actionKey:randomUUID()});
   state(await call('NANCY','M6_PAYMENT_NANCY_APPROVE','/finance/payments/'+paymentId+'/approve',201,
     {actionKey:useKeys.paymentApprove,comment:'Synthetic independent M6 supplier payment approval'}),
     paymentId,'PAYMENT','APPROVED');
   const verified=state(await call('NANCY','M6_PAYMENT_APPROVED_READBACK',
     '/finance/payments/'+paymentId,200),paymentId,'PAYMENT','APPROVED');
   need(Array.isArray(verified.supplierAllocations)&&
     verified.supplierAllocations.some(a=>a.supplierInvoiceId===invoiceId),
     'M6_PAYMENT_INVOICE_LINK_MISSING');
   result={status:'M6_SUPPLIER_INVOICE_AND_PAYMENT_HTTP_VERIFIED',invoiceId,paymentId,
     sourcePoLineId:source.purchaseOrderLineId,sourceGoodsReceiptItemId:source.goodsReceiptItemId,
     maker:'PORN',approver:'NANCY',makerDenialsVerified:true,
     postedSyntheticOnly:true,browserJourneysVerified:false,humanUatCompleted:false,
     fullBusinessJourneysVerified:false,productionAuthorized:false};
 }catch(e){error=e;}
 finally{
  for(const key of ['NANCY','PORN'])if(sessions[key]){
   try{await client.logout('M6_'+key,sessions[key]);
     await client.call(sessions[key],'M6_'+key+'_SESSION_REVOKED','/auth/me',401);
   }catch(e){error??=e;}
  }
 }
 if(error)throw error;
 return {...result,sessionsRevoked:true};
}
