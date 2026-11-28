// Event294 recovery only: preserve the failed runtime and adopt its two files.
// Never copy back to the source, overwrite, or silently accept unknown additions.
import {cp,lstat,realpath,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {hasEvent294Authority,recoveryAnchor,validateRecoveredDispatch} from './m6-residual-recovery-authority.mjs';
import {verifyResidualDocumentDelta} from './m6-residual-document-delta.mjs';
import {captureResidualNativeEvidence} from './m6-residual-native-evidence.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RECOVERY_FILES_'+c),{safeCode:'M6_RECOVERY_FILES_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),kinds=['documents','uploads','hrkeys'];
const fields=x=>({id:x.id,actorUserId:x.actorUserId,projectId:x.projectId,entityId:x.entityId,entityType:x.entityType,sha256:x.sha256,size:x.size});
const shape=x=>uuid(x?.id)&&uuid(x.actorUserId)&&uuid(x.projectId)&&uuid(x.entityId)&&hex(x.sha256)&&Number.isSafeInteger(x.size)&&x.size>0&&x.size<=1048576;
const fits=(d,s,projectId)=>shape(d)&&d.projectId===projectId&&['actorUserId','entityType','entityId','sha256','size'].every(k=>d[k]===s[k]);
export function createRecoveryFileRegistry({ctx,plan,roster,authorization,recoveredDispatch,recoveredReceipt}){
 const d=validateRecoveredDispatch(plan,authorization,recoveredDispatch),f=ctx.fixture;
 need(uuid(f?.companyId)&&uuid(f.projectId)&&plan.companyId===f.companyId&&plan.projectId===f.projectId&&uuid(roster?.STORE_SITE?.userId)&&uuid(roster?.JAI?.userId)&&plan.uploads.every(s=>roster[s.actor]?.userId===s.actorUserId),'SCOPE');
 const receipt={...recoveredReceipt,actorUserId:roster.STORE_SITE.userId,projectId:f.projectId,entityType:'MATERIAL_REQUEST'},spec=plan.uploads.find(x=>x.key==='dispatch'),dispatch={...d,actorUserId:roster.JAI.userId,projectId:f.projectId,entityType:'PURCHASE_ORDER'};
 need(shape(receipt)&&uuid(recoveredReceipt.storageKey)&&receipt.id!==d.id&&receipt.storageKey!==d.storageKey&&receipt.sha256!==d.sha256&&fits(dispatch,spec,f.projectId),'ADOPTED');
 const initial=[fields(receipt),fields(dispatch)],planned=plan.uploads.filter(x=>x.key!=='dispatch'),registered=new Map();let sealed=false;
 need(planned.length===4&&same(planned.map(x=>x.key).sort(),['ack','delay','handover','transit']),'PLAN');
 const expected=()=>[...initial,...[...registered.values()].map(fields)];
 return {companyId:f.companyId,async registerUploaded(x){const p=planned.find(s=>s.key===x?.key);need(!sealed&&p&&fits(x,p,f.projectId)&&!registered.has(x.key)&&!expected().some(y=>y.id===x.id),'UPLOAD');registered.set(x.key,structuredClone(x));},seal(files){need(!sealed&&registered.size===4&&Array.isArray(files)&&files.length===5&&files.filter(x=>x.key==='dispatch'&&same(fields(x),initial[1])).length===1&&planned.every(p=>files.filter(x=>x.key===p.key&&same(fields(x),fields(registered.get(p.key)))).length===1),'COMPLETE');sealed=true;return {documentFilesAdded:4,recoveredFilesAdopted:2,totalResidualFiles:6};},async readDelta(){const wanted=expected();const result=await captureResidualNativeEvidence({db:ctx.db,captureFixtureRows:ctx.captureFixtureRows,verifyRuntime:ctx.verifyCustody,companyId:f.companyId,projectId:f.projectId,selection:{documents:wanted}});return {expected:structuredClone(wanted),documents:result.documents};}};
}
async function privateDir(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'DIRECTORY');}
export async function admitRecoveryRuntimeFiles({stage,recovery,priorRuntime,authorization,inventory,residualDocuments}){
 const parent=dirname(stage);
 need(hasEvent294Authority(authorization)&&typeof stage==='string'&&resolve(stage)===stage&&parent.endsWith('/m6-successor-'+recoveryAnchor.previousApplicationSha)&&stage===join(parent,'event294-residual-continuation-runtime')&&priorRuntime===join(parent,'event266-residual-runtime')&&recovery===join(parent,'recovery')&&typeof inventory==='function'&&typeof residualDocuments?.readDelta==='function'&&uuid(residualDocuments.companyId),'CONTEXT');
 await privateDir(parent);await privateDir(recovery);await privateDir(priorRuntime);
 const read=async root=>Object.fromEntries(await Promise.all(kinds.map(async k=>[k,await inventory(join(root,k))])));
 const baseline=await read(recovery),prior=await read(priorRuntime),delta=await residualDocuments.readDelta();
 need(delta.expected.length===2&&delta.expected.filter(x=>x.entityType==='MATERIAL_REQUEST').length===1&&delta.expected.filter(x=>x.entityType==='PURCHASE_ORDER').length===1,'ADOPTED_COUNT');
 verifyResidualDocumentDelta({before:baseline,after:prior,recovery:baseline,...delta,companyId:residualDocuments.companyId});
 const admitted=structuredClone(delta.expected);let copied=false;
 async function unchanged(){need(same(baseline,await read(recovery))&&same(prior,await read(priorRuntime)),'SOURCE_DRIFT');}
 return {async copy(){need(!copied,'NO_REPLAY');copied=true;await privateDir(stage);await unchanged();for(const k of kinds){const target=join(stage,k);await mkdir(target,{mode:0o700});await cp(join(priorRuntime,k),target,{recursive:true,force:false,errorOnExist:true});}need(same(prior,await read(stage)),'COPY');await unchanged();},async verify(){need(copied,'NOT_COPIED');await unchanged();const current=await read(stage),next=await residualDocuments.readDelta();need(next.expected.length>=2&&next.expected.length<=6&&same(next.expected.slice(0,2),admitted),'ADOPTED_DRIFT');verifyResidualDocumentDelta({before:baseline,after:current,recovery:baseline,...next,companyId:residualDocuments.companyId});await unchanged();return current;}};
}
