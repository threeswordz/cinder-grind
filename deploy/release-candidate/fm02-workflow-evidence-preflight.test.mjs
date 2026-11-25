// Run the ACTUAL inline consolidated-evidence acceptance blocks, not copies.
// Synthetic version-20 FM02 outer wrappers cover every historical predecessor.
// No PostgreSQL, build, browser, Mac, production environment or full CI.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {materialUomMigrations} from './material-uom-schema-contract.mjs';
import {materialUomEffectMigration} from './material-uom-effect-schema-contract.mjs';
import {stageCMigrations} from './material-uom-stage-c-schema-contract.mjs';
import {fm02Mode} from './fm02-schema-contract.mjs';
import {pm02Mode,pm02Migrations} from './pm02-schema-preparation.mjs';
import {purchasingMode,purchasingEvidenceKeys} from './purchasing-release-mode.mjs';
import {pur01Migration} from './pur01-schema-preparation.mjs';
import {pur04Migration} from './pur04-schema-preparation.mjs';
import {pur07Migration,pur12Migration} from './purchasing-successor-schema-preparation.mjs';
import {classifySchema} from './schema-contract.mjs';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const yaml=readFileSync(new URL('../../.github/workflows/validate.yml',import.meta.url),'utf8');
const blocks=[...yaml.matchAll(/^          node --input-type=module(?: -)? <<'NODE'\n([\s\S]*?)^          NODE$/gm)]
  .map(m=>m[1].split('\n').map(line=>line.replace(/^          /,'')).join('\n'))
  .filter(body=>body.includes('-consolidated-evidence.json'));
const prefix='migration-aware-fm02-material-uom-stage-c-material-uom-effect-material-uom-';
const entries=[
  ['material-uom', 'schema','59d67d1f2e54e6bfde51e4c5be336ea97906bf52'],
  ['v1-3-customer-boq','subcontract-physical-transfer-receiving-site-issue-plan-issue-material-plan-material-request-stock-count-hr-document-hr-customer-boq-schema','fc52a867c96a8b3a369b480b9799bad1a5e9f399'],
  ['hr1-a-employee','subcontract-physical-transfer-receiving-site-issue-plan-issue-material-plan-material-request-stock-count-hr-document-hr-schema','e86ed846f30ac3feeb09f74ba9084571b9955520'],
  ['material-request','subcontract-physical-transfer-receiving-site-issue-plan-issue-material-plan-material-request-schema','3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec'],
  ['material-plan','subcontract-physical-transfer-receiving-site-issue-plan-issue-material-plan-schema','34e022d5807d3e16458437a02ebba669ba838c6a'],
  ['material-plan-issue','subcontract-physical-transfer-receiving-site-issue-plan-issue-schema','5209c30a1b7b282a603ba09d4a5bd82a700a183f'],
  ['receiving','subcontract-physical-transfer-receiving-schema','d2b790801119fb1b5b4176ad416086ee7363d091'],
];
const migrationNames=[...new Set([
 ...materialUomMigrations,materialUomEffectMigration,...stageCMigrations,
 '20261122140000_fm02_weighted_project_progress',
])];
const gates=[
 'fm02HistoricalPreservation','customerBoqPersistenceUpgrade',
 'hrPredecessorPreservation','hrPredecessorRollback','hrEmployeeUpgradeTests','hrEncryptedRecordRecovery',
 'materialRequestSchemaUpgrade','materialRequestHistoricalPreservation','materialRequestHttpUpgrade','materialRequestSignedReceiptRecovery',
 'materialPlanSchemaUpgrade','materialPlanHistoricalPreservation','materialPlanHttpUpgrade','materialPlanPopulatedRecovery',
 'materialPlanIssueSchemaUpgrade','materialPlanIssueHistoricalPreservation','materialPlanIssueHttpUpgrade','materialPlanIssuePopulatedRecovery','materialPlanIssueSignedReceiptRecovery',
 'receivingSchemaUpgrade','receivingHistoricalPreservation','receivingHttpUpgrade','receivingPopulatedRecovery','receivingEvidenceRecovery',
];
const fixture=(name,tail,predecessor)=>({
 version:20,
 releaseMode:prefix+tail,
 rehearsal:{
  version:20,
  releaseMode:prefix+tail,
  previousReleaseCommit:predecessor,
  migrationNames,
  ...Object.fromEntries(gates.map(key=>[key,'PASS'])),
 },
});
function runInline(block,data){
  const dir=mkdtempSync(join(tmpdir(),'erp-fm02-inline-'));
  try{
    const matches=[...block.matchAll(/readFileSync\('(\/tmp\/[^']+-consolidated-evidence\.json)'/g)];
    assert.equal(matches.length,1,'Inline block must read exactly one consolidated evidence file');
    const file=join(dir,basename(matches[0][1]));
    writeFileSync(file,JSON.stringify(data));
    const script=block.replaceAll(matches[0][1],file);
    return spawnSync(process.execPath,['--input-type=module','-'],
      {cwd:root,input:script,encoding:'utf8',timeout:8000});
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('seven real inline evidence checks remain covered by FM02-aware normalization',()=>{
  assert.equal(blocks.length,7,'A newly added inline evidence consumer needs explicit preflight coverage');
  assert.equal(entries.length,7);
  // All seven real consumers must peel purchasing and PM02 before FM02.
  for(const block of blocks){
    assert.match(block,/fm02Mode\(/);
    assert.match(block,/pm02Mode\(/);
    assert.match(block,/(?:assertPurchasingEvidence\(data\.rehearsal\)|purchasingMode\(data\.releaseMode\))/);
  }
});

for(const [name,tail,predecessor] of entries){
  test(name+' actual inline predecessor assertion accepts exact FM02 version-20 evidence',()=>{
    const block=blocks.find(text=>text.includes('/tmp/'+name+'-consolidated-evidence.json'));
    assert.ok(block,'Missing corresponding inline proof block '+name);
    const data=fixture(name,tail,predecessor);
    const outer=fm02Mode(data.releaseMode);
    assert.equal(outer.present,true);
    assert.equal(outer.prior,prefix.replace('migration-aware-fm02-','migration-aware-')+tail);
    const accepted=runInline(block,data);
    assert.equal(accepted.status,0,
      name+' version-20 inline proof rejected: '+String(accepted.stderr||accepted.error));
    // Wrong predecessor is never enough evidence even with every PASS label.
    const wrong={...data,rehearsal:{...data.rehearsal,previousReleaseCommit:'0'.repeat(40)}};
    assert.notEqual(runInline(block,wrong).status,0,'Foreign predecessor accepted: '+name);
    if(name==='material-uom'){
      // The first consumer has exact FM02/C/B source version checks.
      assert.notEqual(runInline(block,{...data,version:19}).status,0,
        'FM02 version-19 evidence was incorrectly accepted');
      const missing={...data,rehearsal:{...data.rehearsal,
        migrationNames:data.rehearsal.migrationNames.filter(n=>n!=='20261122140000_fm02_weighted_project_progress')}};
      assert.notEqual(runInline(block,missing).status,0,'Missing exact FM02 migration accepted');
    }
  });
}

const candidateSchema=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
// Keep each exact predecessor independently visible, even if another fails.
for(const [name,tail,predecessor] of entries){
  test(name+' real Git predecessor retains exact FM02 path inside version-25 layered receipt',()=>{
    const source=execFileSync('git',['show',predecessor+':apps/api/prisma/schema.prisma'],
      {cwd:root,encoding:'utf8'});
    const actualMode=classifySchema(source,candidateSchema);
    const purchasing=purchasingMode(actualMode);
    const pm02=pm02Mode(purchasing.prior);
    assert.deepEqual([purchasing.pur07,purchasing.pur12,purchasing.pur01,purchasing.pur04,pm02.present],[true,true,true,true,true],
      'Current candidate must preserve every exact purchasing/PM02 layer: '+name);
    assert.equal(purchasing.version,25);
    assert.equal(pm02.prior,prefix+tail,'Historical FM02 and earlier mode must remain exact: '+name);
    assert.equal(fm02Mode(pm02.prior).present,true);
    const data=fixture(name,tail,predecessor);
    data.version=25;
    data.releaseMode=actualMode;
    Object.assign(data.rehearsal,{
      version:25,releaseMode:actualMode,
      migrationNames:[...new Set([...migrationNames,...Object.keys(pm02Migrations),pur04Migration,pur01Migration,pur12Migration,pur07Migration])],
      pm02HistoricalPreservation:'PASS',pm02PairedRecovery:'PASS',pm02ExternalHrKeyAndDocumentRecovery:'PASS',
      ...Object.fromEntries(['pur04','pur01','pur12','pur07'].flatMap(layer=>purchasingEvidenceKeys.map(key=>[layer+key,'PASS']))),
    });
    const block=blocks.find(text=>text.includes('/tmp/'+name+'-consolidated-evidence.json'));
    assert.ok(block,'Missing inline block '+name);
    const outcome=runInline(block,data);
    assert.equal(outcome.status,0,
      'ACTUAL predecessor '+name+' mode '+actualMode+' rejected: '+String(outcome.stderr||outcome.error));
    const wrong=structuredClone(data);wrong.rehearsal.previousReleaseCommit='0'.repeat(40);
    assert.notEqual(runInline(block,wrong).status,0,'Wrong predecessor accepted: '+name);
    if(name==='material-uom'){
      for(const key of ['pm02HistoricalPreservation','fm02HistoricalPreservation',...['pur04','pur01','pur12','pur07'].flatMap(layer=>purchasingEvidenceKeys.map(suffix=>layer+suffix))]){
        const missing=structuredClone(data);delete missing.rehearsal[key];
        assert.notEqual(runInline(block,missing).status,0,'Missing layered receipt accepted: '+key);
      }
      const wrongVersion=structuredClone(data);wrongVersion.rehearsal.version=24;
      assert.notEqual(runInline(block,wrongVersion).status,0,'Wrong nested version accepted');
    }
  });
}
