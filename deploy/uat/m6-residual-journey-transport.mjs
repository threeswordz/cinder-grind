// Restricted successor-only HTTP transport. Sessions are borrowed, never created here.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_TRANSPORT_'+c),{safeCode:'M6_RESIDUAL_TRANSPORT_'+c});};
const API='http://127.0.0.1:33072',WEB='http://127.0.0.1:44172';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
async function bounded(r,max){const reader=r.body?.getReader();need(reader,'BODY');const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.byteLength;need(size<=max,'LIMIT');}return Buffer.concat(chunks);}finally{for(const c of chunks)c.fill(0);await reader.cancel().catch(()=>{});reader.releaseLock();}}
export function createResidualJourneyTransport({binding,sessions,verifyRuntime,receiptBytes,fetchImpl=fetch,origin=API,webOrigin=WEB}){
 const b=structuredClone(binding),actors=['BEN','KHAIMOOK','FOREMAN','JAI','STORE_SITE'];
 need(origin===API&&webOrigin===WEB&&[verifyRuntime,fetchImpl].every(f=>typeof f==='function')&&sessions instanceof Map,'CONTEXT');
 need(b&&['projectId','foreignProjectId','orderId','denialOrderId','quantityActivityId','milestoneActivityId','documentTypeId'].every(k=>uuid(b[k]))&&new Set(['projectId','foreignProjectId','orderId','denialOrderId','quantityActivityId','milestoneActivityId','documentTypeId'].map(k=>b[k])).size===7,'BINDING');
 need(receiptBytes instanceof Uint8Array&&receiptBytes.length>0&&receiptBytes.length<=1048576&&hash(receiptBytes)===b.documentSha256,'RECEIPT');
 const file=Buffer.from(receiptBytes),local=new Map();for(const k of actors){const s=sessions.get(k);need(/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(s?.cookie??'')&&/^[A-Za-z0-9_-]{20,256}$/.test(s?.csrf??''),'SESSION');local.set(k,{cookie:s.cookie,csrf:s.csrf});}need(new Set([...local.values()].map(s=>s.cookie)).size===actors.length,'SESSION_ALIAS');
 let requestId,issueId,planId,docId,closed=false;const seen=new Set();const mr='/inventory/material-requests',mi='/inventory/material-issues',mp='/inventory/material-plan-issues/issues/',fp='/project-progress-plans',sp='/procurement/purchase-orders/'+b.orderId+'/supplier-case',project='?projectId='+b.projectId,foreign='?projectId='+b.foreignProjectId;
 const target=()=>'/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/'+requestId;
 function route(actor,method,path,body){
  if(actor==='STORE_SITE'){
   if(method==='GET'&&path===mr+foreign)return {denial:true};
   if(method==='POST'&&path===mr&&!requestId&&body?.projectId===b.projectId)return {bind:'request'};
   if(method==='POST'&&path===mi&&!issueId&&body?.projectId===b.projectId)return {bind:'issue'};
   if(method==='GET'&&((requestId&&path===mr+'/'+requestId)||(issueId&&path===mi+'/'+issueId)))return {};
   if(method==='POST'&&issueId&&[mp+issueId+'/preview',mp+issueId+'/within-plan'].includes(path))return {};
   if(method==='POST'&&requestId&&[mr+'/'+requestId+'/issue-links',mr+'/'+requestId+'/receipts'].includes(path))return {};
  }
  if(actor==='BEN'&&method==='GET'&&[fp+project,fp+'/current'+project,fp+'/current'+foreign].includes(path))return {denial:path.endsWith(foreign)};
  if(actor==='KHAIMOOK'&&method==='GET'&&path===fp+'/options'+project)return {};
  if(actor==='KHAIMOOK'&&method==='POST'&&path===fp+'/prepare'&&!planId&&body?.projectId===b.projectId)return {bind:'plan'};
  if(['BEN','KHAIMOOK'].includes(actor)&&method==='POST'&&planId&&path===fp+'/'+planId+'/confirm')return {denial:actor==='KHAIMOOK'};
  if(actor==='FOREMAN'&&method==='POST'&&planId&&path===fp+'/activity/'+b.quantityActivityId+'/quantity'&&body?.expectedPlanId===planId)return {denial:body.expectedPlanVersion!==1};
  if(actor==='FOREMAN'&&method==='POST'&&path==='/activity-progress/'+b.milestoneActivityId)return {};
  if(actor==='JAI'&&method==='GET'&&path==='/procurement/purchase-orders/'+b.denialOrderId+'/supplier-case')return {denial:true};
  if(['JAI','STORE_SITE','FOREMAN'].includes(actor)&&method==='GET'&&path===sp)return {denial:actor==='FOREMAN'};
  const supplier={JAI:['ACKNOWLEDGE','CONFIRM_IN_TRANSIT','REPORT_DELAY','JAI_RECORD_CLAIM'],STORE_SITE:['REPORT_DISCREPANCY','STORE_RECORD_RETURN_DISPATCH'],KHAIMOOK:['PM_REVIEW_DISCREPANCY']};
  if(method==='POST'&&path===sp+'/events'&&supplier[actor]?.includes(body?.action))return {};
  need(false,'ROUTE');
 }
 async function send(actor,method,path,body,kind,rule={}){
  need(!closed&&local.has(actor),'CLOSED');const s=local.get(actor);await verifyRuntime();const headers={Cookie:s.cookie,Origin:WEB,Accept:kind==='download'?'*/*':'application/json'};if(method==='POST')headers['x-csrf-token']=s.csrf;
  if(kind==='json'&&body!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(body);need(Buffer.byteLength(body)<=65536,'REQUEST_LIMIT');}
  let r;try{r=await fetchImpl(API+'/api/v1'+path,{method,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body})});}catch{need(false,'HTTP');}need(!r.redirected,'REDIRECT');const status=r.status;
  if(rule.denial||status!==(method==='GET'?200:201)){await r.body?.cancel();return {status};}
  if(kind==='download')return {status,bytes:await bounded(r,1048576)};
  need(r.headers.get('content-type')?.toLowerCase().startsWith('application/json'),'TYPE');const bytes=await bounded(r,1048576);try{const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));need(Object.hasOwn(envelope,'data'),'ENVELOPE');return {status,data:envelope.data};}finally{bytes.fill(0);}
 }
 return {async request({actor,method,path,body}){need(['GET','POST'].includes(method)&&typeof path==='string'&&(method==='GET'?body===undefined:body&&typeof body==='object'&&!Array.isArray(body)),'INPUT');const rule=route(actor,method,path,body),key=actor+' '+method+' '+path+' '+JSON.stringify(body);if(method==='POST'){need(!seen.has(key),'REPLAY');seen.add(key);}const r=await send(actor,method,path,body,'json',rule);if(rule.bind&&r.status===201){need(uuid(r.data?.id)&&![requestId,issueId,planId,docId].includes(r.data.id),'CREATED_ID');if(rule.bind==='request')requestId=r.data.id;if(rule.bind==='issue')issueId=r.data.id;if(rule.bind==='plan')planId=r.data.id;}return r;},async upload({actor,path,documentTypeId,expectedSha256}){need(actor==='STORE_SITE'&&requestId&&path===target()&&!docId&&documentTypeId===b.documentTypeId&&expectedSha256===b.documentSha256&&!seen.has('upload'),'UPLOAD');seen.add('upload');const form=new FormData();form.append('documentTypeId',documentTypeId);form.append('file',new Blob([file],{type:'application/pdf'}),'synthetic-m6-ss08-receipt.pdf');const r=await send(actor,'POST',path,form,'upload');if(r.status===201){need(uuid(r.data?.id)&&![requestId,issueId,planId].includes(r.data.id),'DOCUMENT_ID');docId=r.data.id;}return r;},async download({actor,path}){need(actor==='STORE_SITE'&&docId&&path===target()+'/'+docId+'/download','DOWNLOAD');return send(actor,'GET',path,undefined,'download');},close(){closed=true;file.fill(0);local.clear();}};
}
