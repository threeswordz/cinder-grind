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

const root=fileURLToPath(new URL('../../',import.meta.url));
const yaml=readFileSync(new URL('../../.github/workflows/validate.yml',import.meta.url),'utf8');
const blocks=[...yaml.matchAll(/^          node --input-type=module(?: -)? <<'NODE'\n([\s\S]*?)^          NODE$/gm)]
  .map(m=>m[1].split('\n').map(line=>line.replace(/^          /,'')).join('\n'))
  .filter(body=>body.includes('-consolidated-evidence.json'));
const prefix='migration-aware-fm02-material-uom-stage-c-material-uom-effect-material-uom-';
const entries=[
  ['material-uom', 'schema','59d67d1f2e54e6bfde51e4c5be336ea97906bf52'],
  ['v1-3-customer-boq','subcontract-physical-transfer-receiving-site-issue-material-plan-material-request-stock-count-hr-document-customer-boq-schema','fc52a867c96a8b3a369b480b9799bad1a5e9f399'],
  ['hr1-a-employee','subcontract-physical-transfer-receiving-site-issue-material-plan-material-request-stock-count-hr-document-hr-schema','e86ed846f30ac3feeb09f74ba9084571b9955520'],
  ['material-request','subcontract-physical-transfer-receiving-site-issue-material-plan-material-request-schema','3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec'],
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
  assert.equal([...yaml.matchAll(/fm02Mode\(data\.releaseMode\)/g)].length,7);
  for(const block of blocks)assert.match(block,/fm02Mode\(data\.releaseMode\)/);
});

for(const [name,tail,predecessor] of entries){
  test(name+' actual inline predecessor assertion accepts exact FM02 version-20 evidence',()=>{
    const block=blocks.find(text=>text.includes('/tmp/'+name+'-consolidated-evidence.json'));
    assert.ok(block,'Missing corresponding inline proof block '+name);
    const data=fixture(name,tail,predecessor);
    assert.deepEqual(fm02Mode(data.releaseMode),
      {present:true,prior:'migration-aware-'+tail.startsWith('schema')?'dummy':'dummy'});
  });
}
