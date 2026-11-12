#!/usr/bin/env node
// #305 authority6797969134. Synthetic actor setup + initial HTTP journeys only.
// Does not restart, reset, migrate, delete or import the running prototype.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {lstat,realpath,readFile,readdir,open} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

export const SOURCE='6fe8c4c22b002f66f00593975d381a284581f058';
export const STARTUP='fee373a0014d43a77a327a60a4a90ba2ef614582';
export const CONTAINER='construction-erp-proto-6fe8c4c2-postgres';
export const API='http://127.0.0.1:33071/api/v1', WEB='http://127.0.0.1:44171';
const SELF='deploy/uat/prototype-actors.mjs';
const ALLOWED=new Set(['deploy/uat/prototype-runtime-operator.mjs',
  'deploy/release-candidate/prototype-runtime-operator.test.mjs','docs/PROTOTYPE-RUNTIME-OPERATOR.md',
  'docs/CURRENT-STATE.md',SELF,'deploy/uat/prototype-actors-native.mjs',
  'deploy/release-candidate/prototype-actors.test.mjs','docs/PROTOTYPE-ACTOR-OPERATOR.md',
  '.github/workflows/validate.yml']);
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const execute=promisify(execFile);
const project=['projects.project.view'];
const allProject=[...project,'projects.access_all'];
const planView=['inventory.material_plan.view','budget.quantity.view'];
const requests=['inventory.material_request.view'];
const countView=['inventory.stock_count.view'];
const hrView=['hr.employment.view','hr.identity.view','hr.bank.view','hr.documents.view'];
// A bounded synthetic capability matrix, not a new default production role map.
export const ROLES=Object.freeze({
  BEN:{permissions:[...allProject,...planView,'procurement.po.view','procurement.po.approve',
    'subcontracts.agreement.view','subcontracts.agreement.approve','subcontracts.work_order.view',
    'subcontracts.work_order.approve','site.daily_report.view','hr.employment.view',
    'budget.customer.view','budget.customer.manage','budget.customer.submit'],categories:['employment']},
  NANCY:{permissions:[...allProject,...hrView,'budget.customer.view','budget.customer.approve'],
    categories:['employment','identity','bank','documents']},
  KHAIMOOK:{permissions:[...allProject,...planView,...requests,...countView,
    'procurement.pr.view','procurement.pr.approve','inventory.receipt.view','inventory.receipt.approve',
    'inventory.stock_count.approve','inventory.material_plan.approve','hr.operational.view',
    'site.daily_report.view'],categories:[]},
  JAI:{permissions:[...allProject,'procurement.pr.view','procurement.po.view','procurement.po.create',
    'procurement.po.submit','procurement.po.revise','inventory.receipt.view'],categories:[]},
  STORE_SITE:{permissions:[...project,...planView,...requests,...countView,
    'procurement.pr.view','procurement.pr.manage','procurement.pr.submit',
    'inventory.stock_count.create','inventory.stock_count.edit','inventory.stock_count.submit',
    'inventory.material_request.create','inventory.material_request.edit',
    'inventory.material_request.link','inventory.material_request.acknowledge',
    'inventory.issue.view','hr.operational.view'],categories:[]},
  FOREMAN:{permissions:[...project,...requests,'site.daily_report.view','site.daily_report.create',
    'site.daily_report.edit','site.daily_report.submit','hr.operational.view'],categories:[]},
  PORN:{permissions:[...project,'hr.employment.view','hr.bank.view'],categories:['employment','bank']},
  KOH:{permissions:[...project,...hrView,'hr.employment.manage','hr.identity.manage',
    'hr.bank.manage','hr.documents.manage'],categories:['employment','identity','bank','documents']},
});
export const roleCodes=key=>'PROTO_'+key;
export function safeEnvironment(original=process.env){
  return Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL']
    .filter(k=>typeof original[k]==='string').map(k=>[k,original[k]]));
}
export function validReady(r){
  return r?.status==='SYNTHETIC_RUNTIME_STARTED'&&r.sourceSha===SOURCE&&r.operatorMainSha===STARTUP&&
    r.container===CONTAINER&&r.apiOrigin===API.slice(0,-7)&&r.webOrigin===WEB&&
    ['apiReady','webReady','syntheticAdminAuthenticated','sourceAndProcessChecks','migrationsApplied','technicalAdminOnly']
      .every(k=>r[k]===true)&&['productionAuthorized','retainedResourcesUsed','humanUatCompleted','prototypeFrozen',
        'businessRoleMatrixVerified','populatedRecoveryVerified'].every(k=>r[k]===false)&&
    /^[a-f0-9]{64}$/.test(r.imageId??'')&&/^[a-f0-9]{64}$/.test(r.webIndexSha256??'');
}
export function validConfig(c){
  return c?.sourceSha===SOURCE&&c.companyCode==='PROTO_A'&&c.adminEmail==='proto-admin@example.invalid'&&
    c.databaseName==='proto_a_01'&&c.databaseUser==='proto_runtime'&&c.apiOrigin===API.slice(0,-7)&&
    c.webOrigin===WEB&&/^[a-f0-9]{64}$/.test(c.databasePassword??'')&&/^[a-f0-9]{64}$/.test(c.adminPassword??'');
}
export function validContainer(c,receipt,dbRoot){
  return receipt?.sourceSha===SOURCE&&receipt.name===CONTAINER&&/^[a-f0-9]{64}$/.test(receipt.id??'')&&
    /^[a-f0-9]{64}$/.test(receipt.image??'')&&c?.Id===receipt.id&&c.Name?.replace(/^\//,'')===CONTAINER&&
    c.Image?.replace(/^sha256:/,'')===receipt.image&&c.State?.Running===true&&c.Config?.User==='70:70'&&
    c.Config?.Labels?.['erp.prototype.source']===SOURCE&&c.Config?.Labels?.['erp.prototype.scope']==='synthetic-only'&&
    ['', 'no'].includes(c.HostConfig?.RestartPolicy?.Name)&&c.Mounts?.length===1&&
    c.Mounts[0].Type==='bind'&&c.Mounts[0].Source===dbRoot&&c.Mounts[0].Destination==='/var/lib/postgresql/data'&&
    c.Mounts[0].RW===true&&Object.keys(c.HostConfig?.PortBindings??{}).join(',')==='5432/tcp'&&
    c.HostConfig.PortBindings['5432/tcp']?.length===1&&
    c.HostConfig.PortBindings['5432/tcp'][0].HostIp==='127.0.0.1'&&
    c.HostConfig.PortBindings['5432/tcp'][0].HostPort==='55471';
}
export function toolingOnly(compare){
  return compare?.status==='ahead'&&compare.files?.length>0&&compare.files.length<=ALLOWED.size&&
    compare.files.every(f=>ALLOWED.has(f.filename)&&['added','modified'].includes(f.status)&&!f.previous_filename);
}
export async function privateFile(file){
  const s=await lstat(file);
  demand(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&s.nlink===1&&
    !(s.mode&0o077)&&s.size<=1048576,'UNSAFE_PRIVATE_FILE');
  return JSON.parse(await readFile(file,'utf8'));
}
async function exclusive(file,value){
  const f=await open(file,'wx',0o600);
  try{await f.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await f.close();}
}
async function directory(path,privateOnly=false){
  const s=await lstat(path);
  demand(s.isDirectory()&&!s.isSymbolicLink()&&await realpath(path)===path&&s.uid===process.getuid()&&
    !(s.mode&(privateOnly?0o077:0o022)),'UNSAFE_DIRECTORY_IDENTITY');
}
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function command(exe,args,cwd){
  try{return (await execute(exe,args,{cwd,env:safeEnvironment(),timeout:20000,maxBuffer:2097152})).stdout.trim();}
  catch{throw Object.assign(new Error(),{safeCode:'LOCAL_IDENTITY_COMMAND_FAILED'});}
}
async function jsonFetch(url){
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ERP-Synthetic-Actor-Operator'}});
  demand(r.ok,'SOURCE_OR_HEALTH_HTTP_CHECK_FAILED');return r.json();
}
export function summary(status){return {purpose:'AUTHORIZED_SYNTHETIC_ACTORS_INITIAL_HTTP_JOURNEYS',sourceSha:SOURCE,status,
  productionAuthorized:false,retainedResourcesUsed:false,humanUatCompleted:false,prototypeFrozen:false,
  fullBusinessRoleMatrixVerified:false,authenticatedBrowserVerified:false,populatedRecoveryVerified:false,secretsPrinted:false};}

// Must be repeated inside the same serializable provisioning transaction.
export async function pristine(db){
  const companies=await db.company.findMany({select:{id:true,companyCode:true,isActive:true,baseCurrencyCode:true}});
  demand(companies.length===1&&companies[0].companyCode==='PROTO_A'&&companies[0].isActive&&
    companies[0].baseCurrencyCode==='THB','DATABASE_NOT_FRESH_SYNTHETIC');
  const users=await db.user.findMany({include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
  const admin=users[0];
  demand(users.length===1&&admin.isActive&&admin.companyId===companies[0].id&&admin.employeeId===null&&
    admin.email==='proto-admin@example.invalid'&&admin.userRoles.length===1&&
    admin.userRoles[0].role.companyId===companies[0].id&&admin.userRoles[0].role.roleCode==='SYS_ADMIN'&&
    admin.userRoles[0].role.isActive&&admin.userRoles[0].role.rolePermissions.every(x=>
      !/\.approve$/.test(x.permission.permissionCode)&&!x.permission.permissionCode.startsWith('hr.')),
    'TECHNICAL_ADMIN_BASELINE_MISMATCH');
  const roles=await db.role.findMany({select:{id:true}});
  demand(roles.length===1&&roles[0].id===admin.userRoles[0].roleId,'EXISTING_ROLE_CONFIGURATION_STOP');
  for(const model of ['employee','customer','supplier','project','hrCompanyAccess','material','unitOfMeasure','warehouse',
    'purchaseRequest','purchaseOrder','goodsReceipt','stockTransaction','stockCount','materialRequest',
    'materialUsagePlan','materialPlanProjectPolicy','subcontractAgreement','supplierInvoice','clientInvoice','payment','document'])
    demand(await db[model].count()===0,'EXISTING_BUSINESS_DATA_STOP');
  return {companyId:companies[0].id,adminUserId:admin.id};
}

export async function provision(db,passwords){
  const actors={};
  for(const key of Object.keys(ROLES)){
    const password=randomBytes(32).toString('hex');
    actors[key]={userId:randomUUID(),employeeId:randomUUID(),roleId:randomUUID(),email:'proto-'+key.toLowerCase()+'@example.invalid',
      password,passwordHash:await passwords.hash(password),expectedRoleCodes:[roleCodes(key)]};
  }
  // Credentials are passed to the caller before transaction execution so they
  // can be saved privately before a committed fixture could outlive this process.
  return {actors,commit:async()=>db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-actor-setup-v1'))");
    const identity=await pristine(tx), companyId=identity.companyId;
    const codes=[...new Set(Object.values(ROLES).flatMap(x=>x.permissions))];
    const permissions=await tx.permission.findMany({where:{permissionCode:{in:codes}}});
    demand(permissions.length===codes.length,'MIGRATED_PERMISSION_CATALOG_MISSING');
    const permissionIds=new Map(permissions.map(x=>[x.permissionCode,x.id]));
    const foreign=await tx.company.create({data:{companyCode:'PROTO_B',companyName:'Synthetic denial Company',baseCurrencyCode:'THB'}});
    const customer=await tx.customer.create({data:{companyId,customerCode:'PROTO_CUSTOMER',customerName:'Synthetic customer'}});
    const foreignCustomer=await tx.customer.create({data:{companyId:foreign.id,customerCode:'PROTO_CUSTOMER',customerName:'Synthetic foreign customer'}});
    const makeProject=(owner,customerId,projectCode)=>tx.project.create({data:{companyId:owner,customerId,projectCode,
      projectName:'Synthetic '+projectCode,contractValue:'0',contractCurrencyCode:'THB',
      plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
    const site=await makeProject(companyId,customer.id,'SITE_A'),unassigned=await makeProject(companyId,customer.id,'SITE_B'),
      foreignSite=await makeProject(foreign.id,foreignCustomer.id,'SITE_FOREIGN');
    for(const [key,actor] of Object.entries(actors)){
      await tx.employee.create({data:{id:actor.employeeId,companyId,employeeCode:roleCodes(key),employeeName:'Synthetic '+key}});
      await tx.user.create({data:{id:actor.userId,companyId,employeeId:actor.employeeId,email:actor.email,
        passwordHash:actor.passwordHash,displayName:'Synthetic '+key}});
      await tx.role.create({data:{id:actor.roleId,companyId,roleCode:roleCodes(key),roleName:'Synthetic '+key}});
      await tx.userRole.create({data:{companyId,userId:actor.userId,roleId:actor.roleId}});
      await tx.rolePermission.createMany({data:ROLES[key].permissions.map(c=>({roleId:actor.roleId,permissionId:permissionIds.get(c)}))});
      await tx.projectMember.create({data:{projectId:site.id,employeeId:actor.employeeId,projectRole:roleCodes(key)}});
      for(const category of ROLES[key].categories)await tx.hrCompanyAccess.create({data:{companyId,userId:actor.userId,
        category,reasonCode:'OWNER_APPROVED_SCOPE',updatedByUserId:identity.adminUserId}});
      await tx.auditLog.create({data:{companyId,entityType:'PROTOTYPE_SYNTHETIC_ACTOR',entityId:actor.userId,
        action:'CREATE',actorUserId:identity.adminUserId,newValues:{syntheticOnly:true,roleCode:roleCodes(key),
          permissions:ROLES[key].permissions,categories:ROLES[key].categories,projectId:site.id}}});
    }
    const uom=await tx.unitOfMeasure.create({data:{companyId,uomCode:'PROTO_EA',uomName:'Synthetic each',decimalPlaces:4}});
    const material=await tx.material.create({data:{companyId,materialCode:'PROTO_STEEL',materialName:'Synthetic steel',defaultUomId:uom.id}});
    const warehouse=await tx.warehouse.create({data:{companyId,projectId:site.id,warehouseCode:'PROTO_SITE_A',
      warehouseName:'Synthetic site A store',isSiteWarehouse:true}});
    return {...identity,foreignCompanyId:foreign.id,projectId:site.id,unassignedProjectId:unassigned.id,
      foreignProjectId:foreignSite.id,uomId:uom.id,materialId:material.id,warehouseId:warehouse.id};
  },{isolationLevel:'Serializable',timeout:30000})};
}

// Never emit response bodies, credentials, cookies or private fixture identifiers.
export function httpClient(base=API,origin=WEB,fetchImpl=fetch){
  const observations=[];
  async function call(actor,id,path,expected,body,method=body===undefined?'GET':'POST',csrf=true){
    demand(/^[A-Z0-9_]+$/.test(id)&&path.startsWith('/')&&!path.startsWith('//'),'INVALID_PROBE');
    const headers={Accept:'application/json',Origin:origin,'x-correlation-id':randomUUID()};
    if(actor?.cookie)headers.Cookie=actor.cookie;
    if(body!==undefined)headers['Content-Type']='application/json';
    if(actor?.csrf&&csrf&&method!=='GET')headers['x-csrf-token']=actor.csrf;
    const r=await fetchImpl(base+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    observations.push({id,httpStatus:r.status,expected,observedAt:new Date().toISOString(),requestId:headers['x-correlation-id']});
    demand(r.status===expected,'PROBE_'+id+'_HTTP_'+r.status);
    const raw=await r.text();demand(raw.length<=1048576,'RESPONSE_TOO_LARGE');
    let value;try{value=raw?JSON.parse(raw):undefined;}catch{demand(false,'INVALID_HTTP_JSON');}
    return {value,response:r};
  }
  async function login(key,actor,companyId){
    const {value,response}=await call(undefined,key+'_LOGIN','/auth/login',201,{email:actor.email,password:actor.password});
    const cookie=response.headers.get('set-cookie')?.split(';',1)[0];
    const live={...actor,cookie,csrf:value?.data?.csrfToken};
    try{
      demand(cookie&&typeof live.csrf==='string'&&value?.data?.user?.id===actor.userId&&
        value.data.user.companyId===companyId,'LOGIN_IDENTITY_MISMATCH');
      const me=(await call(live,key+'_ME','/auth/me',200)).value?.data;
      demand(me?.id===actor.userId&&me.companyId===companyId&&me.email===actor.email&&
        JSON.stringify([...me.roleCodes].sort())===JSON.stringify([...actor.expectedRoleCodes].sort()),'SESSION_ROLE_MISMATCH');
      return {...live,me};
    }catch(e){if(cookie&&live.csrf)await logout(key,live);throw e;}
  }
  async function logout(key,actor){await call(actor,key+'_LOGOUT','/auth/logout',204,{});}
  return {call,login,logout,observations};
}

export async function initialJourneys(db,fixture,actors,client,adminActor){
  const sessions={}, {call,login,logout}=client, c=fixture.companyId;
  let primaryError;
  try{
    for(const [key,actor] of Object.entries(actors)){
      const session=await login(key,actor,c);sessions[key]=session;
      demand(JSON.stringify([...session.me.permissions].sort())===JSON.stringify([...ROLES[key].permissions].sort()),
        'EFFECTIVE_PERMISSION_MISMATCH');
      await call(session,key+'_PROJECT','/projects/'+fixture.projectId,200);
      await call(session,key+'_FOREIGN_PROJECT','/projects/'+fixture.foreignProjectId,404);
      await call(session,key+'_SECOND_PROJECT','/projects/'+fixture.unassignedProjectId,
        ROLES[key].permissions.includes('projects.access_all')?200:403);
    }
    const s=sessions.STORE_SITE,k=sessions.KHAIMOOK,f=sessions.FOREMAN,hr=sessions.KOH;
    await call(undefined,'ANONYMOUS_COUNT','/inventory/stock-count-projects',401);
    await call(f,'FOREMAN_COUNT_DENIED','/inventory/stock-count-projects',403);
    await call(f,'FOREMAN_PR_DENIED','/procurement/projects/'+fixture.projectId+'/purchase-requests',403);
    await call(s,'STORE_COUNT_ALLOWED','/inventory/stock-count-projects',200);
    const countBody={projectId:fixture.projectId,warehouseId:fixture.warehouseId,materialId:fixture.materialId,
      uomId:fixture.uomId,countedAt:new Date().toISOString(),actualQuantity:'20.0000',evidenceReference:'Synthetic controlled initial quantity'};
    await call(s,'COUNT_CSRF_DENIED','/inventory/stock-counts',403,countBody,'POST',false);
    const count=(await call(s,'COUNT_CREATE','/inventory/stock-counts',201,countBody)).value.data;
    const submitted=(await call(s,'COUNT_SUBMIT','/inventory/stock-counts/'+count.id+'/submit',201,{expectedVersion:count.version})).value.data;
    const decision={expectedVersion:submitted.version,postKey:randomUUID(),comment:'Independent synthetic quantity decision'};
    await call(s,'STORE_APPROVAL_PERMISSION_DENIED','/inventory/stock-counts/'+count.id+'/approve',403,decision);
    const approved=(await call(k,'COUNT_INDEPENDENT_APPROVAL','/inventory/stock-counts/'+count.id+'/approve',201,decision)).value.data;
    demand(approved.status==='APPROVED'&&approved.decidedByUserId===k.userId,'COUNT_DECISION_NOT_PERSISTED');
    await call(k,'COUNT_APPROVAL_REPLAY','/inventory/stock-counts/'+count.id+'/approve',201,decision);
    const rowCount=()=>db.stockTransaction.count({where:{stockCountId:count.id}});
    demand(await rowCount()===1,'COUNT_REPLAY_DUPLICATED_STOCK');
    const requestBody={requestKey:randomUUID(),projectId:fixture.projectId,warehouseId:fixture.warehouseId,
      requesterEmployeeId:actors.FOREMAN.employeeId,requestDate:new Date().toISOString().slice(0,10),
      remarks:'Synthetic Foreman request captured by Store Site',lines:[{materialId:fixture.materialId,uomId:fixture.uomId,
        requestedQuantity:'3.0000',wbsId:null,costCodeId:null,activityId:null,remarks:null}]};
    await call(f,'FOREMAN_REQUEST_CREATE_DENIED','/inventory/material-requests',403,requestBody);
    const request=(await call(s,'STORE_REQUEST_CREATE','/inventory/material-requests',201,requestBody)).value.data;
    const replay=(await call(s,'REQUEST_REPLAY','/inventory/material-requests',201,requestBody)).value.data;
    demand(request.id===replay.id,'REQUEST_REPLAY_IDENTITY_MISMATCH');
    await call(f,'FOREMAN_REQUEST_READ','/inventory/material-requests/'+request.id,200);
    demand(await rowCount()===1&&await db.stockTransaction.count()===1,'REQUEST_MUST_NOT_POST_STOCK');
    const worker=actors.FOREMAN.employeeId, root='/hr/companies/'+c+'/employees/'+worker;
    await call(hr,'HR_ENROL',root+'/employment',201,{requestId:randomUUID(),expectedVersion:0,
      facts:{payBasis:'DAILY',employmentForm:'PERMANENT',siteKind:'SITE',startDate:'2026-11-01',endDate:null,
        projectId:fixture.projectId,hiringApprovalReference:'SYNTHETIC_ONLY',reason:'Synthetic employment fixture'}});
    for(const category of ['identity','bank'])await call(hr,'HR_WRITE_'+category.toUpperCase(),root+'/private/'+category+'/revisions',201,
      {requestId:randomUUID(),expectedVersion:0,values:category==='identity'?{identityNumber:'SYNTHETIC_PRIVATE_ID'}:
        {bankName:'Synthetic bank',accountNumber:'SYNTHETIC_ACCOUNT',accountHolder:'Synthetic worker'},reason:'Synthetic privacy check'});
    for(const [key,session] of Object.entries(sessions)){
      for(const category of ['employment','identity','bank']){
        const path=category==='employment'?root+'/employment':root+'/private/'+category;
        const allowed=ROLES[key].categories.includes(category);
        // Employment has both a permission decorator and persisted category scope.
        const denied=category==='employment'?403:404;
        const data=(await call(session,key+'_HR_'+category.toUpperCase(),path,allowed?200:denied)).value;
        demand(!JSON.stringify(data).includes('SYNTHETIC_PRIVATE_ID')&&!JSON.stringify(data).includes('SYNTHETIC_ACCOUNT'),
          'HR_PRIVATE_VALUE_LEAK');
        if(category==='employment'&&allowed)demand(data?.data?.employee?.id===worker&&
          data.data.employment?.currentVersion===1&&data.data.employment.revisions.length===1,'HR_EMPLOYMENT_FIXTURE_MISSING');
        if(category!=='employment'){
          const revealed=(await call(session,key+'_REVEAL_'+category.toUpperCase(),path+'/reveal',allowed?201:404,{version:1})).value;
          const marker=category==='identity'?'SYNTHETIC_PRIVATE_ID':'SYNTHETIC_ACCOUNT';
          demand(allowed?Object.values(revealed?.data?.values??{}).includes(marker):!JSON.stringify(revealed).includes(marker),
            'HR_REVEAL_BOUNDARY_MISMATCH');
        }
      }
      const denied=ROLES[key].permissions.includes('hr.employment.view')?404:403;
      await call(session,key+'_FOREIGN_HR','/hr/companies/'+fixture.foreignCompanyId+'/employees',denied);
    }
    demand(adminActor?.userId===fixture.adminUserId,'TECHNICAL_ADMIN_BINDING_REQUIRED');
    const technical=await login('SYS_ADMIN',adminActor,c);sessions.SYS_ADMIN=technical;
    demand(technical.me.roleCodes.length===1&&technical.me.roleCodes[0]==='SYS_ADMIN'&&
      !technical.me.permissions.some(p=>/\.approve$/.test(p)||p.startsWith('hr.')),'ADMIN_BUSINESS_AUTHORITY_LEAK');
    await call(technical,'ADMIN_COUNT_DENIED','/inventory/stock-count-projects',403);
    await call(technical,'ADMIN_HR_DENIED',root+'/employment',403);
    await call(technical,'ADMIN_BANK_DENIED',root+'/private/bank',404);
    const body={projectId:fixture.projectId,reportDate:new Date().toISOString().slice(0,10),
      generalRemarks:'Synthetic Foreman daily report',manpower:[],materialUsage:[],equipmentUsage:[],progress:[],issues:[],delays:[],inspections:[]};
    const report=(await call(f,'FOREMAN_DAILY_CREATE','/site-execution/reports',201,body)).value.data;
    await call(f,'FOREMAN_DAILY_SUBMIT','/site-execution/reports/'+report.id+'/submit',201,{});
    const day=body.reportDate,to=new Date(Date.parse(day+'T00:00:00.000Z')+6*86400000).toISOString().slice(0,10);
    const weekly=(await call(sessions.BEN,'BEN_WEEKLY_READ','/site-execution/reports/weekly?projectId='+fixture.projectId+'&from='+day+'&to='+to,200)).value.data;
    demand(JSON.stringify(weekly).includes(report.id),'WEEKLY_NONEMPTY_REPORT_MISSING');
    demand(weekly.reviewState==='READ_ONLY_NO_APPROVAL','WEEKLY_REVIEW_BOUNDARY_MISMATCH');
    await call(sessions.BEN,'BEN_CANNOT_CREATE_REPORT','/site-execution/reports',403,body);
    return {initialHttpChecks:client.observations.length,stockCountId:count.id,requestId:request.id,reportId:report.id};
  }catch(e){primaryError=e;throw e;}
  finally{
    let logoutError;
    for(const [key,session] of Object.entries(sessions))try{await logout(key,session);}catch(e){logoutError??=e;}
    if(!primaryError&&logoutError)throw logoutError;
  }
}

async function preflight(){
  demand(process.platform==='darwin'&&process.getuid()>0,'NONROOT_MAC_OPERATOR_REQUIRED');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(!Object.keys(process.env).some(k=>/^PRISMA_|^NODE_OPTIONS$|^NODE_PATH$/.test(k)),
    'INHERITED_RUNTIME_OVERRIDE_REFUSED');
  const home=homedir(), checkout=join(home,'Construction-ERP-Prototype-Checkout'),root=join(home,'Construction-ERP-Prototype-Runtime');
  await directory(home);await directory(checkout);await directory(root,true);
  for(const sub of ['db','documents','hrkeys','logs','uploads'])await directory(join(root,sub),true);
  demand(await absent(join(root,'actors-started.json'))&&await absent(join(root,'actors-private.json'))&&
    await absent(join(root,'actors-ready.json')),'ACTOR_SETUP_ALREADY_STARTED_NO_RETRY');
  const ready=await privateFile(join(root,'runtime-ready.json')),config=await privateFile(join(root,'runtime-private.json'));
  demand(validReady(ready)&&validConfig(config),'WRONG_RUNNING_PROTOTYPE');
  const manifest=await privateFile(join(root,'prototype-target.json'));
  demand(manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&
    manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.checkoutRoot===checkout&&
    manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&
    manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.isolationRoot===root&&
    manifest.runtime.apiOrigin===config.apiOrigin&&manifest.runtime.webOrigin===WEB&&
    manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&
    manifest.runtime.postgresDbName==='proto_a_01','WRONG_TARGET_MANIFEST');
  demand(await command('git',['rev-parse','HEAD'],checkout)===SOURCE&&
    await command('git',['status','--porcelain'],checkout)==='','SOURCE_CHANGED_STOP');
  demand(['https://github.com/threeswordz/cinder-grind.git','https://github.com/threeswordz/cinder-grind']
    .includes(await command('git',['remote','get-url','origin'],checkout)),'WRONG_SOURCE_ORIGIN');
  const branch=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/branches/main'), main=branch.commit?.sha;
  demand(/^[a-f0-9]{40}$/.test(main??''),'MAIN_SHA_REQUIRED');
  demand(toolingOnly(await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+SOURCE+'...'+main)),
    'APPLICATION_CHANGED_RECONCILIATION_REQUIRED');
  const runs=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/actions/runs?head_sha='+main+'&event=push&per_page=20');
  demand(runs.workflow_runs?.some(r=>r.head_sha===main&&r.path==='.github/workflows/validate.yml'&&r.event==='push'&&
    r.status==='completed'&&r.conclusion==='success'),'EXACT_OPERATOR_MAIN_CI_REQUIRED');
  const published=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/contents/'+SELF+'?ref='+main);
  demand(published.sha===blob(await readFile(new URL(import.meta.url))),'OPERATOR_BYTES_NOT_GREEN_MAIN');
  const connections=JSON.parse(await command('podman',['system','connection','list','--format','json'],checkout));
  const defaults=connections.filter(c=>c.Default===true),connection=defaults[0];
  demand(defaults.length===1&&connection.Name==='podman-machine-default'&&
    /^ssh:\/\/core@127\.0\.0\.1:\d+\/run\/user\/\d+\/podman\/podman.sock$/.test(connection.URI??''),
    'WRONG_LOCAL_PODMAN_CONNECTION');
  demand(await command('podman',['info','--format','{{.Host.Security.Rootless}}'],checkout)==='true','ROOTLESS_PODMAN_REQUIRED');
  const receipt=await privateFile(join(root,'container-owned.json'));
  const inspected=JSON.parse(await command('podman',['inspect',receipt.id],checkout));
  demand(inspected.length===1&&validContainer(inspected[0],receipt,join(root,'db'))&&receipt.image===ready.imageId,
    'RUNNING_DATABASE_IDENTITY_MISMATCH');
  for(const [kind,port,entry] of [['api',33071,join(checkout,'apps/api/dist/main.js')],['web',44171,join(checkout,'deploy/uat/serve-web.mjs')]]){
    const p=await privateFile(join(root,kind+'-owned.json'));
    demand(p.sourceSha===SOURCE&&p.entry===entry&&Number.isSafeInteger(p.pid)&&p.pid>1,'WRONG_OWNED_PROCESS');
    demand(await command('/bin/ps',['-p',String(p.pid),'-o','command='],checkout)===process.execPath+' '+entry,'PROCESS_COMMAND_CHANGED');
    const listener=await command('lsof',['-nP','-a','-p',String(p.pid),'-iTCP:'+port,'-sTCP:LISTEN'],checkout);
    demand(listener.includes('127.0.0.1:'+port)&&!listener.includes('*:'+port),'WRONG_OWNED_LISTENER');
  }
  demand(hash(await readFile(join(checkout,'apps/web/dist/index.html')))===ready.webIndexSha256,'WEB_BUILD_CHANGED');
  const health=await jsonFetch(API+'/health/ready');
  demand(health.status==='ok'&&health.database==='ok'&&health.documentStorage==='ok','RUNTIME_NOT_READY');
  const req=createRequire(join(checkout,'apps/api/package.json'));
  const {PrismaClient}=req('@prisma/client'),{PasswordService}=req('./dist/auth/password.service.js');
  const db=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+config.databasePassword+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
  try{
    const identity=await db.$queryRawUnsafe('SELECT current_database() AS name,current_user AS username');
    demand(identity.length===1&&identity[0].name==='proto_a_01'&&identity[0].username==='proto_runtime','DATABASE_CONNECTION_MISMATCH');
    const applied=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
    const migrations=await readdir(join(checkout,'apps/api/prisma/migrations'),{withFileTypes:true});
    const expected=[];
    for(const m of migrations.filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))expected.push({name:m.name,
      checksum:hash(await readFile(join(checkout,'apps/api/prisma/migrations',m.name,'migration.sql')))});
    demand(applied.length===expected.length&&applied.every((m,i)=>m.migration_name===expected[i].name&&
      m.checksum===expected[i].checksum&&m.finished_at&&!m.rolled_back_at),'SCHEMA_PROVENANCE_MISMATCH');
    await pristine(db);
    return {root,config,db,passwords:new PasswordService(),operatorMainSha:main};
  }catch(e){await db.$disconnect();throw e;}
}

export async function operator(mode){
  demand(['--plan','--configure'].includes(mode),'USE_PLAN_OR_CONFIGURE');
  const context=await preflight();
  try{
    if(mode==='--plan')return {...summary('SYNTHETIC_ACTOR_PLAN_READY'),persistentFilesCreated:0};
    process.umask(0o077);
    await exclusive(join(context.root,'actors-started.json'),{sourceSha:SOURCE,startedAt:new Date().toISOString()});
    console.log('STEP: PREPARE_PRIVATE_SYNTHETIC_ACTORS');
    const prepared=await provision(context.db,context.passwords);
    const privateActors=Object.fromEntries(Object.entries(prepared.actors).map(([k,a])=>[k,
      Object.fromEntries(Object.entries(a).filter(([field])=>field!=='passwordHash'))]));
    await exclusive(join(context.root,'actors-private.json'),{sourceSha:SOURCE,actors:privateActors});
    console.log('STEP: COMMIT_SCOPED_SYNTHETIC_FIXTURES');
    const fixture=await prepared.commit();
    await exclusive(join(context.root,'actors-fixture-private.json'),{sourceSha:SOURCE,...fixture});
    console.log('STEP: AUTHENTICATED_INITIAL_HTTP_JOURNEYS');
    const client=httpClient(),results=await initialJourneys(context.db,fixture,prepared.actors,client,
      {userId:fixture.adminUserId,email:context.config.adminEmail,password:context.config.adminPassword,expectedRoleCodes:['SYS_ADMIN']});
    await exclusive(join(context.root,'actors-http-evidence-private.json'),{sourceSha:SOURCE,fixture,results,observations:client.observations});
    const result={...summary('SYNTHETIC_ACTORS_INITIAL_HTTP_VERIFIED'),operatorMainSha:context.operatorMainSha,
      functionalActors:8,initialHttpChecks:client.observations.length,syntheticRoleConfigurationVerified:true,
      stockCountRequestEmploymentJourneysVerified:true,observedAt:new Date().toISOString(),
      next:'COMPLETE_AUTHENTICATED_BROWSER_MATERIAL_PLAN_SUBCONTRACT_AND_POPULATED_RECOVERY'};
    await exclusive(join(context.root,'actors-ready.json'),result);return result;
  }finally{await context.db.$disconnect();}
}

// Node canonicalizes ESM URLs through symlinks, including macOS /var -> /private/var.
export async function isEntry(argv,meta){
  if(!argv)return false;
  try{return pathToFileURL(await realpath(resolve(argv))).href===meta;}catch{return false;}
}
if(await isEntry(process.argv[1],import.meta.url)){
  try{demand(process.argv.length===3,'USE_PLAN_OR_CONFIGURE');console.log(JSON.stringify(await operator(process.argv[2]),null,2));}
  catch(e){console.log(JSON.stringify({...summary('SYNTHETIC_ACTORS_BLOCKED'),code:e.safeCode??'OPERATOR_OR_TRANSPORT_FAILED',
    next:'RETURN_STATUS_ONLY_NO_RESET_NO_RETRY_AFTER_PARTIAL_CONFIGURATION'},null,2));process.exitCode=1;}
}
