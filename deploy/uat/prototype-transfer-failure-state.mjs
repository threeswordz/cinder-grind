// Read-only classification of the one observed SOURCE_API / TR_CREATE failure.
// No connection, replay, sequence allocation, configuration or CLI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyTransferMigration,TRANSFER_GRANTS,transferNewRows} from './prototype-transfer-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const equal=(a,b)=>canonical(a)===canonical(b);
const plain=r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='__fm03_exact_row_json'));
const snake=k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
function configured(row,record){
 demand(row&&record,'TR_READBACK_CONFIGURATION_ROW_MISSING');
 const actual=plain(row),expected=Object.fromEntries(Object.entries(record).map(([k,v])=>[snake(k),v]));
 // Prisma's receipt timestamps have millisecond precision. Compare that
 // precision for NEW configuration rows only; old rows retain exact SQL bytes.
 for(const key of ['created_at','updated_at'])if(Object.hasOwn(expected,key)){
  demand(Number.isFinite(Date.parse(actual[key]))&&new Date(actual[key]).toISOString()===new Date(expected[key]).toISOString(),'TR_READBACK_CONFIGURATION_TIMESTAMP_CHANGED');
  actual[key]=expected[key];
 }
 demand(equal(actual,expected),'TR_READBACK_CONFIGURATION_ROW_CHANGED');
}
export function verifyFailedTransferState(before,current,c,b){
 const f=b.fixture,store=b.actors.STORE_SITE,khaimook=b.actors.KHAIMOOK,porn=b.actors.PORN;
 demand(c.status==='TRANSFER_SYNTHETIC_CONFIGURATION_APPLIED'&&c.productionAuthorized===false&&
  Array.isArray(c.addedRolePermissionIds)&&new Set(c.addedRolePermissionIds).size===c.addedRolePermissionIds.length,'TR_READBACK_CONFIGURATION_RECEIPT_INVALID');
 const normalized=structuredClone(current),baseline=structuredClone(before);
 const additions=t=>transferNewRows(t,before[t]??[],current[t]??[]);
 const take=(t,n)=>{const rows=additions(t);demand(rows.length===n,'TR_READBACK_UNEXPECTED_'+t.toUpperCase());normalized[t]=normalized[t].filter(r=>!rows.includes(r)&&!(rows.some(a=>equal(a,r))));return rows;};
 // Explicit allowlist of configuration rows; every other table is ultimately
 // checked by the existing exact five-migration/history contract.
 const grants=take('role_permissions',c.addedRolePermissionIds.length);
 demand(equal(grants.map(r=>r.id).sort(),[...c.addedRolePermissionIds].sort()),'TR_READBACK_GRANT_IDS_CHANGED');
 const old=new Set(before.role_permissions.map(r=>r.role_id+':'+r.permission_id));
 const wanted=Object.entries(TRANSFER_GRANTS).flatMap(([key,codes])=>codes.map(code=>{
  const p=current.permissions.find(p=>p.permission_code===code);demand(p,'TR_READBACK_PERMISSION_MISSING');return b.actors[key].roleId+':'+p.id;
 })).filter(key=>!old.has(key)).sort();
 demand(equal(grants.map(r=>r.role_id+':'+r.permission_id).sort(),wanted),'TR_READBACK_GRANT_MATRIX_CHANGED');
 configured(take('warehouses',1)[0],c.warehouse);configured(take('project_members',1)[0],c.member);
 configured(take('approval_workflows',1)[0],c.workflow);
 demand(c.warehouse.companyId===f.companyId&&c.warehouse.projectId===f.unassignedProjectId&&c.warehouse.warehouseCode==='PROTO_TRANSFER_DEST'&&c.warehouse.isActive===true&&
  c.member.projectId===f.unassignedProjectId&&c.member.employeeId===porn.employeeId&&c.member.isActive===true&&
  c.workflow.companyId===f.companyId&&c.workflow.entityType==='STOCK_TRANSFER'&&c.workflow.workflowCode==='PROTO_TRANSFER_APPROVAL'&&c.workflow.isActive===true,'TR_READBACK_CONFIGURATION_SCOPE_CHANGED');
 const step=take('approval_steps',1)[0],role=take('approval_step_roles',1)[0];
 demand(step.approval_workflow_id===c.workflow.id&&step.step_no===1&&step.step_name==='Independent Khaimook decision'&&step.required_approvals===1&&
  role.approval_step_id===step.id&&role.role_id===khaimook.roleId,'TR_READBACK_APPROVAL_CONFIGURATION_CHANGED');
 const sequence=take('number_sequences',1)[0];
 demand(c.sequence.companyId===f.companyId&&c.sequence.entityType==='STOCK_TRANSFER'&&c.sequence.sequenceCode==='STOCK_TRANSFER'&&
  c.sequence.formatTemplate==='STYYMM-###'&&c.sequence.resetRule==='MONTHLY'&&c.sequence.nextValue===1&&c.sequence.lastPeriodKey===null&&
  sequence.next_value===2&&/^\d{6}$/.test(sequence.last_period_key??''),'TR_READBACK_FAILED_SEQUENCE_GAP_REQUIRED');
 configured({...sequence,next_value:1,last_period_key:null},c.sequence);
 const policy=take('transfer_project_policies',1)[0],operation=take('transfer_operations',1)[0];
 const reason='Explicit synthetic dispatch/actual-receipt policy';
 demand(policy.project_id===f.projectId&&policy.company_id===f.companyId&&policy.enabled_by_user_id===khaimook.userId&&policy.synthetic_only===true&&policy.reason===reason&&
  operation.action==='ENABLE'&&operation.company_id===f.companyId&&operation.actor_user_id===khaimook.userId&&operation.project_id===f.projectId&&operation.transfer_id===null&&
  equal(operation.outcome,{projectId:f.projectId,enabled:true})&&operation.body_digest===createHash('sha256').update(JSON.stringify(['ENABLE',f.projectId,reason])).digest('hex'),
  'TR_READBACK_POLICY_ENABLE_CHANGED');
 demand(sequence.last_period_key===new Date(operation.created_at).toISOString().slice(0,7).replace('-',''),'TR_READBACK_SEQUENCE_PERIOD_CHANGED');
 const audits=take('audit_logs',2),configAudit=audits.find(r=>r.entity_type==='PROTOTYPE_TRANSFER_CONFIGURATION'),enableAudit=audits.find(r=>r.action==='CUSTODY_ENABLE');
 demand(configAudit?.company_id===f.companyId&&configAudit.entity_id===f.projectId&&configAudit.actor_user_id===f.adminUserId&&configAudit.action==='CONFIGURE'&&
  equal(configAudit.new_values,{syntheticOnly:true,grantMatrix:TRANSFER_GRANTS,destinationProjectId:f.unassignedProjectId,receiverEmployeeId:porn.employeeId})&&
  enableAudit?.company_id===f.companyId&&enableAudit.entity_type==='STOCK_TRANSFER'&&enableAudit.entity_id===f.projectId&&enableAudit.actor_user_id===khaimook.userId&&
  equal(enableAudit.new_values,operation.outcome),'TR_READBACK_AUDIT_DELTA_CHANGED');
 const sessions=take('user_sessions',2);
 demand(sessions.every(r=>r.revoked_at)&&equal(sessions.map(r=>r.user_id).sort(),[store.userId,khaimook.userId].sort())&&
  current.user_sessions.every(r=>r.revoked_at),'TR_READBACK_SESSIONS_NOT_EXACTLY_REVOKED');
 for(const data of [baseline,normalized])data.users=data.users.map(row=>{
  if(![store.userId,khaimook.userId].includes(row.id))return row;
  const {last_login_at,updated_at,__fm03_exact_row_json,...rest}=row;return rest;
 });
 verifyTransferMigration(baseline,normalized);
 // Explicitly make clear that this classifier has never admitted a persisted
 // transfer, custody/header/item, stock effect or evidence addition.
 assert.equal(current.stock_transfers.length,0);assert.equal(current.stock_transfer_items.length,0);
 return {status:'TRANSFER_FAILED_SOURCE_STATE_VERIFIED',historicalRowsPreserved:true,configurationPreserved:true,
  policyAlreadyEnabled:true,failedNumberConsumed:true,transferRowsAbsent:true,stockAndFinanceUnchanged:true,
  failedApiSessionsRevoked:true,continuationAuthorized:false,productionAuthorized:false,secretsPrinted:false};
}
