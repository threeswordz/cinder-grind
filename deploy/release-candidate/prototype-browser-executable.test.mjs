import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,chmod,lstat,readdir,realpath,symlink,link,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GOOGLE_REQUIREMENT,executablePolicy,inspectExecutable,auditBundle,prepareBrowser} from '../uat/prototype-browser-executable.mjs';
import {startBrowser} from '../uat/prototype-browser.mjs';

const uid=process.getuid();
const stat=(mode,owner=uid,extra={})=>({mode,uid:owner,isFile:()=>true,isSymbolicLink:()=>false,...extra});
test('observed Chrome775 requires a private copy; existing protected executable policy is unchanged',()=>{
  // Reproduce the original rejection on the actual reported permission bits.
  assert.equal(!(0o775&0o022),false);
  assert.equal(executablePolicy(stat(0o100775),uid,true),'private-copy');
  for(const mode of [0o755,0o700,0o555])assert.equal(executablePolicy(stat(mode),uid,true),'installed');
  assert.equal(executablePolicy(stat(0o755,0),uid,false),'installed');
  for(const s of [stat(0o777),stat(0o776),stat(0o770),stat(0o6755),stat(0o644),stat(0o755,uid+101),
    stat(0o755,uid,{isFile:()=>false}),stat(0o755,uid,{isSymbolicLink:()=>true})])
    assert.equal(executablePolicy(s,uid,true),null);
  assert.equal(executablePolicy(stat(0o775),uid,false),null,'no unsigned Chromium exception');
  if(uid!==0)assert.equal(executablePolicy(stat(0o775,0),uid,true),null,'no root-owned writable exception');
});

async function fixture(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'erp-browser-custody-')));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const home=join(root,'home'),app=join(home,'Applications','Google Chrome.app'),parent=join(root,'runtime');
  await mkdir(join(app,'Contents','MacOS'),{recursive:true});await mkdir(parent,{mode:0o700});
  const executable=join(app,'Contents','MacOS','Google Chrome');
  await writeFile(executable,'SYNTHETIC_EXECUTABLE_NEVER_RUN',{mode:0o775});await chmod(executable,0o775);
  const versions=join(app,'Contents','Frameworks','Example.framework','Versions');
  await mkdir(join(versions,'A'),{recursive:true});await writeFile(join(versions,'A','resource'),'signed fixture');
  await symlink('A',join(versions,'Current'));
  const calls=[];
  // This runner asserts custody commands, not an actual Apple signature PASS.
  const run=async(exe,args)=>{
    calls.push({exe,args});
    if(exe==='/usr/bin/codesign'){
      assert.deepEqual(args.slice(0,-1),['--verify','--deep','--strict','--all-architectures','-R',GOOGLE_REQUIREMENT]);
      return;
    }
    assert.equal(exe,'/usr/bin/ditto');assert.deepEqual(args.slice(0,-2),['--rsrc','--extattr','--qtn','--noacl']);
    assert.equal(args.at(-2),app);
    await cp(app,args.at(-1),{recursive:true,verbatimSymlinks:true,errorOnExist:true,force:false});
  };
  return {root,home,app,parent,executable,calls,run,options:{home,uid,run}};
}
test('inspection verifies source without executing it, copying it or creating target files',async t=>{
  const f=await fixture(t),before=await readdir(f.parent),s=await lstat(f.executable);
  const selected=await inspectExecutable(f.executable,f.options);
  assert.equal(selected.strategy,'private-copy');assert.deepEqual(await readdir(f.parent),before);
  assert.equal((await lstat(f.executable)).mode,s.mode);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].exe,'/usr/bin/codesign');
});
test('private copy is owned, protected, signature-reverified and exclusively cleaned; source stays unchanged',async t=>{
  const f=await fixture(t),source=await lstat(f.executable),bytes=await readFile(f.executable);
  const selection=await inspectExecutable(f.executable,f.options);
  const prepared=await prepareBrowser(selection,f.parent,f.options);
  assert.notEqual(prepared.executable,f.executable);
  assert.equal((await lstat(prepared.executable)).mode&0o777,0o700);
  assert.equal((await lstat(f.executable)).mode,source.mode);
  assert.deepEqual(await readFile(f.executable),bytes);
  const dirs=await readdir(f.parent);assert.equal(dirs.length,1);
  assert.equal((await lstat(join(f.parent,dirs[0]))).mode&0o777,0o700);
  assert.equal(f.calls.filter(c=>c.exe==='/usr/bin/codesign').length,3);
  assert.equal(f.calls.at(-1).args.at(-1),join(f.parent,dirs[0],'Google Chrome.app'));
  await prepared.cleanup();await prepared.cleanup();assert.deepEqual(await readdir(f.parent),[]);
  assert.deepEqual(await readFile(f.executable),bytes);
});
test('protected installed executables require no private copy or new signature exception',async t=>{
  const f=await fixture(t);await chmod(f.executable,0o755);
  const selection=await inspectExecutable(f.executable,f.options),prepared=await prepareBrowser(selection,f.parent,f.options);
  assert.equal(selection.strategy,'installed');assert.equal(prepared.executable,f.executable);
  await prepared.cleanup();assert.deepEqual(f.calls,[]);assert.deepEqual(await readdir(f.parent),[]);
});
test('read-only source directories stay unchanged while owned copy remains safely cleanable',async t=>{
  const f=await fixture(t),resources=join(f.app,'Contents','Resources');
  await mkdir(resources);await writeFile(join(resources,'read-only'),'resource');await chmod(resources,0o555);
  try{
    const selection=await inspectExecutable(f.executable,f.options),prepared=await prepareBrowser(selection,f.parent,f.options);
    assert.equal((await lstat(resources)).mode&0o777,0o555);
    const copy=join(f.parent,(await readdir(f.parent))[0],'Google Chrome.app','Contents','Resources');
    assert.equal((await lstat(copy)).mode&0o777,0o700);
    await prepared.cleanup();assert.deepEqual(await readdir(f.parent),[]);
  }finally{await chmod(resources,0o755);}
});
test('wrong path, symlinked executable and changed source cannot enter the copy route',async t=>{
  const f=await fixture(t);
  await assert.rejects(inspectExecutable(join(f.root,'other-Chrome'),f.options),e=>e.safeCode==='BROWSER_EXECUTABLE_PATH_NOT_APPROVED');
  const selection=await inspectExecutable(f.executable,f.options);
  await writeFile(f.executable,'changed source bytes');
  await assert.rejects(prepareBrowser(selection,f.parent,f.options),e=>e.safeCode==='BROWSER_INSTALLATION_CHANGED');
  await rm(f.executable);await symlink(join(f.app,'Contents','Frameworks','Example.framework','Versions','A','resource'),f.executable);
  await assert.rejects(inspectExecutable(f.executable,f.options),e=>e.safeCode==='BROWSER_EXECUTABLE_UNSAFE');
  assert.deepEqual(await readdir(f.parent),[]);
});
test('source unsafe owner, world-write, special bits and escaping/broken bundle links fail before copy',async t=>{
  const f=await fixture(t),outside=join(f.root,'outside');await writeFile(outside,'private sentinel');
  await assert.rejects(auditBundle(f.app,{uid:uid+101}),e=>e.safeCode==='BROWSER_BUNDLE_OWNER_UNSAFE');
  for(const mode of [0o777,0o2755]){
    const file=join(f.app,'unsafe');await writeFile(file,'fixture');await chmod(file,mode);
    await assert.rejects(inspectExecutable(f.executable,f.options),e=>e.safeCode==='BROWSER_BUNDLE_ENTRY_UNSAFE');
    await rm(file);
  }
  for(const target of [outside,join(f.root,'missing')]){
    const file=join(f.app,'escape');await symlink(target,file);
    await assert.rejects(inspectExecutable(f.executable,f.options));await rm(file);
  }
  assert.deepEqual(await readdir(f.parent),[]);assert.equal(f.calls.length,0);
});
test('source signature refusal blocks without creating a copy or executing Chrome',async t=>{
  const f=await fixture(t);let calls=0;
  const run=async exe=>{calls++;assert.equal(exe,'/usr/bin/codesign');throw Object.assign(new Error(),{safeCode:'SIGNATURE_REFUSED'});};
  await assert.rejects(inspectExecutable(f.executable,{...f.options,run}),e=>e.safeCode==='SIGNATURE_REFUSED');
  assert.equal(calls,1);assert.deepEqual(await readdir(f.parent),[]);
});
test('copy tampering, escaped links and hardlinks are refused and only owned temporary copy is removed',async t=>{
  for(const kind of ['signature','link','hardlink']){
    const f=await fixture(t),selection=await inspectExecutable(f.executable,f.options);
    const outside=join(f.root,'untouched');await writeFile(outside,'private sentinel',{mode:0o640});
    const run=async(exe,args)=>{
      await f.run(exe,args);
      if(exe==='/usr/bin/ditto'){
        if(kind==='link')await symlink(outside,join(args.at(-1),'escape'));
        if(kind==='hardlink')await link(outside,join(args.at(-1),'hardlink'));
      }else if(kind==='signature'&&args.at(-1)!==f.app)throw Object.assign(new Error(),{safeCode:'COPY_SIGNATURE_REFUSED'});
    };
    await assert.rejects(prepareBrowser(selection,f.parent,{...f.options,run}));
    assert.deepEqual(await readdir(f.parent),[]);assert.equal(await readFile(outside,'utf8'),'private sentinel');
    assert.equal((await lstat(outside)).mode&0o777,0o640);
    assert.equal((await lstat(f.executable)).mode&0o777,0o775);
  }
});
test('unsafe private parent and forged strategy fail before copy; source permission mutation is impossible',async t=>{
  const f=await fixture(t),selection=await inspectExecutable(f.executable,f.options);
  await assert.rejects(auditBundle(f.app,{uid,protect:true}),e=>e.safeCode==='BROWSER_SOURCE_PERMISSION_CHANGE_REFUSED');
  await assert.rejects(prepareBrowser({...selection,strategy:'installed'},f.parent,f.options),e=>e.safeCode==='BROWSER_INSTALLATION_CHANGED');
  await chmod(f.parent,0o755);
  await assert.rejects(prepareBrowser(selection,f.parent,f.options),e=>e.safeCode==='BROWSER_COPY_PARENT_UNSAFE');
  assert.equal(f.calls.filter(c=>c.exe==='/usr/bin/ditto').length,0);
});
test('failed owned browser launch confirms process exit before profile removal',async t=>{
  const f=await fixture(t);
  for(const executable of ['/bin/false',join(f.root,'missing-browser')]){
    await assert.rejects(startBrowser(executable,f.parent),e=>e.browserProcessExited===true);
    assert.deepEqual(await readdir(f.parent),[]);
  }
});
