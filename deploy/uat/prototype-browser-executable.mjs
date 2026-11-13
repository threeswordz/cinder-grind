// Bounded Mac executable custody. Never chmod or execute a writable installation.
import {homedir} from 'node:os';
import {join,dirname,relative,isAbsolute} from 'node:path';
import {lstat,realpath,readdir,mkdtemp,chmod,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {safeEnvironment} from './prototype-actors.mjs';

const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const execute=promisify(execFile);
// Google's published Developer-ID requirement, restricted to stable Chrome.
export const GOOGLE_REQUIREMENT='identifier "com.google.Chrome" and anchor apple generic and '+
  'certificate 1[field.1.2.840.113635.100.6.2.6] and '+
  'certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = "EQHXZ8M8AV"';
async function command(exe,args){
  try{await execute(exe,args,{env:safeEnvironment(),timeout:120000,maxBuffer:1048576});}
  catch{demand(false,'BROWSER_SIGNATURE_OR_COPY_FAILED');}
}
const inside=(root,path)=>{const r=relative(root,path);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'));};
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.mode===b.mode&&a.uid===b.uid;
export function browserCandidates(home=homedir()){
  return ['/Applications',join(home,'Applications')].flatMap(parent=>[
    join(parent,'Google Chrome.app','Contents','MacOS','Google Chrome'),
    join(parent,'Chromium.app','Contents','MacOS','Chromium')]);
}
export function executablePolicy(s,uid,google){
  if(!s.isFile()||s.isSymbolicLink()||![0,uid].includes(s.uid)||!(s.mode&0o111)||(s.mode&0o7000))return null;
  if(!(s.mode&0o022))return 'installed';
  return google&&s.uid===uid&&(s.mode&0o777)===0o775?'private-copy':null;
}
async function signature(app,run){
  // Without '=', codesign treats this argument as a requirement FILE path.
  await run('/usr/bin/codesign',['--verify','--deep','--strict','--all-architectures','-R','='+GOOGLE_REQUIREMENT,app]);
}
// Do not follow directory links during traversal. Framework links must resolve
// within this same bundle; sockets/devices/FIFOs, special bits and world writes fail.
export async function auditBundle(app,{uid=process.getuid(),copied=false,protect=false}={}){
  demand(await realpath(app)===app,'BROWSER_BUNDLE_PATH_UNSAFE');
  const visit=async path=>{
    const s=await lstat(path);
    demand((copied?s.uid===uid:[0,uid].includes(s.uid)),'BROWSER_BUNDLE_OWNER_UNSAFE');
    if(s.isSymbolicLink()){
      demand(path!==app&&inside(app,await realpath(path)),'BROWSER_BUNDLE_LINK_ESCAPES');return;
    }
    demand((s.isFile()||s.isDirectory())&&!(s.mode&0o7000)&&!(s.mode&0o002),'BROWSER_BUNDLE_ENTRY_UNSAFE');
    demand(await realpath(path)===path,'BROWSER_BUNDLE_PATH_UNSAFE');
    if(copied&&s.isFile())demand(s.nlink===1,'BROWSER_COPY_HARDLINK_REFUSED');
    if(protect){demand(copied,'BROWSER_SOURCE_PERMISSION_CHANGE_REFUSED');await chmod(path,s.isDirectory()?0o700:s.mode&0o700);}
    if(copied&&!protect)demand(!(s.mode&0o077),'BROWSER_COPY_PERMISSIONS_UNSAFE');
    if(s.isDirectory())for(const name of await readdir(path))await visit(join(path,name));
  };
  const root=await lstat(app);demand(root.isDirectory()&&!root.isSymbolicLink(),'BROWSER_BUNDLE_PATH_UNSAFE');
  await visit(app);
}
export async function inspectExecutable(candidate,{home=homedir(),uid=process.getuid(),run=command}={}){
  demand(browserCandidates(home).includes(candidate),'BROWSER_EXECUTABLE_PATH_NOT_APPROVED');
  const s=await lstat(candidate),app=dirname(dirname(dirname(candidate)));
  const google=candidate.endsWith('/Google Chrome.app/Contents/MacOS/Google Chrome');
  const strategy=executablePolicy(s,uid,google);
  demand(strategy&&await realpath(candidate)===candidate&&await realpath(app)===app,'BROWSER_EXECUTABLE_UNSAFE');
  if(strategy==='private-copy'){
    await auditBundle(app,{uid});await signature(app,run);
    demand(same(s,await lstat(candidate)),'BROWSER_INSTALLATION_CHANGED');
  }
  return {executable:candidate,app,strategy,identity:s};
}
export async function discoverBrowser(options={}){
  for(const candidate of browserCandidates(options.home)){
    try{return await inspectExecutable(candidate,options);}
    catch(e){
      if(e.code==='ENOENT'||e.safeCode==='BROWSER_EXECUTABLE_UNSAFE')continue;
      throw e;
    }
  }
  demand(false,'EXISTING_CHROME_OR_CHROMIUM_REQUIRED');
}
export async function prepareBrowser(selection,parent,{home=homedir(),uid=process.getuid(),run=command}={}){
  // Re-derive every security decision; never trust a caller-supplied strategy.
  const fresh=await inspectExecutable(selection.executable,{home,uid,run});
  demand(same(selection.identity,fresh.identity)&&selection.strategy===fresh.strategy,'BROWSER_INSTALLATION_CHANGED');
  if(fresh.strategy==='installed')return {executable:fresh.executable,cleanup:async()=>{}};
  const p=await lstat(parent);
  demand(p.isDirectory()&&!p.isSymbolicLink()&&p.uid===uid&&!(p.mode&0o077)&&await realpath(parent)===parent,
    'BROWSER_COPY_PARENT_UNSAFE');
  const owned=await mkdtemp(join(parent,'browser-app-'));await chmod(owned,0o700);
  const identity=await lstat(owned),copy=join(owned,'Google Chrome.app');let cleaned=false;
  const cleanup=async()=>{
    if(cleaned)return;
    const s=await lstat(owned);
    demand(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===uid&&!(s.mode&0o077)&&
      s.dev===identity.dev&&s.ino===identity.ino&&await realpath(owned)===owned,'BROWSER_COPY_CLEANUP_IDENTITY_CHANGED');
    await rm(owned,{recursive:true,force:false});cleaned=true;
  };
  try{
    // Preserve signature resources, extended attributes and quarantine. Omit
    // inherited source ACLs; only this new owned copy has permissions narrowed.
    await run('/usr/bin/ditto',['--rsrc','--extattr','--qtn','--noacl',fresh.app,copy]);
    await auditBundle(copy,{uid,copied:true,protect:true});
    await auditBundle(copy,{uid,copied:true});await signature(copy,run);
    demand(same(fresh.identity,await lstat(fresh.executable)),'BROWSER_INSTALLATION_CHANGED');
    const executable=join(copy,'Contents','MacOS','Google Chrome'),s=await lstat(executable);
    demand(executablePolicy(s,uid,true)==='installed'&&await realpath(executable)===executable,'BROWSER_COPY_EXECUTABLE_UNSAFE');
    return {executable,cleanup};
  }catch(e){await cleanup();throw e;}
}
