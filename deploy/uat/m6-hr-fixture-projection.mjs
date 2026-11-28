// Event239 successor-only projection. Preserve the original HR assertions;
// remove only exact, receipt-bound additive fixture rows from their input.
import {createHash} from 'node:crypto';
import {verifySuccessorFixtureDelta} from './m6-successor-fixture-preservation.mjs';
const app='70013b5139292ef33563447f8937c8f132feabd2',tree='8152b5ac627325c91c36ed65875791966a1a8874',operator='8f7860f5958a502641a2cef0df4f874a9cd0d78d',planSha256='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error('M6_HR_FIXTURE_'+code),{safeCode:'M6_HR_FIXTURE_'+code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
function parse(r){const raw=r?.__fm03_exact_row_json;need(typeof raw==='string'&&raw.length>0&&raw.length<=1048576,'ROW');let v;try{v=JSON.parse(raw);}catch{need(false,'ROW');}need(uuid(v?.id),'ROW');return {raw,v};}
export function createHrFixtureProjection(receipt){
 need(receipt?.applicationSha===app&&receipt.applicationTree===tree&&receipt.operatorSha===operator&&receipt.planSha256===planSha256,'RECEIPT');
 const authority={database:'m6_successor_rehearsal',ownerAuthorizedFixture:true,retainedMutationAuthorized:false,productionAuthorized:false,planSha256};
 const delta=verifySuccessorFixtureDelta(receipt.before,receipt.after,receipt.additions,authority);
 need(delta.exactAuthorizedAdditions===51&&receipt.proof?.status===delta.status&&receipt.proof.exactAuthorizedAdditions===51&&receipt.proof.historicalTablesPreserved===174&&receipt.proof.hrAndBusinessRowsPreserved===true&&receipt.proof.productionAuthorized===false,'DELTA');
 const keys=Object.keys(receipt.additions).sort(),ids=receipt.addedIds;
 need(ids&&JSON.stringify(keys)===JSON.stringify(Object.keys(ids).sort())&&ids.employees?.length===3&&ids.users?.length===3,'IDS');
 const bound={};for(const t of keys){need(Array.isArray(ids[t])&&ids[t].length===receipt.additions[t].length&&ids[t].every(uuid)&&new Set(ids[t]).size===ids[t].length,'IDS');bound[t]=new Map(ids[t].map((id,i)=>[id,receipt.additions[t][i]]));}
 function project(snapshot,tables){
  const out={...snapshot};for(const t of tables){const expected=bound[t]??new Map();need(Array.isArray(snapshot[t]),'TABLE');const seen=new Set();out[t]=snapshot[t].filter(r=>{const {raw,v}=parse(r);if(!expected.has(v.id))return true;need(!seen.has(v.id)&&hash(raw)===expected.get(v.id),'ADDITION_DRIFT');seen.add(v.id);
   if(t==='role_permissions'){need(Array.isArray(snapshot.permissions),'PERMISSIONS');const p=snapshot.permissions.map(parse).filter(x=>x.v.id===v.permission_id);need(p.length===1&&typeof p[0].v.permission_code==='string'&&!p[0].v.permission_code.startsWith('hr.'),'HR_GRANT');}
   return false;});need(seen.size===expected.size,'MISSING_ADDITION');}return out;
 }
 return Object.freeze({projectEmployees:s=>project(s,['employees']),projectAccess:s=>project(s,['roles','user_roles','role_permissions'])});
}
