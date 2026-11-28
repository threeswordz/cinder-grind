import test from 'node:test';
import assert from 'node:assert/strict';
import {createM7AuthenticatedEvidenceProbe} from './m7-authenticated-evidence.mjs';
import {bindM7Session} from './m7-persisted-evidence.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const d=c=>c.repeat(64),start='2026-01-02T00:00:00Z',end='2026-01-02T00:01:00Z';
function fixture(fault=''){
 const actors=Object.fromEntries(['reader','signedReader','hrReader','restricted'].map((k,i)=>[k,{id:id(i+1)}]));
 const source={sessions:[],audits:[],users:Object.values(actors).map(a=>({id:a.id,hash:d('1'),stable:d('2'),login:null,updated:start})),buckets:[],businessRowsSha256:d('3'),grantsSha256:d('4'),sourceStateSha256:d('5')};
 const before={...structuredClone(source),clock:start},after={...structuredClone(source),clock:end},expected=[];
 for(const [i,a] of Object.values(actors).entries()){const s=bindM7Session(a.id,'erp_session='+String(i).repeat(32),'a'.repeat(32));expected.push(s);after.sessions.push({id:id(i+10),...s,createdAt:start,expiresAt:'2026-01-03T00:00:00Z',revokedAt:end,lastSeenAt:start});after.users[i].login=start;after.users[i].updated=start;after.users[i].hash=d('6');}
 if(fault==='baseline')before.grantsSha256=d('9');if(fault==='active')after.sessions[0].revokedAt=null;if(fault==='token')after.sessions[0].tokenHash=d('9');if(fault==='audit')after.audits.push({id:id(99)});
 const calls=[];let reads=0;const args={sourceSnapshot:source,expectedAudits:[],actors,readSnapshot:async()=>{calls.push('snapshot');return ++reads===1?before:after;},verifyHttp:async a=>{calls.push('http');for(const [i,s] of expected.entries())if(fault!=='missing'||i!==0)a.onIssuedSession(s);return {status:fault==='http'?'M7_VERIFICATION_BLOCKED':'M7_VERIFICATION_PREPARATION_CHECK_PASS',sessionsRevoked:true,preservationMatched:true};}};
 return {args,calls};
}
test('requires exact persisted proof after actual issued digests, then refuses replay',async()=>{const f=fixture(),run=createM7AuthenticatedEvidenceProbe(f.args),r=await run({});assert.equal(r.status,'M7_AUTHENTICATED_EVIDENCE_PASS');assert.deepEqual(r.sessionProof,{newRevokedSessions:4,newAudits:0,activeSessions:0});assert.deepEqual(f.calls,['snapshot','http','snapshot']);assert.equal(r.milestone7Accepted,false);await assert.rejects(run({}),/ALREADY_ATTEMPTED/);});
test('baseline drift blocks any HTTP probe',async()=>{const f=fixture('baseline'),r=await createM7AuthenticatedEvidenceProbe(f.args)({});assert.equal(r.status,'M7_AUTHENTICATED_EVIDENCE_BLOCKED');assert.deepEqual(f.calls,['snapshot']);});
test('HTTP success without persisted token/revocation/audit proof never passes',async()=>{for(const fault of ['active','token','audit','missing']){const f=fixture(fault),r=await createM7AuthenticatedEvidenceProbe(f.args)({});assert.equal(r.status,'M7_AUTHENTICATED_EVIDENCE_BLOCKED');assert.equal(r.sessionProof,null);assert.equal(f.calls.at(-1),'snapshot');}});
test('HTTP failure remains blocked even when persisted proof passes',async()=>{const f=fixture('http'),r=await createM7AuthenticatedEvidenceProbe(f.args)({});assert.equal(r.code,'M7_AUTH_PROBE_HTTP');assert.equal(f.calls.at(-1),'snapshot');});
