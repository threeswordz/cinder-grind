// M6: strictly bounded synthetic Finance configuration. No import side effects,
// workflow execution, migration, permission wildcard or production activation.
// A preserved Mac operator must authenticate/attest custody and the exact pinned
// pre-write snapshot BEFORE calling configureM6FinanceCore.

export const M6_FINANCE_GRANTS = Object.freeze({
  PORN: Object.freeze([
    'finance.supplier_invoice.view', 'finance.supplier_invoice.create',
    'finance.supplier_invoice.edit', 'finance.supplier_invoice.submit',
    'finance.payment.view', 'finance.payment.create',
    'finance.payment.edit', 'finance.payment.submit',
  ]),
  NANCY: Object.freeze([
    'finance.supplier_invoice.view', 'finance.supplier_invoice.approve',
    'finance.supplier_invoice.reject', 'finance.payment.view',
    'finance.payment.approve', 'finance.payment.reject',
  ]),
});
export const M6_FINANCE_WORKFLOWS = Object.freeze([
  Object.freeze({entityType:'SUPPLIER_INVOICE',workflowCode:'PROTO_M6_SUPPLIER_INVOICE',approver:'NANCY'}),
  Object.freeze({entityType:'PAYMENT',workflowCode:'PROTO_M6_PAYMENT',approver:'NANCY'}),
]);
export const M6_MARKER='PROTOTYPE_M6_FINANCE_CONFIGURATION';
const keys=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'];
const digest64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const id=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(yes,code)=>{if(!yes)fail(code);};

// Deterministic missing grants only: no broad role expansions or implicit
// Finance authority for Ben, SYS_ADMIN, Store, HR or Procurement personnel.
export function planM6FinanceGrants(completeObserved){
  need(completeObserved&&typeof completeObserved==='object'&&!Array.isArray(completeObserved)&&
    same(Object.keys(completeObserved),keys),'M6_ROLE_MATRIX_INCOMPLETE');
  const result={};
  for(const key of keys){
    const grants=completeObserved[key];
    need(Array.isArray(grants)&&grants.every(s=>typeof s==='string'&&s.length>0)&&
      grants.length===new Set(grants).size,'M6_INVALID_GRANT_MATRIX');
    if(key==='PORN')need(!grants.some(s=>/^(finance\.supplier_invoice|finance\.payment)\.(approve|reject)$/.test(s)),
      'M6_PORN_MUST_NOT_APPROVE');
    else if(key==='NANCY')need(!grants.some(s=>/^(finance\.supplier_invoice|finance\.payment)\.(create|edit|submit)$/.test(s)),
      'M6_NANCY_MUST_NOT_MAKE');
    else need(!grants.some(s=>/^(finance\.supplier_invoice|finance\.payment)\./.test(s)),
      'M6_UNDECLARED_FINANCE_ROLE');
    const wanted=M6_FINANCE_GRANTS[key]??[];
    result[key]=wanted.filter(s=>!grants.includes(s));
  }
  return result;
}

// The caller MUST supply exact private receipt-verified source state, digest,
// source-derived eight-role baseline and UOM completion attestation. None of
// these inputs are obtained from a public request or a technical-admin role.
export async function configureM6FinanceCore(db,{binding,baselineGrants,expectedSnapshotDigest,
  snapshot,digest,verifiedUomReceipt}={}){
  need(db&&typeof db.$transaction==='function'&&typeof snapshot==='function'&&
    typeof digest==='function'&&digest64(expectedSnapshotDigest)&&
    verifiedUomReceipt===true,'M6_PRIVATE_PREFLIGHT_REQUIRED');
  need(binding?.sourceSha==='6fe8c4c22b002f66f00593975d381a284581f058',
    'M6_SYNTHETIC_SOURCE_REQUIRED');
  const f=binding.fixture,actors=binding.actors;
  need(f&&id(f.companyId)&&id(f.foreignCompanyId)&&id(f.projectId)&&id(f.adminUserId)&&
    f.companyId!==f.foreignCompanyId&&actors&&same(Object.keys(actors),keys)&&
    keys.every(k=>id(actors[k]?.userId)&&id(actors[k]?.employeeId)&&id(actors[k]?.roleId))&&
    new Set(keys.map(k=>actors[k].userId)).size===8&&
    new Set(keys.map(k=>actors[k].roleId)).size===8,'M6_ACTOR_BINDINGS_INVALID');
  need(baselineGrants&&same(Object.keys(baselineGrants),keys)&&
    keys.every(k=>Array.isArray(baselineGrants[k])),'M6_EXPECTED_GRANTS_MISSING');
  const proposed=planM6FinanceGrants(baselineGrants);
  // Finance role changes are authorized solely for these two synthetic roles.
  need(keys.filter(k=>proposed[k].length>0).every(k=>k==='PORN'||k==='NANCY'),
    'M6_SCOPE_ESCALATION');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-m6-finance-configuration-v1'))");
    const before=await snapshot(tx);
    need(digest(before)===expectedSnapshotDigest,'M6_SOURCE_STATE_DRIFT');
    need(await tx.auditLog.count({where:{companyId:f.companyId,entityType:M6_MARKER}})===0,
      'M6_CONFIGURATION_ALREADY_ATTEMPTED');
    const companies=await tx.company.findMany();
    need(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
      companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&
      companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),
      'M6_SYNTHETIC_COMPANIES_REQUIRED');
    need(await tx.project.count({where:{id:f.projectId,companyId:f.companyId,
      projectCode:'SITE_A',isActive:true}})===1,'M6_SYNTHETIC_PROJECT_REQUIRED');
    need(await tx.auditLog.count({where:{companyId:f.companyId,entityType:'PROTOTYPE_UOM_CONFIGURATION'}})===1,
      'M6_UOM_PREDECESSOR_REQUIRED');
    need(await tx.approvalWorkflow.count({where:{companyId:f.companyId,
      entityType:{in:M6_FINANCE_WORKFLOWS.map(x=>x.entityType)}}})===0,
      'M6_EXISTING_FINANCE_WORKFLOW_RECONCILE_FIRST');
    const members=await tx.userRole.findMany({where:{roleId:{in:keys.map(k=>actors[k].roleId)}}});
    need(members.length===8&&keys.every(k=>members.some(m=>m.roleId===actors[k].roleId&&
      m.userId===actors[k].userId&&m.companyId===f.companyId)),
      'M6_ROLE_MEMBERSHIP_DRIFT');
    const missingCodes=[...new Set(Object.values(proposed).flat())];
    const catalog=await tx.permission.findMany({where:{permissionCode:{in:missingCodes}},
      select:{id:true,permissionCode:true}});
    need(catalog.length===missingCodes.length&&
      same(catalog.map(p=>p.permissionCode),missingCodes)&&
      catalog.every(p=>id(p.id)),'M6_FINANCE_PERMISSION_CATALOG_MISSING');
    const byCode=new Map(catalog.map(p=>[p.permissionCode,p.id]));
    for(const key of keys){
      const a=actors[key];
      const user=await tx.user.findUnique({
        where:{id:a.userId},
        include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}
      });
      need(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&
        user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
        user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&
        user.userRoles[0].role.companyId===f.companyId&&
        user.userRoles[0].role.roleCode==='PROTO_'+key&&
        user.userRoles[0].role.isActive&&
        same(user.userRoles[0].role.rolePermissions.map(p=>p.permission.permissionCode),baselineGrants[key])&&
        await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
        await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,
        'M6_ACTOR_OR_GRANTS_DRIFT');
    }
    const added=[];
    for(const key of ['PORN','NANCY']){
      for(const code of proposed[key]){
        const row=await tx.rolePermission.create({data:{roleId:actors[key].roleId,
          permissionId:byCode.get(code)}});
        added.push(row.id);
      }
    }
    const workflowIds=[];
    for(const w of M6_FINANCE_WORKFLOWS){
      const row=await tx.approvalWorkflow.create({data:{companyId:f.companyId,
        entityType:w.entityType,workflowCode:w.workflowCode,
        workflowName:'Synthetic M6 '+w.entityType+' independent Nancy approval',isActive:true,
        steps:{create:[{stepNo:1,stepName:'Independent Finance approval',
          requiredApprovals:1,stepRoles:{create:[{roleId:actors.NANCY.roleId}]}}]}}});
      workflowIds.push(row.id);
    }
    await tx.auditLog.create({data:{companyId:f.companyId,entityType:M6_MARKER,
      entityId:f.projectId,action:'CONFIGURE',actorUserId:f.adminUserId,
      newValues:{syntheticOnly:true,roleDeltas:proposed,
        workflows:M6_FINANCE_WORKFLOWS.map(x=>x.workflowCode),
        reusedExistingFinancialEndpoints:true,productionAuthorized:false}}});
    return {status:'M6_SYNTHETIC_FINANCE_CONFIGURATION_APPLIED',
      addedGrantCount:added.length,workflowCount:workflowIds.length,
      prototypeOnly:true,financeJourneysVerified:false,
      macDeploymentVerified:false,productionAuthorized:false};
  },{isolationLevel:'Serializable',timeout:30000});
}
