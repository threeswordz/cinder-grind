#!/usr/bin/env node
// Guarded one-shot ORIGINAL MAC entry for milestone 6. Never triggers GitHub CI.
// --execute requires independently-reviewed, integrated main evidence plus
// explicit per-release Owner approval, original UOM custody and no prior attempt.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {realpath,lstat,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createM6MacRuntime,M6_MAC_SOURCE} from './prototype-m6-mac-runtime.mjs';
import {makeM6PrivateStage} from './prototype-m6-private-stage.mjs';
import {executeOneShotM6} from './prototype-m6-deployment-sequence.mjs';
import {createM6BusinessStages} from './prototype-m6-business-stages.mjs';
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const SHA=/^[a-f0-9]{40}$/;
const sourceRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const root=join(homedir(),'Construction-ERP-Prototype-Runtime');
function cleanCmd(bin,args,cwd){return execFileSync(bin,args,{cwd,encoding:'utf8',timeout:45000,
  env:Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),
  maxBuffer:2097152,stdio:['ignore','pipe','pipe']}).trim();}
async function ticketFile(path){const s=await lstat(path);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&
  !(s.mode&0o077)&&s.size>0&&s.size<=65536,'M6_RELEASE_TICKET_NOT_PRIVATE');return JSON.parse(await readFile(path,'utf8'));}
async function releaseAuthority(sha){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&
   !Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),
   'M6_ORIGINAL_MAC_EXECUTION_REQUIRED');
 need(cleanCmd('git',['rev-parse','HEAD'],sourceRoot)===sha&&
   cleanCmd('git',['status','--porcelain'],sourceRoot)===''&&
   ['https://github.com/threeswordz/cinder-grind.git','https://github.com/threeswordz/cinder-grind']
     .includes(cleanCmd('git',['remote','get-url','origin'],sourceRoot)),
   'M6_RELEASE_SOURCE_NOT_EXACT');
 // Read-only network confirmation, NOT CI, rerun, workflow dispatch or merge.
 const main=cleanCmd('git',['ls-remote','origin','refs/heads/main'],sourceRoot).split(/\s+/);
 need(main.length===2&&main[0]===sha&&main[1]==='refs/heads/main',
   'M6_RELEASE_NOT_IN_ACTUAL_MAIN');
 const ticket=await ticketFile(join(root,'m6-release-authorization-private.json'));
 need(ticket?.releaseSha===sha&&ticket?.previousApplicationSha===M6_MAC_SOURCE&&
   ticket.exactMainIntegrated===true&&ticket.independentReviewComplete===true&&
   ticket.requiredReleaseProofSatisfied===true&&ticket.ownerApprovedThisOneShot===true&&
   ticket.syntheticOnly===true&&ticket.productionAuthorized===false&&
   typeof ticket.reviewEvidenceUrl==='string'&&ticket.reviewEvidenceUrl.startsWith('https://github.com/threeswordz/cinder-grind/')&&
   typeof ticket.releaseEvidenceUrl==='string'&&ticket.releaseEvidenceUrl.startsWith('https://github.com/threeswordz/cinder-grind/'),
   'M6_OWNER_OR_RELEASE_EVIDENCE_NOT_AUTHORIZED');
 return {sourceSha:M6_MAC_SOURCE,releaseSha:sha,isolatedSynthetic:true,productionConnected:false,
   exactMainReleased:true,independentlyReviewed:true,requiredReleaseProofSatisfied:true,
   priorUomReceiptVerified:true,originalMacCustodyVerified:true,noActiveSessions:true,
   authorizedForOneShot:true,noPriorM6Attempt:true};
}
export async function resolveM6FinanceSource({binding,db}){
 const f=binding.fixture;
 // Read only the posted, unreversed, independently approved canonical GR/PO.
 // Never re-create a PR, PO, GR or any UOM business object.
 const rows=await db.goodsReceiptItem.findMany({where:{
  goodsReceipt:{companyId:f.companyId,projectId:f.projectId,postedAt:{not:null},reversedAt:null},
  supplierInvoiceItems:{none:{}}
 },include:{goodsReceipt:{include:{approvalInstance:true,purchaseOrder:{include:{approvalInstance:true}}}},purchaseOrderLine:true},take:200});
 const viable=rows.filter(x=>x.goodsReceipt.approvalInstance?.approvalState==='APPROVED'&&
  x.goodsReceipt.purchaseOrder.approvalInstance?.approvalState==='APPROVED'&&
  x.goodsReceipt.purchaseOrder.cancelledAt===null&&
  x.goodsReceipt.purchaseOrder.supplierId===x.goodsReceipt.supplierId&&
  x.goodsReceipt.purchaseOrder.currencyCode==='THB'&&
  x.purchaseOrderLine.purchaseOrderId===x.goodsReceipt.purchaseOrderId&&
  Number(x.quantity)>0&&Number(x.purchaseOrderLine.amount)>=1);
 need(viable.length>0,'M6_APPROVED_UNINVOICED_PO_GR_SOURCE_NOT_FOUND');
 viable.sort((a,b)=>a.id.localeCompare(b.id));const x=viable[0];
 const isoDate=new Date().toISOString().slice(0,10);
 return {approvedPoAndGoodGrVerified:true,noProcurementReplay:true,source:{
   supplierId:x.goodsReceipt.supplierId,purchaseOrderLineId:x.purchaseOrderLineId,
   goodsReceiptItemId:x.id,amount:'1.00',invoiceDate:isoDate,paymentDate:isoDate,
   currencyCode:'THB',supplierReference:'PROTO_M6_'+String(x.id).slice(0,8).toUpperCase(),syntheticOnly:true}};
}
export async function resolveM6HrSource({binding,db}){
 const f=binding.fixture,employeeId=binding.actors.KOH.employeeId;
 const employee=await db.employee.findFirst({where:{id:employeeId,companyId:f.companyId,isActive:true}});
 need(!!employee,'M6_SYNTHETIC_HR_EMPLOYEE_NOT_FOUND');
 const types=await db.documentType.findMany({where:{companyId:f.companyId,isActive:true},orderBy:{documentTypeCode:'asc'},take:100});
 need(types.length>0,'M6_HR_DOCUMENT_TYPE_MISSING');
 const type=types.find(x=>x.documentTypeCode.startsWith('PROTO_'))??types[0];
 const latest=await db.hrDocumentAttachment.findFirst({where:{companyId:f.companyId,employeeId},orderBy:{version:'desc'}});
 return {employeeId,documentTypeId:type.id,expectedVersion:latest?.version??0,syntheticOnly:true};
}
export async function runM6MacOperator(mode,releaseSha){
 need(['--inspect','--execute'].includes(mode)&&SHA.test(releaseSha??''),
   'M6_EXPLICIT_PINNED_MODE_REQUIRED');
 if(mode==='--inspect'){
  const runtime=createM6MacRuntime({releaseSha,sourceRoot,root});
  const p=await runtime.inspected();
  return {...p,status:'M6_MAC_PRESERVED_READ_ONLY_PREFLIGHT_PASS',
   macDeploymentVerified:false,humanUatCompleted:false,productionAuthorized:false};
 }
 const input=await releaseAuthority(releaseSha);
 const runtime=createM6MacRuntime({releaseSha,sourceRoot,root});
 const custody=makeM6PrivateStage(root,M6_MAC_SOURCE,releaseSha);
 let stages;
 function business(){need(stages,'M6_UPGRADE_BEFORE_BUSINESS_REQUIRED');return stages;}
 const adapter={
  readOnlyPreflight:async()=>runtime.inspected(),
  claim:async a=>custody.claim(a),
  recordPhase:async(name,result)=>custody.recordPhase(name,result),
  upgrade:async context=>{
   const upgraded=await runtime.upgrade(context);
   stages=createM6BusinessStages({releaseSha,db:runtime.db,
     binding:runtime.binding,priorUomReceipt:runtime.priorUomReceipt,
     resolveFinanceSource:resolveM6FinanceSource,resolveHrSource:resolveM6HrSource,
     verifyEncryptedHrAttachment:args=>runtime.verifyEncryptedHrAttachment(args)});
   return upgraded;
  },
  configure:context=>business().configure(context),
  finance:context=>business().finance(context),
  hr:context=>business().hr(context),
  boq:context=>business().boq(context),
  preserve:context=>runtime.preserve(context),
  seal:context=>custody.seal(context),
 };
 try{return await executeOneShotM6({inputs:input,adapter});}
 finally{await runtime.close();}
}
const path=process.argv[1]?await realpath(resolve(process.argv[1])).catch(()=>null):null;
if(path===await realpath(new URL(import.meta.url))){
 try{
  need(process.argv.length===4,'M6_EXPLICIT_MODE_AND_RELEASE_SHA_REQUIRED');
  const result=await runM6MacOperator(process.argv[2],process.argv[3]);
  console.log(JSON.stringify(result));
 }catch(error){
  console.log(JSON.stringify({status:'M6_MAC_OPERATOR_STOPPED_PRESERVE_DO_NOT_RETRY',
   safeCode:/^[A-Z0-9_]+$/.test(error.safeCode??'')?error.safeCode:'M6_PRIVATE_OPERATOR_FAILURE',
   automaticRetryAllowed:false,milestone6Accepted:false,productionAuthorized:false}));
  process.exitCode=1;
 }
}
