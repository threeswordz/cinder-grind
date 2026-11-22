// Original-Mac M6 private create-once stage custody.
// Strictly writes a NEW M6 stage only; never changes/deletes runtime,
// documents, HR keys, migrations, or completed predecessor upgrade stages.
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {lstat,mkdir,open,readFile,realpath} from 'node:fs/promises';
import {M6_ORDER} from './prototype-m6-deployment-sequence.mjs';

const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const sha=/^[a-f0-9]{40}$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const names=M6_ORDER.filter(n=>n!=='seal');

async function safeDirectory(path){
 const info=await lstat(path);
 need(info.isDirectory()&&!info.isSymbolicLink()&&info.uid===process.getuid()&&
   (info.mode&0o077)===0&&await realpath(path)===path,'M6_PRIVATE_DIRECTORY_UNSAFE');
}
async function privateJson(path){
 const s=await lstat(path);
 need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&
   (s.mode&0o077)===0&&s.size>0&&s.size<=65536,'M6_PRIVATE_RECEIPT_UNSAFE');
 return JSON.parse(await readFile(path,'utf8'));
}
async function createOnce(path,object){
 const fd=await open(path,'wx',0o600);
 try{await fd.writeFile(JSON.stringify(object)+'\n','utf8');await fd.sync();}
 finally{await fd.close();}
}
export function makeM6PrivateStage(root,sourceSha,releaseSha){
 need(typeof root==='string'&&resolve(root)===root&&
   sha.test(sourceSha??'')&&sha.test(releaseSha??'')&&sourceSha!==releaseSha,
   'M6_STAGE_INPUT_INVALID');
 const stage=join(root,'m6-upgrade');
 let owned=false,phaseIndex=0;
 return {
   async claim(authority){
     need(!owned&&authority?.sourceSha===sourceSha&&authority?.releaseSha===releaseSha,
       'M6_CLAIM_IDENTITY_OR_REPLAY');
     await safeDirectory(root);
     // mkdir without recursive and with mode 0700 is atomic exclusive.
     // EEXIST is final refusal: never delete, overwrite or retry.
     await mkdir(stage,{mode:0o700});
     owned=true;
     await safeDirectory(stage);
     await createOnce(join(stage,'started.json'),{status:'M6_CREATE_ONCE_STARTED',
       sourceSha,releaseSha,productionAuthorized:false,automaticRetryAllowed:false});
     return {claimed:true,newlyCreated:true,releaseSha};
   },
   async recordPhase(name,result){
     need(owned&&name===names[phaseIndex]&&result?.ok===true&&
       result.releaseSha===releaseSha,'M6_PHASE_SEQUENCE_OR_EVIDENCE_INVALID');
     await safeDirectory(stage);
     const original=await privateJson(join(stage,'started.json'));
     need(original.status==='M6_CREATE_ONCE_STARTED'&&original.sourceSha===sourceSha&&
       original.releaseSha===releaseSha,'M6_STAGE_CLAIM_TAMPERED');
     await createOnce(join(stage,'phase-'+name+'.json'),{status:'M6_PHASE_RECORDED',
       name,releaseSha,proofSha256:digest(result),productionAuthorized:false});
     phaseIndex++;
   },
   async seal({authority,results}){
     need(owned&&phaseIndex===names.length&&authority?.releaseSha===releaseSha&&
       results&&typeof results==='object','M6_SEAL_PRECONDITIONS_INVALID');
     await safeDirectory(stage);
     for(const name of names){
       const file=await privateJson(join(stage,'phase-'+name+'.json'));
       need(file.name===name&&file.releaseSha===releaseSha&&
         file.status==='M6_PHASE_RECORDED'&&file.proofSha256===digest(results[name]),
         'M6_PRIVATE_PHASE_TAMPERED');
     }
     await createOnce(join(stage,'ready.json'),{status:'M6_NEW_JOURNEYS_SEALED_FOR_TECHNICAL_REVIEW',
       sourceSha,releaseSha,stageCount:names.length,automaticRetryAllowed:false,
       milestone6Accepted:false,humanUatCompleted:false,productionAuthorized:false});
     return {ok:true,releaseSha};
   },
 };
}
