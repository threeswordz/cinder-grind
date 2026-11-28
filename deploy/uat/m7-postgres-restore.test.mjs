import test from 'node:test';
import assert from 'node:assert/strict';
import {createM7PostgresRestore} from './m7-postgres-restore.mjs';
const plan={database:'m7_restore_abcdef012345',role:'m7_restore_role_abcdef012345',sha:'a'.repeat(40),tree:'b'.repeat(40),port:33072};
const sourceDatabase={cluster:'100',oid:1,database:'proto_a_01',role:'proto_runtime'};
const digest='c'.repeat(64),args=['pg_restore','--exit-on-error','--single-transaction','--no-owner','--no-privileges','-U',plan.role,'-d',plan.database];
function fixture(fault=''){
 const calls=[];let db=false,role=false,restored=false,oid=2,roleOid=3;
 const isolation={targetCluster:'200',sourceCluster:'100',separatelyOwned:true,sourceNetworkDenied:true,credentialsIndependent:true};
 const transport={query:async q=>{
  calls.push(['query',q.database,q.role,q.sql]);
  if(q.sql.includes('pg_control_system'))return JSON.stringify({cluster:fault==='cluster'?'100':'200',major:fault==='version'?16:17,database:'postgres',role:'m7_admin'});
  if(q.sql.includes("'databaseOid'"))return JSON.stringify({databaseOid:db||fault==='existingDB'?oid:null,roleOid:role||fault==='existingRole'?roleOid:null});
  if(q.sql.includes("'sourceNameAbsent'"))return JSON.stringify({oid,database:plan.database,owner:fault==='owner'?'wrong':plan.role,role:plan.role,roleOid,privileged:fault==='privileged',sourceNameAbsent:fault!=='sourceName',allowConnect:true});
  if(q.sql.includes('current_user'))return JSON.stringify({database:plan.database,role:fault==='roleConnection'?'other':plan.role});
  if(q.sql.includes('pg_stat_activity'))return JSON.stringify(fault==='session'?[{pid:99,backendStart:'now'}]:[]);
  if(q.sql.includes("'empty'"))return JSON.stringify({empty:!restored&&fault!=='nonempty'});
  throw Error('unrecognized query');
 },execute:async q=>{calls.push(['execute',q.sql]);if(q.sql.startsWith('CREATE ROLE'))role=true;else if(q.sql.startsWith('CREATE DATABASE'))db=true;else throw Error('unexpected SQL');},restore:async q=>{calls.push(['restore',q]);if(fault==='restore')throw Error('restore failed');restored=true;if(fault==='drift')oid++;}};
 const options={plan,sourceDatabase,targetCluster:'200',adminRole:'m7_admin',dumpSha256:digest,transport,verifyIsolation:async()=>fault==='network'?{...isolation,sourceNetworkDenied:false}:isolation,reverifyCapture:async()=>{calls.push(['capture']);if(fault==='capture')throw Error('capture changed');},verifyOwnedSessions:async s=>s.length};
 return {calls,options,adapter:createM7PostgresRestore(options),changeRole:()=>roleOid++};
}
test('create only, separate cluster, exact fixed restore, preserved target OIDs',async()=>{const f=fixture(),a=f.adapter;assert.deepEqual(await a.inspectAbsence(plan),{databaseAbsent:true,roleAbsent:true});await a.provisionFreshTarget(plan);assert.equal((await a.inspectDatabase(plan)).emptyAtDatabaseScope,true);await a.restoreDatabase(plan,args,digest);assert.equal((await a.inspectDatabase(plan)).emptyAtDatabaseScope,false);assert.deepEqual(f.calls.filter(c=>c[0]==='execute').map(c=>c[1]),['CREATE ROLE '+plan.role+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS','CREATE DATABASE '+plan.database+' OWNER '+plan.role+' TEMPLATE template0']);assert.equal(f.calls.filter(c=>c[0]==='restore').length,1);await assert.rejects(a.restoreDatabase(plan,args,digest),/STATE/);});
test('rejects source cluster, role alias and unsafe identifier at construction',()=>{const f=fixture();for(const patch of [{targetCluster:'100'},{adminRole:'proto_runtime'},{adminDatabase:"bad'"},{plan:{...plan,role:'proto_runtime'}}])assert.throws(()=>createM7PostgresRestore({...f.options,...patch}));});
test('network or connected cluster/version drift denies all SQL mutations',async()=>{for(const fault of ['network','cluster','version']){const f=fixture(fault);await assert.rejects(f.adapter.provisionFreshTarget(plan));assert.ok(!f.calls.some(c=>c[0]==='execute'));await assert.rejects(f.adapter.provisionFreshTarget(plan),/STATE/);}});
test('existing database or role refuses create-only provision',async()=>{for(const fault of ['existingDB','existingRole']){const f=fixture(fault);await assert.rejects(f.adapter.provisionFreshTarget(plan),/PRIOR_TARGET/);assert.ok(!f.calls.some(c=>c[0]==='execute'));}});
test('rejects unexpected owner, privilege, source alias, connection, nonempty DB and sessions',async()=>{for(const fault of ['owner','privileged','sourceName','roleConnection','nonempty','session']){const f=fixture(fault);await assert.rejects(f.adapter.provisionFreshTarget(plan));assert.ok(!f.calls.some(c=>c[0]==='restore'));}});
test('changed arguments, digest and capture prevent restore; no retry',async()=>{for(const fault of ['args','digest','capture']){const f=fixture(fault),a=f.adapter;await a.provisionFreshTarget(plan);await assert.rejects(a.restoreDatabase(plan,fault==='args'?[...args,'--clean']:args,fault==='digest'?'d'.repeat(64):digest));assert.ok(!f.calls.some(c=>c[0]==='restore'));await assert.rejects(a.restoreDatabase(plan,args,digest),/STATE/);}});
test('target OID drift and restore failure block completion without retry',async()=>{for(const fault of ['drift','restore']){const f=fixture(fault),a=f.adapter;await a.provisionFreshTarget(plan);await assert.rejects(a.restoreDatabase(plan,args,digest));await assert.rejects(a.restoreDatabase(plan,args,digest),/STATE/);}});
test('changed role OID is detected before restore',async()=>{const f=fixture(),a=f.adapter;await a.provisionFreshTarget(plan);f.changeRole();await assert.rejects(a.restoreDatabase(plan,args,digest),/TARGET_DRIFT/);assert.ok(!f.calls.some(c=>c[0]==='restore'));});
