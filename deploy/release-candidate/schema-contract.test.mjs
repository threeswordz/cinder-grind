import {stripFm02Schema} from './fm02-schema-contract.mjs';
import {stripMaterialUomStageCSchema} from './material-uom-stage-c-schema-contract.mjs';
import {stripMaterialUomSchema} from './material-uom-schema-contract.mjs';
import {stripMaterialUomEffectSchema} from './material-uom-effect-schema-contract.mjs';
import {stripPhysicalSchema} from './subcontract-physical-schema-contract.mjs';
import {stripTransferSchema as transferBase} from './transfer-schema-contract.mjs';
const stripTransferSchema=schema=>transferBase(stripPhysicalSchema(schema).text);
const stripReceivingSchema=schema=>receivingBase(stripTransferSchema(schema).text);
import {stripReceivingSchema as receivingBase} from './receiving-schema-contract.mjs';
import {stripSiteIssueSchema} from './site-issue-schema-contract.mjs';
import {stripPlanIssueSchema} from './material-plan-issue-schema-contract.mjs';
import {stripMaterialPlanSchema} from './material-plan-schema-contract.mjs';
import {stripMaterialRequestSchema} from './material-request-schema-contract.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {stripHrSchema} from './hr-schema-contract.mjs';
import {stripHrDocumentSchema} from './hr-document-schema-contract.mjs';
import {stripStockCountSchema} from './stock-count-schema-contract.mjs';
import { classifySchema, provenanceFields } from './schema-contract.mjs';

const previous = `model Company {
  baseCurrencyCode String @default("SGD") @map("base_currency_code") @db.VarChar(3)
}
${Object.keys(provenanceFields).map((name) => `model ${name} {\n id String @id\n}`).join('\n')}`;
const candidate = Object.entries(provenanceFields).reduce((schema, [model, [name, column]]) =>
  schema.replace(`model ${model} {`, `model ${model} {\n ${name} String? @map("${column}") @db.VarChar(3)`), previous);

test('unchanged schema retains SQL-only mode; bounded nullable provenance selects schema mode', () => {
  assert.equal(classifySchema(previous, previous), 'migration-aware-sql-only');
  assert.equal(classifySchema(previous, candidate), 'migration-aware-thb-schema');
  assert.equal(classifySchema(previous, candidate.replace('@default("SGD")', '@default("THB")')), 'migration-aware-thb-schema');
  assert.equal(classifySchema(candidate, candidate.replace('@default("SGD")', '@default("THB")')), 'migration-aware-thb-schema');
  assert.throws(() => classifySchema(candidate.replace('@default("SGD")', '@default("THB")'), candidate));
});

test('schema classification rejects unrelated/removal/required/defaulted/partial provenance changes', () => {
  for (const invalid of [
    candidate.replace('id String @id', 'id Int @id'),
    candidate.replace('id String @id', ''),
    candidate.replace('contractCurrencyCode String?', 'contractCurrencyCode String'),
    candidate.replace('contractCurrencyCode String?', 'contractCurrencyCode String? @default("THB")'),
    candidate.replace('contractCurrencyCode String? @map("contract_currency_code") @db.VarChar(3)', ''),
    candidate.replace('@default("SGD")', '@default("USD")'),
    candidate + '\nmodel Unapproved {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(previous, invalid));
});

test('Customer BOQ classifier admits only the exact five new models and parent relations', async () => {
  const { readFileSync } = await import('node:fs');
  const current = stripHrDocumentSchema(stripHrSchema(stripStockCountSchema(
    stripMaterialRequestSchema(stripMaterialPlanSchema(stripPlanIssueSchema(stripSiteIssueSchema(stripReceivingSchema(stripMaterialUomSchema(stripMaterialUomEffectSchema(stripMaterialUomStageCSchema(stripFm02Schema(readFileSync(new URL('../../apps/api/prisma/schema.prisma', import.meta.url), 'utf8')).text).text).text).text).text).text).text).text).text,
  ).text).text).text;
  // The real predecessor schema, independently stored by Git, is the baseline.
  const { execFileSync } = await import('node:child_process');
  const baseline = execFileSync('git', ['show', 'fc52a867c96a8b3a369b480b9799bad1a5e9f399:apps/api/prisma/schema.prisma'], { encoding: 'utf8' });
  assert.equal(classifySchema(baseline, current), 'migration-aware-customer-boq-schema');
  for (const invalid of [
    current.replace('sharePercent Decimal @map("share_percent") @db.Decimal(7, 4)', 'sharePercent Float'),
    current.replace('currentEditNo Int @map("current_edit_no")', 'currentEditNo Int @default(1) @map("current_edit_no")'),
    current.replace('customerBoqVersion CustomerBoqVersion?', ''),
    current.replace('model CustomerBoqReplay {', 'model OtherReplay {'),
    current.replace(/baseCurrencyCode\s+String\s+@default\("THB"\)/, 'baseCurrencyCode String @default("USD")'),
    current.replace(/contractValue\s+Decimal/, 'contractValue Float'),
    current + '\nmodel Unreviewed {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(baseline, invalid));
  assert.throws(() => classifySchema(current, baseline));
});


// New FM02 is an independently pinned additive contract; older fixtures above
// strip only that exact contract before testing their original strict scopes.
test('FM02 schema classifier admits only the exact immutable work-plan increment', async () => {
  const {execFileSync}=await import('node:child_process');
  const {readFileSync}=await import('node:fs');
  const predecessor=execFileSync('git',['show','5535dd890fd84489d76b611929e70e3422c746e8:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
  const fm02=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
  const stripped=stripFm02Schema(fm02);
  assert.equal(stripped.present,true);
  assert.equal(stripped.text.replace(/\s+/g,' ').trim(),predecessor.replace(/\s+/g,' ').trim());
  assert.equal(classifySchema(predecessor,fm02),'migration-aware-fm02-schema');
  for(const invalid of [
    fm02.replace('versionNo Int @map("version_no")','versionNo String @map("version_no")'),
    fm02.replace('projectProgressPlans ProjectProgressPlan[]',''),
    fm02.replace('completedQuantity Decimal? @map("completed_quantity")','completedQuantity Float @map("completed_quantity")'),
    fm02.replace('sourceBudgetRevisionLine BudgetRevisionLine? @relation("Fm02QuantityBudgetSource"','sourceBudgetRevisionLine BudgetRevisionLine[] @relation("Fm02QuantityBudgetSource"'),
    fm02.replace('model ProjectProgressPlanLine {','model OtherProgressPlanLine {'),
    fm02+'\nmodel UnapprovedFm02 {\n id String @id\n}',
  ])assert.throws(()=>classifySchema(predecessor,invalid));
  assert.throws(()=>classifySchema(fm02,predecessor));
});


test('FM02 release-mode consumers require exact migration and fail closed on missing proof', async () => {
  const {fm02Mode}=await import('./fm02-schema-contract.mjs');
  const {mkdtempSync,writeFileSync,rmSync,readFileSync}=await import('node:fs');
  const {spawnSync,execFileSync}=await import('node:child_process');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  assert.deepEqual(fm02Mode('migration-aware-fm02-schema'),
    {present:true,prior:'migration-aware-sql-only'});
  assert.deepEqual(fm02Mode('migration-aware-fm02-material-uom-stage-c-schema'),
    {present:true,prior:'migration-aware-material-uom-stage-c-schema'});
  assert.deepEqual(fm02Mode('migration-aware-sql-only'),
    {present:false,prior:'migration-aware-sql-only'});

  const shell=new URL('./rehearse-migration.sh',import.meta.url);
  const verifier=new URL('./verify-evidence.mjs',import.meta.url);
  execFileSync('bash',['-n',shell.pathname]);
  execFileSync(process.execPath,['--check',verifier.pathname]);
  const source=readFileSync(shell,'utf8');
  assert.match(source,/FM02_SCHEMA_UPGRADE=YES/);
  assert.match(source,/20261122140000_fm02_weighted_project_progress/);
  assert.match(source,/fm02-native-catalog-assert\.sql/);

  const dir=mkdtempSync(join(tmpdir(),'fm02-mode-contract-'));
  const releaseCommit='a'.repeat(40);
  const rehearsal=join(dir,'rehearsal.json'),recovery=join(dir,'recovery.json');
  try {
    writeFileSync(recovery,JSON.stringify({releaseCommit}));
    const base={version:20,releaseMode:'migration-aware-fm02-schema',
      releaseCommit,previousReleaseCommit:releaseCommit,previousRuntimeCommit:releaseCommit,
      boundedSchemaContract:'PASS',previousRuntimeClientBuild:'PASS',
      restoredPreviousRuntimeAuthenticationDownload:'PASS',
      migrationNames:['20261122140000_fm02_weighted_project_progress']};
    const run=body=>{
      writeFileSync(rehearsal,JSON.stringify(body));
      return spawnSync(process.execPath,[verifier.pathname,rehearsal,recovery],
        {env:{...process.env,RELEASE_COMMIT:releaseCommit},encoding:'utf8'});
    };
    let result=run(base);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/FM02 preserved upgrade proof missing/);
    result=run({...base,version:19});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/schema version does not match its mode/);
    result=run({...base,migrationNames:['20261122140000_unapproved']});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Exact FM02 forward migration missing/);
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});
