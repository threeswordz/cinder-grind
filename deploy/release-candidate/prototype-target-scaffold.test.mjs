import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,realpath,stat,lstat,symlink,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {scaffold,makeManifest} from '../uat/prototype-target-scaffold.mjs';
const run=promisify(execFile);
const consent='CREATE_FRESH_SYNTHETIC_ONLY';
const git=(dir,...args)=>run('git',['-C',dir,...args],{timeout:10000});
const context=async t=>{
 const temp=await mkdtemp(join(tmpdir(),'cinder-proto-scaffold-'));
 t.after(async()=>await rm(temp,{recursive:true,force:true}));
 const home=await realpath(temp);
 const checkout=join(home,'Construction-ERP-Prototype-Checkout');
 await mkdir(checkout,{mode:0o700});
 await git(checkout,'init','-q');
 await git(checkout,'config','user.name','Synthetic Fixture');
 await git(checkout,'config','user.email','test@example.invalid');
 await git(checkout,'config','commit.gpgsign','false');
 await git(checkout,'remote','add','origin','https://github.com/threeswordz/cinder-grind.git');
 await writeFile(join(checkout,'README.md'),'New, isolated test checkout\n');
 await mkdir(join(checkout,'deploy','uat'),{recursive:true});
 const realAssessor=await readFile(new URL('../uat/prototype-target-preflight.mjs',import.meta.url),'utf8');
 await writeFile(join(checkout,'deploy','uat','prototype-target-preflight.mjs'),realAssessor);
 await git(checkout,'add','README.md','deploy/uat/prototype-target-preflight.mjs');
 await git(checkout,'commit','-m','Synthetic test only','-q');
 const sha=(await git(checkout,'rev-parse','HEAD')).stdout.trim();
 return {home,checkout,sha,root:join(home,'Construction-ERP-Prototype-Runtime'),
  opts:{home,sha,nodeVersion:'24.21.0'}};
};
test('plan is strictly read-only and cannot claim a running prototype',async t=>{
 const x=await context(t);
 const a=await scaffold({...x.opts,mode:'plan'});
 assert.equal(a.status,'OPERATOR_PLAN_READY');
 assert.equal(a.filesCreated,0);
 assert.equal(a.applicationRunning,false);
 assert.equal(a.productionAuthorized,false);
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('prepare refuses missing exact opt-in and never creates resources',async t=>{
 const x=await context(t);
 const a=await scaffold({...x.opts,mode:'prepare',confirm:'continue'});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 assert.deepEqual(a.gaps,['EXPLICIT_LOCAL_OPERATOR_OPT_IN_REQUIRED']);
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('new fixture creates private-only directories and private uncredentialed manifest',async t=>{
 const x=await context(t);
 const a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.equal(a.status,'FRESH_PRIVATE_TARGET_PREPARED',JSON.stringify(a));
 assert.equal(a.applicationRunning,false);
 assert.equal(a.effectivePermissionsVerified,false);
 for(const path of [x.root,join(x.root,'db'),join(x.root,'documents'),join(x.root,'hrkeys')]){
  assert.equal((await stat(path)).mode&0o777,0o700);
 }
 const fp=join(x.root,'prototype-target.json');
 assert.equal((await stat(fp)).mode&0o777,0o600);
 const text=await readFile(fp,'utf8');
 const config=JSON.parse(text);
 assert.deepEqual(config,makeManifest(x.sha,x.checkout,x.root));
 assert.equal(config.runtime.apiOrigin,'http://127.0.0.1:33071');
 assert.equal(config.runtime.webOrigin,'http://127.0.0.1:44171');
 assert.equal(config.runtime.postgresPort,55471);
 assert.equal(config.productionConnected,false);
 assert.ok(!/password|secret|token/i.test(text));
 const repeat=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.deepEqual(repeat.gaps,['TARGET_ALREADY_EXISTS_NO_OVERWRITE']);
 assert.equal(await readFile(fp,'utf8'),text);
});
test('refuses dirty checkout without creating any target directory',async t=>{
 const x=await context(t);
 await writeFile(join(x.checkout,'README.md'),'Dirty\n');
 const a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('refuses wrong pinned SHA or remote without writing',async t=>{
 const x=await context(t);
 let a=await scaffold({...x.opts,sha:'f'.repeat(40),mode:'prepare',confirm:consent});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 await git(x.checkout,'remote','set-url','origin','https://example.com/fake.git');
 a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('refuses preexisting path including symlink, never attempts to follow it',async t=>{
 const x=await context(t);
 const existing=join(x.home,'unrelated-project');
 await mkdir(existing);
 await symlink(existing,x.root);
 const a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.deepEqual(a.gaps,['TARGET_ALREADY_EXISTS_NO_OVERWRITE']);
 assert.equal((await lstat(x.root)).isSymbolicLink(),true);
});
test('refuses incorrect toolchain or missing checkout',async t=>{
 const x=await context(t);
 let a=await scaffold({...x.opts,nodeVersion:'22.16.0',mode:'prepare',confirm:consent});
 assert.deepEqual(a.gaps,['PINNED_NODE_24_21_0_REQUIRED']);
 await rm(x.checkout,{recursive:true});
 a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('refuses noncanonical home path and invalid actions',async t=>{
 const x=await context(t);
 const link=join(x.home,'home-link');
 await symlink(x.home,link);
 let a=await scaffold({...x.opts,home:link,mode:'prepare',confirm:consent});
 assert.deepEqual(a.gaps,['HOME_IDENTITY_UNSAFE']);
 a=await scaffold({...x.opts,mode:'reset',confirm:consent});
 assert.deepEqual(a.gaps,['INVALID_ACTION_OR_SHA']);
});

test('refuses a symlink checkout even with matching Git remote and SHA',async t=>{
 const x=await context(t);
 const moved=join(x.home,'moved-original-checkout');
 const {rename}=await import('node:fs/promises');
 await rename(x.checkout,moved);
 await symlink(moved,x.checkout);
 const a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.equal(a.status,'SCAFFOLD_BLOCKED');
 await assert.rejects(lstat(x.root),{code:'ENOENT'});
});
test('refuses preexisting ordinary target without writing over it',async t=>{
 const x=await context(t);
 await mkdir(x.root);
 const marker=join(x.root,'do-not-touch');
 await writeFile(marker,'retained-marker');
 const a=await scaffold({...x.opts,mode:'prepare',confirm:consent});
 assert.deepEqual(a.gaps,['TARGET_ALREADY_EXISTS_NO_OVERWRITE']);
 assert.equal(await readFile(marker,'utf8'),'retained-marker');
});