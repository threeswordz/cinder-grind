// DEC-054 actual-user HTTP continuation on the populated prototype: reuse its
// existing Cost BOQ, create only a new Ben-approved revision and one buffered
// Client BOQ approved by Nancy. Never replay/recreate the original Cost BOQ,
// material plan or UOM stock journey. No admin shortcuts or retries.
import {randomUUID} from 'node:crypto';
const need=(x,code)=>{if(!x)throw Object.assign(new Error(code),{safeCode:code});};
const uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const decimal=s=>typeof s==='string'&&/^\d{1,14}(?:\.\d{1,4})?$/.test(s);
function q4(s){need(decimal(s),'M6_COST_QUANTITY_INVALID');const [a,b='']=s.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));}
export function customerBufferedQuantity(raw,buffer='1.0000'){
 const sum=q4(raw)+q4(buffer);need(sum<1000000000000000000n,'M6_CUSTOMER_QUANTITY_RANGE');
 return String(sum/10000n)+'.'+String(sum%10000n).padStart(4,'0');
}
const sensitive=/^(rate|amount|unitprice|price|costbasis|estimatedcost|totalamount|markup|margin|profit|clientamount|money|budgetamount)$/i;
export function assertQuantityOnly(value){
 function walk(x){if(Array.isArray(x)){for(const y of x)walk(y);return;}
  if(x&&typeof x==='object')for(const [key,v]of Object.entries(x)){
   need(!sensitive.test(key),'M6_QUANTITY_MONETARY_FIELD_EXPOSED');walk(v);
  }
 }
 walk(value);return true;
}
export async function executeM6BoqJourney({client,actors,fixture,requestKeys}={}){
 need(client&&['login','logout','call'].every(k=>typeof client[k]==='function')&&
  actors?.BEN&&actors?.NANCY&&actors?.STORE_SITE&&uuid(fixture?.companyId)&&
  uuid(fixture?.projectId),'M6_BOQ_SYNTHETIC_ACTORS_REQUIRED');
 const keys=requestKeys??Object.fromEntries(['create','submit','decide'].map(x=>[x,randomUUID()]));
 need(Object.keys(keys).length===3&&Object.values(keys).every(uuid)&&
  new Set(Object.values(keys)).size===3,'M6_BOQ_REPLAY_KEYS_INVALID');
 const project=fixture.projectId,company=fixture.companyId,sessions={};let error,result;
 const ask=async(actor,label,path,status,body)=>(await client.call(sessions[actor],label,path,status,body)).value?.data;
 try{
  for(const k of ['BEN','NANCY','STORE_SITE'])sessions[k]=await client.login('M6_BOQ_'+k,actors[k],company);
  const existing=await ask('STORE_SITE','M6_EXISTING_COST_QUANTITIES',
   '/budget/quantity/projects/'+project+'/boq',200);
  assertQuantityOnly(existing);
  const draft=await ask('BEN','M6_BEN_COST_REVISION_CREATE',
   '/budget/projects/'+project+'/revisions',201,{revisionNote:'Synthetic DEC-054 Ben-approved Cost BOQ continuation'});
  need(uuid(draft?.id)&&draft.lifecycleState==='DRAFT','M6_COST_DRAFT_INVALID');
  const costId=draft.id;
  const submitted=await ask('BEN','M6_BEN_COST_REVISION_SUBMIT',
   '/budget/revisions/'+costId+'/submit',201,{workflowCode:'PROTO_M6_COST_BEN'});
  need(submitted?.id===costId&&submitted.lifecycleState==='SUBMITTED','M6_COST_SUBMISSION_INVALID');
  const approved=await ask('BEN','M6_BEN_COST_SELF_APPROVE',
   '/budget/revisions/'+costId+'/approve',201,{comment:'Explicit DEC-054 Cost BOQ self approval'});
  need(approved?.id===costId&&approved.lifecycleState==='APPROVED','M6_BEN_COST_APPROVAL_FAILED');
  const quantities=await ask('STORE_SITE','M6_STORE_APPROVED_COST_QUANTITY',
   '/budget/quantity/projects/'+project+'/revisions/'+costId,200);
  assertQuantityOnly(quantities);
  await client.call(sessions.STORE_SITE,'M6_STORE_FULL_COST_DENIED',
    '/budget/revisions/'+costId,403);
  const options=await ask('BEN','M6_CLIENT_SOURCE_OPTIONS',
    '/budget/customer/projects/'+project+'/options',200);
  const source=options?.sources?.find(s=>s.id===costId);
  need(source&&Array.isArray(source.lines)&&source.lines.length>0&&
   Array.isArray(options.uoms)&&
   options.workflows?.some(w=>w.workflowCode==='PROTO_M6_CLIENT_NANCY'),
   'M6_CLIENT_APPROVED_SOURCE_MISSING');
  const line=source.lines.find(l=>uuid(l.id)&&decimal(l.quantity)&&uuid(l.uomId));
  need(line,'M6_CLIENT_COST_LINE_INVALID');
  const uom=options.uoms.find(x=>x.id===line.uomId);
  need(uom&&Number.isInteger(uom.decimalPlaces)&&uom.decimalPlaces>=0,
   'M6_CLIENT_SOURCE_UOM_INVALID');
  const buffer=uom.decimalPlaces===0?'1':'1.0000',
   quantity=uom.decimalPlaces===0
    ?customerBufferedQuantity(String(line.quantity),buffer).split('.')[0]
    :customerBufferedQuantity(String(line.quantity),buffer);
  const commercialDraft={sourceRevisionId:costId,reason:'Synthetic selected-line Customer quantity buffer',
   lines:[{lineId:randomUUID(),description:String(line.description),quantity,uomId:line.uomId,
    method:'MANUAL',manualRate:'1000.0000',bufferQuantity:buffer,
    mappings:[{sourceLineId:line.id,sharePercent:'100.0000'}]}]};
  const created=await ask('BEN','M6_CLIENT_BUFFERED_CREATE',
   '/budget/customer/projects/'+project+'/versions',201,{requestId:keys.create,draft:commercialDraft});
  need(uuid(created?.id)&&created.editNo===1&&created.approvalState==='DRAFT',
   'M6_CLIENT_BUFFER_CREATE_INVALID');
  const id=created.id;
  const history=await ask('BEN','M6_CLIENT_DRAFT_HISTORY',
   '/budget/customer/projects/'+project+'/versions/'+id,200);
  need(history?.version?.id===id&&history.version.currentEditNo===1,
   'M6_CLIENT_BUFFER_HISTORY_INVALID');
  const edit=history.version.edits?.find(x=>x.editNo===1);
  need(edit?.lines?.length===1&&decimal(String(edit.lines[0]?.quantity))&&
   q4(String(edit.lines[0].quantity))===q4(quantity)&&
   decimal(String(edit.lines[0]?.pricingSnapshot?.bufferQuantity))&&
   q4(String(edit.lines[0].pricingSnapshot.bufferQuantity))===q4(buffer)&&
   decimal(String(edit.lines[0]?.pricingSnapshot?.rawQuantity))&&
   q4(String(edit.lines[0].pricingSnapshot.rawQuantity))===q4(String(line.quantity)),
   'M6_CLIENT_RAW_VS_BUFFER_MISMATCH');
  const clientSubmitted=await ask('BEN','M6_CLIENT_SUBMIT',
   '/budget/customer/projects/'+project+'/versions/'+id+'/submit',201,
   {requestId:keys.submit,expectedEditNo:1,workflowCode:'PROTO_M6_CLIENT_NANCY'});
  need(clientSubmitted?.id===id&&clientSubmitted.approvalState==='SUBMITTED',
   'M6_CLIENT_NOT_SUBMITTED');
  const nancyHistory=await ask('NANCY','M6_NANCY_APPROVAL_READ',
   '/budget/customer/projects/'+project+'/versions/'+id,200);
  need(nancyHistory?.allowedActions?.decide===true&&uuid(nancyHistory.version?.approvalInstanceId),
   'M6_NANCY_NOT_AUTHORIZED_TO_APPROVE');
  await client.call(sessions.BEN,'M6_BEN_CLIENT_SELF_APPROVAL_DENIED',
   '/budget/customer/projects/'+project+'/versions/'+id+'/decision',403,
   {requestId:randomUUID(),expectedInstanceId:nancyHistory.version.approvalInstanceId,decision:'APPROVE'});
  const decision=await ask('NANCY','M6_NANCY_CLIENT_APPROVE',
   '/budget/customer/projects/'+project+'/versions/'+id+'/decision',201,
   {requestId:keys.decide,expectedInstanceId:nancyHistory.version.approvalInstanceId,
    decision:'APPROVE',comment:'Independent synthetic Client BOQ buffer approval'});
  need(decision?.id===id&&decision.approvalState==='APPROVED','M6_CLIENT_NOT_APPROVED');
  result={status:'M6_DEC054_COST_AND_BUFFERED_CLIENT_BOQ_HTTP_VERIFIED',
   benCostSelfApprovalVerified:true,quantityOnlyHasNoMoney:true,
   bufferedClientRawAndBufferVerified:true,nancyIndependentClientApprovalVerified:true,
   noOriginalCostBoqReplayed:true,syntheticOnly:true,sourceCostRevisionId:costId,
   clientBoqVersionId:id,productionAuthorized:false,humanUatCompleted:false,
   actualMacDeploymentVerified:false};
 }catch(e){error=e;}
 finally{for(const k of ['STORE_SITE','NANCY','BEN'])if(sessions[k]){
  try{await client.logout('M6_BOQ_'+k,sessions[k]);
   await client.call(sessions[k],'M6_BOQ_'+k+'_REVOKED','/auth/me',401);
  }catch(e){error??=e;}
 }}
 if(error)throw error;
 return {...result,sessionsRevoked:true};
}
