import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripSs16ReleaseSchema,ss16Mode,wrapSs16Mode,assertSs16ReleaseEvidence,ss16MigrationNames,ss16EvidenceKeys,assertSs16AppliedHistory,assertSs16SourceTree,ss16Baseline} from './ss16-release-contract.mjs';
import {classifySchema} from './schema-contract.mjs';
import {purchasingMode} from './purchasing-release-mode.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
import {createHash} from 'node:crypto';
const schema=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
const prior=execFileSync('git',['show',ss16Baseline+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('exact SS16 model and all four relations compose without admitting historical drift',()=>{
 assert.equal(stripSs16ReleaseSchema(schema).text,prior);
 assert.equal(classifySchema(prior,schema),'migration-aware-ss16-schema');
 assert.equal(classifySchema(schema,schema),'migration-aware-sql-only');
 assert.throws(()=>classifySchema(schema,prior));
 for(const bad of [schema.replace('sourceKind String @map("source_kind")','sourceKind Int @map("source_kind")'),schema.replace('  movementCorrectionRequests MovementCorrectionRequest[]\n',''),schema+'\nmodel Unexpected {\n id String @id\n}\n'])assert.throws(()=>classifySchema(prior,bad));
 assert.equal(assertSs16SourceTree(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),ss16Baseline),true);
});
test('version 26 retains historical purchasing modes and demands every SS16 migration and evidence field',()=>{
 const releaseMode=wrapSs16Mode('migration-aware-pur07-pur12-schema');
 assert.equal(purchasingMode(releaseMode).version,26);
 assert.equal(purchasingMode(releaseMode).prior,'migration-aware-sql-only');
 assert.equal(ss16Mode(releaseMode).prior,'migration-aware-pur07-pur12-schema');
 const evidence={version:26,releaseMode,migrationNames:ss16MigrationNames,...Object.fromEntries(ss16EvidenceKeys.map(k=>[k,'PASS']))};
 assert.equal(assertSs16ReleaseEvidence(evidence).present,true);
 for(const key of ss16EvidenceKeys){const bad={...evidence};delete bad[key];assert.throws(()=>assertSs16ReleaseEvidence(bad));}
 for(const names of [ss16MigrationNames.slice(1),[...ss16MigrationNames,ss16MigrationNames[0]],[...ss16MigrationNames,'20261127999999_ss16_unknown']])assert.throws(()=>assertSs16ReleaseEvidence({...evidence,migrationNames:names}));
 assert.throws(()=>assertSs16ReleaseEvidence({...evidence,version:25}));
 assert.throws(()=>assertSs16ReleaseEvidence({...evidence,releaseMode:'migration-aware-pur07-schema'}));
 assert.equal(assertSs16ReleaseEvidence({version:25,releaseMode:'migration-aware-pur07-schema',migrationNames:[]}).present,false);
});
test('SS16 history allows only the empty exact table and all seven exact applied checksums',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const before={customer_boq_versions:empty,stock_transactions:{count:'1',digest:'preserved'}};
 const after={...before,movement_correction_requests:empty};
 const verify=a=>assertHistoricalTables(before,a,...Array(16).fill(false),true);
 verify(after);
 for(const bad of [before,{...after,movement_correction_requests:{...empty,count:'1'}},{...after,stock_transactions:empty},{...after,foreign_table:empty}])assert.throws(()=>verify(bad));
 assert.throws(()=>assertHistoricalTables(before,after));
 const historical=[{migration_name:'20261126000000_previous',checksum:'1'.repeat(64)}];
 const sums=Object.fromEntries(ss16MigrationNames.map(n=>[n,'2'.repeat(64)]));
 const added=ss16MigrationNames.map(n=>({migration_name:n,checksum:sums[n]}));
 assert.equal(assertSs16AppliedHistory(historical,[...historical,...added],sums),true);
 for(const bad of [added,[...historical,...added.slice(1)],[...historical,...added,added[0]],[...historical,...added.map((r,i)=>i? r:{...r,checksum:'3'.repeat(64)})]])assert.throws(()=>assertSs16AppliedHistory(historical,bad,sums));
});
