import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,cp,symlink,link,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {privateInventory,verifyDocumentInventory,validUpgradeDelta,upgrade,hasSoleListenerPid} from '../uat/prototype-fm03-upgrade.mjs';
import {verifyFm03Migration,fm03Snapshot,digest} from '../uat/prototype-fm03-state.mjs';
import {siteIssueCatalog} from './site-issue-catalog-contract.mjs';
import {siteIssueTables} from './site-issue-schema-contract.mjs';
test('explicit lsof PID/descriptor records accept exactly the recorded process',()=>{
  assert.equal(hasSoleListenerPid('p72\nf19',72),true);
  assert.equal(hasSoleListenerPid('p72\nf19\nf24\n',72),true);
  for(const output of ['', 'p72', 'p73\nf19', 'p72\nf19\np73\nf20',
    'p72\nf19\np72\nf20', 'f19\np72', 'p72\nf19\ncnode', 'p72\nf19\nn*:33071',
    'p72\nf19\n\nf20', 'p72\nf-1', 'p72\nf19\nf19', 'p72\nf19\nPRIVATE_UNEXPECTED_FIELD'])
    assert.equal(hasSoleListenerPid(output,72),false);
  for(const pid of [0,-1,72.5,'72',NaN,Infinity])assert.equal(hasSoleListenerPid('p72\nf19',pid),false);
  for(const output of [null,undefined,{},72])assert.equal(hasSoleListenerPid(output,72),false);
});
test('actual lsof explicit PID/descriptor selection rejects the old exact-text assumption',async()=>{
  const server=createServer();
  try{
    await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
    const port=server.address().port;
    const {stdout}=await promisify(execFile)('lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-Fpf'],
      {encoding:'utf8',timeout:5000,maxBuffer:65536});
    assert.notEqual(stdout.trim(),'p'+process.pid);
    assert.equal(hasSoleListenerPid(stdout,process.pid),true);
    assert.equal(hasSoleListenerPid(stdout,process.pid+1),false);
  }finally{await new Promise(ok=>server.close(ok));}
});
test('the Mac package refuses application/schema drift, renamed files and arbitrary later operator code',()=>{
  const c={status:'ahead',files:[{filename:'deploy/uat/prototype-fm03-upgrade.mjs',status:'added'}]};
  assert.equal(validUpgradeDelta(c),true);
  for(const mutate of [x=>x.status='identical',x=>x.files=[],x=>x.files.push({filename:'apps/api/prisma/schema.prisma',status:'modified'}),
    x=>x.files.push({filename:'apps/api/src/main.ts',status:'modified'}),x=>x.files[0].status='removed',
    x=>x.files[0].previous_filename='another-file.mjs']){
    const bad=structuredClone(c);mutate(bad);assert.equal(validUpgradeDelta(bad),false);
  }
});
test('paired preservation includes empty folders, signed bytes and external keys; tampering, symlinks and hardlinks fail',async()=>{
  const root=await mkdtemp(join(tmpdir(),'fm03-preservation-'));
  try{
    const source=join(root,'source'),copy=join(root,'copy');await mkdir(source,{mode:0o700});
    await mkdir(join(source,'empty-uploads'),{mode:0o700});
    await writeFile(join(source,'signed.bin'),Buffer.from([0,255,1,2]),{mode:0o600});
    await writeFile(join(source,'keyring.json'),'{"synthetic":"external-key-fixture"}',{mode:0o600});
    const before=await privateInventory(source);await cp(source,copy,{recursive:true,errorOnExist:true,force:false});
    assert.deepEqual(await privateInventory(copy),before);
    await writeFile(join(copy,'signed.bin'),Buffer.from([0,255,1,3]));assert.notDeepEqual(await privateInventory(copy),before);
    await symlink(join(source,'signed.bin'),join(copy,'redirect'));
    await assert.rejects(privateInventory(copy),e=>e.safeCode==='FM03_UNSAFE_PRESERVATION_ENTRY');
    await rm(join(copy,'redirect'));await link(join(source,'signed.bin'),join(copy,'hardlink'));
    await assert.rejects(privateInventory(copy),e=>e.safeCode==='FM03_PRESERVATION_HARDLINK_REFUSED');
  }finally{await rm(root,{recursive:true,force:true});}
});
test('migration admits only the exact empty FM03 table/catalog addition and immutable prior rows/grants',()=>{
  const before={permissions:[],_prisma_migrations:[{id:'original',migration_name:'old',checksum:'a'}],
    stock_transactions:[{id:'retained',quantity:'20.0000'}],role_permissions:[{id:'old-grant',permission_id:'old'}]};
  const after={...structuredClone(before),permissions:siteIssueCatalog.map(p=>({...p,created_at:'2026-11-15T00:00:00Z'})),
    _prisma_migrations:[...before._prisma_migrations,{id:'new',migration_name:'20261114140000_fm03_site_issue_lifecycle',finished_at:'2026-11-15T00:00:00Z',rolled_back_at:null}],
    ...Object.fromEntries(siteIssueTables.map(t=>[t,[]]))};
  verifyFm03Migration(before,after);
  for(const change of [x=>x.stock_transactions[0].quantity='0.0000',x=>x.role_permissions=[],
    x=>x.role_permissions.push({id:'unapproved-grant'}),x=>x.permissions.pop(),x=>x.site_issues.push({id:'prepopulated'}),
    x=>x.unexpected_table=[],x=>x._prisma_migrations[0].checksum='rewritten']){
    const bad=structuredClone(after);change(bad);assert.throws(()=>verifyFm03Migration(before,bad));
  }
});
test('Document recovery pairs every retained row with exact ordinary, signed or encrypted file bytes',()=>{
  const key='df73e6aa-76d3-4c14-81bd-dae91754d627',checksum='a'.repeat(64);
  const rows=[{storage_provider:'LOCAL',storage_key:key,file_size_bytes:4,checksum}];
  verifyDocumentInventory(rows,[['','directory'],[key,4,checksum]]);
  for(const entries of [[],[[key,3,checksum]],[[key,4,'b'.repeat(64)]],[[key,'directory']]])
    assert.throws(()=>verifyDocumentInventory(rows,entries),e=>e.safeCode==='FM03_DOCUMENT_BYTES_NOT_RECOVERABLE');
  for(const change of [d=>d.storage_provider='REMOTE',d=>d.storage_key='../escape',d=>d.checksum=null]){
    const bad=structuredClone(rows);change(bad[0]);assert.throws(()=>verifyDocumentInventory(bad,[[key,4,checksum]]));
  }
});
test('the coordinator has no Linux execution or configurable database/source escape hatch',async()=>{
  if(process.platform!=='darwin')await assert.rejects(upgrade(),e=>e.safeCode==='FM03_NONROOT_MAC_REQUIRED');
});

test('database preservation retains exact PostgreSQL numeric bytes beyond JavaScript precision',async()=>{
  const read=bytes=>fm03Snapshot({$queryRawUnsafe:async sql=>sql.includes('pg_tables')?[{tablename:'payments'}]:[{bytes}]});
  const first=await read('{"id":"preserved","amount":9007199254740992.0001}');
  const changed=await read('{"id":"preserved","amount":9007199254740992.0002}');
  assert.equal(first.payments[0].amount,changed.payments[0].amount);
  assert.notEqual(digest(first),digest(changed));
});
