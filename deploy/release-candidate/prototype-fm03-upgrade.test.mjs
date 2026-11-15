import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,cp,symlink,link,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {privateInventory,validUpgradeDelta,upgrade} from '../uat/prototype-fm03-upgrade.mjs';
import {verifyFm03Migration,fm03Snapshot,digest} from '../uat/prototype-fm03-state.mjs';
import {siteIssueCatalog} from './site-issue-catalog-contract.mjs';
import {siteIssueTables} from './site-issue-schema-contract.mjs';
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
