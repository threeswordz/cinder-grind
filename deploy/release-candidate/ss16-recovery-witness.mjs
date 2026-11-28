// Read-only proof inside the existing owned CI historical rehearsal. Never
// targets the retained Mac, starts another restore, or changes role grants.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {exactSs16Checksums,assertSs16AppliedHistory} from './ss16-release-contract.mjs';
import {canonicalSs16RecoveryConstraints} from './ss16-recovery-constraints.mjs';
const [phase,file]=process.argv.slice(2);
assert.ok(['capture','restored','rollback'].includes(phase)&&file);
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.env.RC_ENVIRONMENT,'ci');
assert.equal(process.env.GITHUB_JOB,'validate');
const target=new URL(process.env.DATABASE_URL??'');
const role=phase==='capture'?'upgrade':phase==='restored'?'hrrestore':'rollback';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname));
assert.equal(target.username,'construction_erp');
assert.match(target.pathname,new RegExp('^/construction_erp_v10e_'+role+'_[a-f0-9]{12}$'));
assert.match(realpathSync(dirname(file)),/^\/tmp\/construction-erp-v10e-migration\.[^/]+$/);
assert.equal(resolve(file),resolve(dirname(file),'ss16-recovery-witness.json'));
const runtime=createRequire(resolve('apps/api/package.json'));
const {PrismaClient}=runtime('@prisma/client');
const db=new PrismaClient();
const expectedTriggers=["ss16_approval_action_guard:approval_actions","ss16_approval_identity_guard:approval_instances","ss16_cancelled_source_guard:goods_receipts","ss16_cancelled_source_guard:material_issues","ss16_cancelled_source_guard:material_returns","ss16_cancelled_source_guard:stock_transfers","ss16_committed_action:approval_actions","ss16_committed_approval:approval_instances","ss16_committed_request:movement_correction_requests","ss16_immutable_request:movement_correction_requests","ss16_original_terminal_action_guard:approval_actions","ss16_original_terminal_state_guard:approval_instances","ss16_request_binding_guard:movement_correction_requests","ss16_terminal_issue_post_guard:material_issues","ss16_terminal_outcome_guard:approval_instances","ss16_terminal_plan_auth_guard:material_plan_issue_authorizations","ss16_terminal_plan_binding_guard:material_plan_issue_bindings","ss16_terminal_transfer_assignment_guard:transfer_receiver_assignments","ss16_terminal_transfer_dispatch_guard:transfer_dispatches","ss16_transfer_cancel_event_guard:transfer_custody_events","ss16_transfer_cancelled_assignment_guard:transfer_receiver_assignments","ss16_workflow_identity_guard:approval_workflows"];
const expectedFunctions=["erp_ss16_approved_unposted_cancellation","erp_ss16_mpi_cancel_proof","erp_ss16_terminal_issue_post_guard","erp_ss16_terminal_plan_auth_guard","erp_ss16_terminal_plan_issue","erp_ss16_terminal_transfer_guard","erp_ss16_transfer_cancel_event_guard","erp_ss16_transfer_cancelled_assignment_guard","ss16_approval_action_guard","ss16_approval_identity_guard","ss16_assert_terminal_outcome","ss16_cancelled_source_guard","ss16_check_committed_decision","ss16_immutable_request","ss16_original_terminal_action_guard","ss16_original_terminal_state_guard","ss16_terminal_outcome_guard","ss16_validate_request_insert","ss16_workflow_identity_guard"];
try{
 await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const [identity]=await tx.$queryRawUnsafe('SELECT current_database() AS name,current_user AS role');
  assert.equal(identity.name,target.pathname.slice(1));assert.equal(identity.role,'construction_erp');
  const history=await tx.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
  const [table]=await tx.$queryRawUnsafe("SELECT to_regclass('public.movement_correction_requests')::text AS name");
  const triggers=await tx.$queryRawUnsafe("SELECT t.tgname AS name,c.relname AS relation,t.tgenabled::text AS enabled,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname ~ '^ss16_' ORDER BY t.tgname,c.relname");
  const functions=await tx.$queryRawUnsafe("SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname ~ '^(erp_)?ss16_' ORDER BY p.proname");
  if(phase==='rollback'){
   assert.equal(table.name,null);
   assert.deepEqual(triggers,[]);assert.deepEqual(functions,[]);
   assert.ok(history.every(r=>!r.migration_name.includes('_ss16_')));
   return;
  }
  assert.equal(table.name,'movement_correction_requests');
  assertSs16AppliedHistory([],history,exactSs16Checksums());
  assert.deepEqual(triggers.map(r=>r.name+':'+r.relation).sort(),expectedTriggers);
  assert.ok(triggers.every(r=>r.enabled==='O'),'SS16 trigger disabled');
  assert.deepEqual(functions.map(r=>r.name).sort(),expectedFunctions);
  const replaced=await tx.$queryRawUnsafe("SELECT p.proname AS name,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('erp_receiving_header_guard','erp_mpi_approval_guard','erp_mpi_receipt_guard') ORDER BY p.proname");
  assert.equal(replaced.length,3);
  const constraints=canonicalSs16RecoveryConstraints(await tx.$queryRawUnsafe("SELECT conname AS name,pg_get_constraintdef(oid) AS definition,contype::text AS kind,convalidated AS validated,connoinherit AS no_inherit,condeferrable AS deferrable,condeferred AS deferred FROM pg_constraint WHERE conrelid='public.movement_correction_requests'::regclass ORDER BY conname"));
  assert.ok(constraints.some(r=>r.name==='movement_correction_exact_source_pin'));
  const indexes=await tx.$queryRawUnsafe("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='movement_correction_requests' ORDER BY indexname");
  assert.ok(indexes.some(r=>r.indexname==='movement_correction_request_replay_key'));
  const rows=await tx.$queryRawUnsafe("SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM movement_correction_requests t");
  const witness={history,triggers,functions,replaced,constraints,indexes,rows};
  if(phase==='capture')writeFileSync(file,JSON.stringify(witness),{mode:0o600,flag:'wx'});
  else assert.deepEqual(witness,JSON.parse(readFileSync(file,'utf8')),'Restored SS16 installed catalog/rows differ');
 },{timeout:30000});
 console.log('SS16_'+phase.toUpperCase()+'_READ_ONLY_PASS');
}finally{await db.$disconnect();}
