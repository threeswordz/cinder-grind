import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,execFileSync} from 'node:child_process';
import {mkdtemp,realpath,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {continueTransfer,FAILED_SOURCE,CORRECTED_APP,REHEARSAL_DB} from '../uat/prototype-transfer-continuation.mjs';
test('continuation refuses a non-Mac before reading private target state or creating any stage',async()=>{
 if(process.platform!=='darwin')await assert.rejects(continueTransfer('a'.repeat(40)),e=>e.safeCode==='TR_CONTINUATION_NONROOT_MAC_REQUIRED');
 assert.equal(REHEARSAL_DB,'proto_a_01_transfer_continuation_rehearsal');
});
test('canonical and Mac-style alias CLI fail closed without executing a continuation; imports remain inert',async t=>{
 const source=await realpath(fileURLToPath(new URL('../uat/prototype-transfer-continuation.mjs',import.meta.url))),temporary=await mkdtemp(join(tmpdir(),'transfer-continuation-cli-'));
 t.after(()=>rm(temporary,{recursive:true,force:true}));const alias=join(temporary,'alias');await symlink(dirname(source),alias,'dir');
 for(const [flags,path]of [[[],source],[[],join(alias,'prototype-transfer-continuation.mjs')],[['--preserve-symlinks-main'],join(alias,'prototype-transfer-continuation.mjs')]]){
  const result=spawnSync(process.execPath,[...flags,path,'--invalid-probe','a'.repeat(40)],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,1);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.code,'TR_CONTINUATION_EXECUTE_AND_SHA_REQUIRED');assert.equal(receipt.productionAuthorized,false);
 }
 const result=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../uat/prototype-transfer-continuation.mjs',import.meta.url).href)+')'],{encoding:'utf8',timeout:10000});
 assert.equal(result.status,0);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
});
test('the fixed application pin retains the failed schema, migrations, dependencies and independently reviewed correction bytes',()=>{
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 for(const path of ['apps/api/prisma/schema.prisma','apps/api/prisma/migrations','package.json','pnpm-lock.yaml','apps/api/package.json'])
  assert.equal(git('rev-parse',FAILED_SOURCE+':'+path),git('rev-parse',CORRECTED_APP+':'+path));
 assert.equal(git('rev-parse',CORRECTED_APP+':apps/api/src/inventory/stock-transfer.service.ts'),
  git('rev-parse','7dc6270574c5a7cad05142f32a3ad4e1fc31aa60:apps/api/src/inventory/stock-transfer.service.ts'));
});
