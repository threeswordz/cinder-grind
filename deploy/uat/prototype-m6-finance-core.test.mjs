import test from 'node:test';
import assert from 'node:assert/strict';
import {M6_FINANCE_GRANTS,M6_FINANCE_WORKFLOWS,M6_BOQ_GRANTS,M6_BOQ_WORKFLOWS,
  planM6FinanceGrants,planM6FullGrants,
  configureM6FinanceCore} from './prototype-m6-finance-core.mjs';
const keys=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'];
const roles=()=>Object.fromEntries(keys.map(x=>[x,[]]));
test('only Porn maker and Nancy approver are granted, no other actor',()=>{
 const p=planM6FinanceGrants(roles());
 assert.deepEqual(p.PORN,[...M6_FINANCE_GRANTS.PORN]);
 assert.deepEqual(p.NANCY,[...M6_FINANCE_GRANTS.NANCY]);
 assert.equal(Object.values(p).flat().length,14);
 assert.deepEqual(Object.keys(p).filter(k=>p[k].length>0).sort(),['NANCY','PORN']);
 assert.deepEqual(M6_FINANCE_WORKFLOWS.map(w=>w.entityType),['SUPPLIER_INVOICE','PAYMENT']);
});
test('DEC-054 grants only Ben Cost self-approval and Nancy priced Client BOQ access',()=>{
 const plan=planM6FullGrants(roles());
 assert.deepEqual(plan.BEN,[...M6_BOQ_GRANTS.BEN]);
 assert.deepEqual(plan.NANCY,[...M6_FINANCE_GRANTS.NANCY,...M6_BOQ_GRANTS.NANCY]);
 assert.equal(Object.values(plan).flat().length,20);
 assert.deepEqual(M6_BOQ_WORKFLOWS.map(w=>w.entityType),['BUDGET_REVISION','CUSTOMER_BOQ']);
 for(const key of ['KHAIMOOK','STORE_SITE','FOREMAN','JAI','KOH'])assert.deepEqual(plan[key],[]);
});
test('deny quantity-only actors receiving full Cost amounts or self approval',()=>{
 for(const [who,code,reason] of [
  ['STORE_SITE','budget.cost.full_view','M6_COST_AMOUNT_DISCLOSURE_ACTOR_DENIED'],
  ['KHAIMOOK','budget.cost.self_approve','M6_COST_SELF_APPROVAL_ACTOR_DENIED'],
  ['NANCY','budget.cost.self_approve','M6_COST_SELF_APPROVAL_ACTOR_DENIED'],
 ]){const r=roles();r[who].push(code);assert.throws(()=>planM6FullGrants(r),{message:reason});}
});
test('existing exact grants are not duplicated',()=>{
 const r=roles();r.PORN=[M6_FINANCE_GRANTS.PORN[0]];r.NANCY=[M6_FINANCE_GRANTS.NANCY[0]];
 const p=planM6FinanceGrants(r);assert.equal(p.PORN.length,7);assert.equal(p.NANCY.length,5);
});
test('deny Porn maker self-approval, Nancy maker privileges and outsider finance',()=>{
 for(const [role,permission,code] of [
   ['PORN','finance.payment.approve','M6_PORN_MUST_NOT_APPROVE'],
   ['PORN','finance.supplier_invoice.reject','M6_PORN_MUST_NOT_APPROVE'],
   ['NANCY','finance.supplier_invoice.create','M6_NANCY_MUST_NOT_MAKE'],
   ['NANCY','finance.payment.submit','M6_NANCY_MUST_NOT_MAKE'],
   ['BEN','finance.payment.approve','M6_UNDECLARED_FINANCE_ROLE'],
   ['KOH','finance.supplier_invoice.view','M6_UNDECLARED_FINANCE_ROLE'],
 ]){const r=roles();r[role].push(permission);assert.throws(()=>planM6FinanceGrants(r),{message:code});}
});
test('deny incomplete or malformed source role matrix',()=>{
 const r=roles();delete r.KOH;assert.throws(()=>planM6FinanceGrants(r),/M6_ROLE_MATRIX_INCOMPLETE/);
 const s=roles();s.PORN=['finance.payment.view','finance.payment.view'];
 assert.throws(()=>planM6FinanceGrants(s),/M6_INVALID_GRANT_MATRIX/);
});
test('preflight rejects all mutation when private receipt/snapshot is absent',async()=>{
 let writes=0;const db={$transaction:async()=>{writes++;}};
 await assert.rejects(configureM6FinanceCore(db,{verifiedUomReceipt:false}),/M6_PRIVATE_PREFLIGHT_REQUIRED/);
 assert.equal(writes,0);
});
test('guarded synthetic transaction creates finance+BOQ grants, 4 independent workflows and one audit marker',async()=>{
 const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const baseline=roles(),actors=Object.fromEntries(keys.map((k,i)=>[k,{userId:uid(50+i),employeeId:uid(100+i),roleId:uid(150+i)}]));
 const fixture={companyId:uid(1),foreignCompanyId:uid(2),projectId:uid(3),adminUserId:uid(4)};
 const adds=[],workflows=[],audits=[];
 const tx={
   $executeRawUnsafe:async sql=>{assert.match(sql,/pg_advisory_xact_lock/);},
   auditLog:{count:async({where})=>where.entityType==='PROTOTYPE_UOM_CONFIGURATION'?1:0,
     create:async x=>audits.push(x.data)},
   company:{findMany:async()=>[{id:fixture.companyId,companyCode:'PROTO_A',isActive:true,baseCurrencyCode:'THB'},
     {id:fixture.foreignCompanyId,companyCode:'PROTO_B',isActive:true,baseCurrencyCode:'THB'}]},
   project:{count:async()=>1},
   approvalWorkflow:{count:async()=>0,create:async x=>{workflows.push(x.data);return {id:uid(500+workflows.length)};}},
   userRole:{findMany:async()=>keys.map(k=>({...actors[k],companyId:fixture.companyId}))
     .map(x=>({roleId:x.roleId,userId:x.userId,companyId:x.companyId}))},
   permission:{findMany:async({where})=>where.permissionCode.in.map((permissionCode,i)=>({permissionCode,id:uid(300+i)}))},
   user:{findUnique:async({where})=>{const k=keys.find(k=>actors[k].userId===where.id),a=actors[k];
     return {isActive:true,companyId:fixture.companyId,employeeId:a.employeeId,
       email:'proto-'+k.toLowerCase()+'@example.invalid',userRoles:[{roleId:a.roleId,
         role:{companyId:fixture.companyId,roleCode:'PROTO_'+k,isActive:true,rolePermissions:[]}}]};}},
   employee:{count:async()=>1},projectMember:{count:async()=>1},
   rolePermission:{create:async x=>{adds.push(x.data);return {id:uid(400+adds.length)};}},
 };
 const db={$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx);}};
 const result=await configureM6FinanceCore(db,{binding:{sourceSha:'6fe8c4c22b002f66f00593975d381a284581f058',
   fixture,actors},baselineGrants:baseline,expectedSnapshotDigest:'a'.repeat(64),
   snapshot:async()=>({}),digest:()=> 'a'.repeat(64),verifiedUomReceipt:true});
 assert.equal(result.addedGrantCount,20);assert.equal(result.workflowCount,4);
 assert.equal(adds.length,20);assert.equal(workflows.length,4);assert.equal(audits.length,1);
 assert.deepEqual(workflows.map(w=>w.steps.create[0].stepRoles.create[0].roleId),[actors.NANCY.roleId,actors.NANCY.roleId,actors.BEN.roleId,actors.NANCY.roleId]);
 assert.ok(adds.slice(0,8).every(x=>x.roleId===actors.PORN.roleId));
 assert.ok(adds.slice(8,17).every(x=>x.roleId===actors.NANCY.roleId));
 assert.ok(adds.slice(17).every(x=>x.roleId===actors.BEN.roleId));
 assert.equal(result.macDeploymentVerified,false);
});
