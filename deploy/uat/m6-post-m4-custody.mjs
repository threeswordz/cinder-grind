// Read-only historical receipt adapter. Never authorizes a runtime write or replay.
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
export const M4_CUSTODY=Object.freeze({
  source:'5535dd890fd84489d76b611929e70e3422c746e8',
  target:'9417f07c609dbc091b5bbe2e09071c5e2c316459',
  tree:'bfcab1977ef80b8d7becf00d0056e892250052aa',
  fullMainRun:45857511934,stage:'m4-upgrade-9417f07c',
});
const roles=Object.freeze(['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH']);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export function verifyM4HistoricalReceipts(cutover,role){
  const m=M4_CUSTODY;
  need(cutover?.status==='M4_CUTOVER_AND_RUNTIME_READY_PASS'&&
    cutover.source===m.source&&cutover.target===m.target&&cutover.tree===m.tree&&
    cutover.fullMainRun===m.fullMainRun&&cutover.originalTables===168&&cutover.migrations===177&&
    cutover.sourceDataPreserved===true&&cutover.protectedFilesPreserved===true&&
    cutover.runtimeOwned===true&&cutover.roleVerificationComplete===false&&
    cutover.humanUatCompleted===false&&cutover.productionAuthorized===false,
    'M6_M4_CUTOVER_RECEIPT_INVALID');
  need(role?.status==='M4_EIGHT_SYNTHETIC_ROLES_READBACK_PASS'&&
    Array.isArray(role.roles)&&role.roles.length===roles.length&&
    roles.every(r=>role.roles.includes(r))&&role.historicalPornAssignmentVerified===true&&
    role.productionAuthorized===false,'M6_M4_ROLE_RECEIPT_INVALID');
  return {sourceSha:m.target,tree:m.tree,fullMainRun:m.fullMainRun,
    historicalCutoverReceiptMatched:true,historicalRoleReceiptMatched:true,
    liveRuntimeVerified:false,mayMutate:false,milestone6Accepted:false,productionAuthorized:false};
}
async function ownedDirectory(path,privateOnly=true){
  const s=await lstat(path);
  need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&
    !(s.mode&(privateOnly?0o077:0o022))&&await realpath(path)===path,
    'M6_M4_CUSTODY_DIRECTORY_INVALID');
}
async function privateReceipt(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const s=await f.stat();
    need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&
      s.size>0&&s.size<=1048576,'M6_M4_CUSTODY_RECEIPT_NOT_PRIVATE');
    const bytes=Buffer.alloc(s.size+1);const {bytesRead}=await f.read(bytes,0,bytes.length,0);
    need(bytesRead===s.size,'M6_M4_CUSTODY_RECEIPT_CHANGED');
    const after=await f.stat();
    need(after.size===s.size&&after.mtimeMs===s.mtimeMs&&after.ctimeMs===s.ctimeMs,
      'M6_M4_CUSTODY_RECEIPT_CHANGED');
    return JSON.parse(bytes.subarray(0,bytesRead).toString('utf8'));
  }finally{await f.close();}
}
export async function inspectM4HistoricalCustody(root){
  need(typeof root==='string'&&resolve(root)===root,'M6_M4_CUSTODY_ROOT_INVALID');
  const stage=join(root,M4_CUSTODY.stage),cutover=join(stage,'cutover'),
    readback=join(stage,'role-readback'),rehearsal=join(stage,'rehearsal'),
    application=join(rehearsal,'application');
  for(const path of [root,stage,cutover,readback,rehearsal])await ownedDirectory(path);
  await ownedDirectory(application,false);
  const result=verifyM4HistoricalReceipts(await privateReceipt(join(cutover,'cutover-ready.json')),
    await privateReceipt(join(readback,'continuation-ready.json')));
  return { ...result, application };
}
