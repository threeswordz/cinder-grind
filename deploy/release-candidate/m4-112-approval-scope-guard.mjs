// M4 immutable 112-requirement Owner scope reconciliation.
// Run: node deploy/release-candidate/m4-112-approval-scope-guard.mjs
// Reads immutable base, approved overlay and effective gate projection; no writes,
// role grants, acceptance waivers, runtime mutations or external dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=relative=>readFileSync(path.join(root,relative),'utf8');
const base='docs/M4-2026-11-25-112-CONSOLIDATED-EVIDENCE.csv';
const overlay='docs/M4-2026-11-25-112-OWNER-DISPOSITIONS.csv';
const projected='docs/M4-2026-11-25-112-EFFECTIVE-M4-GATES.csv';
const packet='ecd78e4dad648594f27bb7d5517df819b0b1e090';
const authorized=new Set(['BEN02','BEN-BASE-06','PM07','PUR15','SS10','PORN-HR-01']);
function parseCsv(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted) {
   if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}
   else if(c==='"')quoted=false;
   else cell+=c;
  } else if(c==='"') {
   assert.equal(cell,'','Unexpected CSV quote');quoted=true;
  } else if(c===',') {row.push(cell);cell='';}
  else if(c==='\n') {row.push(cell);if(row.length>1||row[0])rows.push(row);row=[];cell='';}
  else if(c!=='\r')cell+=c;
 }
 assert.equal(quoted,false,'Unclosed CSV quote');
 if(row.length||cell){row.push(cell);rows.push(row);}
 return rows;
}
const csv=(v)=>'"'+String(v).replaceAll('"','""')+'"';
const render=rows=>rows.map(row=>row.map(csv).join(',')).join('\n')+'\n';
const matrix=parseCsv(read(base)),approved=parseCsv(read(overlay));
assert.equal(matrix.length,113,'Exactly 112 base requirements');
assert.equal(approved.length,113,'Exactly 112 approved-overlay requirements');
const header=matrix[0],approvalHeader=approved[0];
assert.equal(header.length,16,'Expected 16 base columns');
assert.equal(approvalHeader.length,21,'Expected 21 overlay columns');
assert.deepEqual(approvalHeader.slice(0,16),header);
assert.deepEqual(approvalHeader.slice(16),[
 'owner_disposition_2026_11_25','approved_m4_boundary','preserved_future_scope',
 'authorization_packet','formal_acceptance_change',
]);
const seen=new Set(),gates=[],counts={};
for(let i=1;i<matrix.length;i++){
 const row=matrix[i],app=approved[i],id=row[0];
 assert.equal(row.length,16,'Base schema '+id);
 assert.equal(app.length,21,'Overlay schema '+id);
 assert.deepEqual(app.slice(0,16),row,'Historical base immutable '+id);
 assert.ok(!seen.has(id),'Duplicate requirement '+id);seen.add(id);
 assert.equal(row[12],'NO','No unapproved M4 acceptance '+id);
 assert.equal(app[20],'NONE','No formal acceptance via scope overlay '+id);
 const included=authorized.has(id);
 assert.equal(app[16],included?'APPROVED_SCOPE_BOUNDARY':'UNCHANGED',
  'Exact Owner-approved set '+id);
 if(included){
  assert.equal(app[19],packet,'Owner authorization exact packet '+id);
  assert.ok(app[17]&&app[18],'Operational and future scope both retained '+id);
  assert.equal(row[8],'BLOCKED_OWNER_SCOPE','Original historical gate unchanged '+id);
  assert.equal(row[5],'OWNER_DECISION_OR_SCOPE_SPLIT','Original policy decision unchanged '+id);
 }else{
  assert.deepEqual(app.slice(17,20),['','',''],'No accidental approval '+id);
 }
 const gate=included?'APPROVED_BOUNDARY_RETAINED_UAT_PENDING':({
  DEFERRED_FUTURE_MILESTONE:'DEFERRED_FUTURE_RETAINED',
  IMPLEMENTED_BOUNDED_EVIDENCED:'BOUNDED_EVIDENCE_RETAINED_UAT_PENDING',
  SOURCE_IMPLEMENTED_TARGET_EVIDENCE_PENDING:'SOURCE_EVIDENCE_PENDING',
  ROLE_SCOPE_AND_CURRENT_SOURCE_EVIDENCE_PENDING:'ROLE_SCOPE_EVIDENCE_PENDING',
  VERIFIED_SOURCE_OR_WORKFLOW_GAP:'FUNCTIONAL_GAP_OPEN',
 })[row[5]];
 assert.ok(gate,'Unhandled immutable technical disposition '+id+' '+row[5]);
 counts[gate]=(counts[gate]??0)+1;
 gates.push([id,row[1],gate,row[5],app[16],app[17],app[18],
  row[8],row[12],included?packet:'']);
}
assert.equal(seen.size,112);
assert.equal(counts.APPROVED_BOUNDARY_RETAINED_UAT_PENDING,6);
assert.equal(counts.DEFERRED_FUTURE_RETAINED,42);
assert.equal(counts.BOUNDED_EVIDENCE_RETAINED_UAT_PENDING,33);
assert.equal(counts.SOURCE_EVIDENCE_PENDING,12);
assert.equal(counts.ROLE_SCOPE_EVIDENCE_PENDING,13);
assert.equal(counts.FUNCTIONAL_GAP_OPEN,6);
const effective=render([[
 'immutable_id','persona','effective_m4_gate','historical_technical_disposition',
 'owner_disposition','bounded_operational_scope','preserved_future_scope',
 'historical_retained_technical_gate','full_m4_acceptance_verified',
 'owner_authorization_packet',
],...gates]);
assert.equal(read(projected),effective,'Effective M4 projection not reconciled');
process.stdout.write('M4_112_EFFECTIVE_SCOPE_GUARD_PASS '+JSON.stringify({
 requirements:seen.size,authorizedBoundaries:authorized.size,counts,
 retainedAcceptanceGranted:0,fullM4Accepted:0,sourceAndOwnerOverlayImmutable:true,
})+'\n');
