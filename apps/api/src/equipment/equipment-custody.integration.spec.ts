import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { EquipmentService } from './equipment.service';
import { EquipmentCustodyService } from './equipment-custody.service';

const issuedOn=new Date('2026-11-20T00:00:00.000Z');
const dueOn=new Date('2026-11-30T00:00:00.000Z');
const returnedOn=new Date('2026-11-22T00:00:00.000Z');
function context(companyId:string,userId:string,sessionId:string,manage=true):AuthenticatedUserContext {
  return {sessionId,companyId,userId,email:'ss11@example.test',
    displayName:'Store',roleCodes:['STOREKEEPER'],csrfTokenHash:'0'.repeat(64),
    permissions:['equipment.custody.view',...(manage?['equipment.custody.manage']:[])]};
}

test('SS11 native PG employee custody: scope, concurrent checkout/return, immutable audit',async()=>{
  const db=new PrismaService();
  await db.$connect();
  try {
    // Exercise the installed SQL calendar in deliberately different session
    // timezones; fixed instants make the Bangkok midnight regression deterministic.
    await db.$transaction(async tx=>{
      for(const zone of ['UTC','Asia/Singapore','Asia/Bangkok']){
        await tx.$queryRawUnsafe("SELECT set_config('TimeZone',$1,true)",zone);
        const rows=await tx.$queryRawUnsafe<{before:string;after:string;sg:string;leap:string}[]>(
          "SELECT equipment_custody_thailand_day('2026-11-24T16:59:59.999Z'::timestamptz)::text AS before, "+
          "equipment_custody_thailand_day('2026-11-24T17:00:00Z'::timestamptz)::text AS after, "+
          "equipment_custody_thailand_day('2026-11-24T16:00:00Z'::timestamptz)::text AS sg, "+
          "equipment_custody_thailand_day('2028-02-28T17:00:00Z'::timestamptz)::text AS leap");
        assert.deepEqual(rows[0],{before:'2026-11-24',after:'2026-11-25',sg:'2026-11-24',leap:'2028-02-29'});
      }
      const guards=await tx.$queryRawUnsafe<{definition:string}[]>(
        "SELECT pg_get_functiondef('guard_equipment_custody_loan()'::regprocedure) AS definition");
      assert.match(guards[0]!.definition,/equipment_custody_thailand_day\(statement_timestamp\(\)\)/);
      assert.doesNotMatch(guards[0]!.definition,/CURRENT_DATE/i);
    });
    const suffix=randomUUID().slice(0,8);
    const company=await db.company.create({data:{companyCode:'SS11-'+suffix,companyName:'Custody test'}});
    const foreign=await db.company.create({data:{companyCode:'SS11-F-'+suffix,companyName:'Foreign'}});
    const customer=await db.customer.create({data:{companyId:company.id,customerCode:'C-'+suffix,customerName:'Customer'}});
    const foreignCustomer=await db.customer.create({data:{companyId:foreign.id,customerCode:'F-'+suffix,customerName:'Foreign'}});
    const projectDates={contractValue:'1000',plannedStartDate:new Date('2026-10-01T00:00:00.000Z'),
      plannedCompletionDate:new Date('2026-12-31T00:00:00.000Z')};
    const project=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'P-'+suffix,projectName:'Site A',...projectDates}});
    const second=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'Q-'+suffix,projectName:'Site B',...projectDates}});
    const outside=await db.project.create({data:{companyId:foreign.id,customerId:foreignCustomer.id,projectCode:'F-'+suffix,projectName:'Outside',...projectDates}});
    const operator=await db.employee.create({data:{companyId:company.id,employeeCode:'OP-'+suffix,employeeName:'Operator'}});
    const borrower=await db.employee.create({data:{companyId:company.id,employeeCode:'BO-'+suffix,employeeName:'Borrower'}});
    const disabled=await db.employee.create({data:{companyId:company.id,employeeCode:'DI-'+suffix,employeeName:'Disabled',isActive:false}});
    const user=await db.user.create({data:{companyId:company.id,employeeId:operator.id,email:'ss11-'+suffix+'@example.test',
      displayName:'Operator',passwordHash:'x'}});
    // Disposable fixture roles and session only. No retained role grants.
    const role=await db.role.create({data:{companyId:company.id,roleCode:'STOREKEEPER',roleName:'Storekeeper'}});
    const view=await db.permission.findUniqueOrThrow({where:{permissionCode:'equipment.custody.view'}});
    const manage=await db.permission.findUniqueOrThrow({where:{permissionCode:'equipment.custody.manage'}});
    await db.rolePermission.createMany({data:[
      {roleId:role.id,permissionId:view.id},{roleId:role.id,permissionId:manage.id}]});
    await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
    const session=await db.userSession.create({data:{
      userId:user.id,tokenHash:randomUUID().replaceAll('-',''),
      csrfTokenHash:'0'.repeat(64),expiresAt:new Date(Date.now()+60*60*1000)}});
    await db.projectMember.createMany({data:[
      {projectId:project.id,employeeId:operator.id,projectRole:'site'},
      {projectId:project.id,employeeId:borrower.id,projectRole:'site'},
      {projectId:project.id,employeeId:disabled.id,projectRole:'site'}]});
    const access=new ProjectAccessService(db,new ProjectScopeService(new AuthorizationService()));
    const audit=new AuditService(db);
    const equipment=new EquipmentService(db,access,audit);
    const custody=new EquipmentCustodyService(db,access,audit);
    const auth=context(company.id,user.id,session.id);
    const type=await equipment.createType({auth},{equipmentTypeCode:'T-'+suffix,equipmentTypeName:'Tool'});
    const tool=await equipment.createEquipment({auth},{equipmentTypeId:type.id,
      equipmentCode:'CG'+String(parseInt(suffix.slice(0,6),16)%100000).padStart(5,'0'),
      equipmentName:'Tool',operationalStatus:'AVAILABLE'});
    await equipment.assign({auth},tool.id,{projectId:project.id,assignedFrom:issuedOn});
    const loan={equipmentId:tool.id,projectId:project.id,borrowerEmployeeId:borrower.id,
      siteLabel:'Block A',issuedOn,dueOn,conditionOut:'Good'};
    await assert.rejects(()=>custody.checkout({auth:context(company.id,user.id,session.id,false)},loan),
      (e:unknown)=>e instanceof ForbiddenException);
    await assert.rejects(()=>custody.checkout({auth},{...loan,borrowerEmployeeId:disabled.id}),
      (e:unknown)=>e instanceof ConflictException);
    await assert.rejects(()=>custody.checkout({auth},{...loan,projectId:second.id}));
    await assert.rejects(()=>custody.checkout({auth},{...loan,projectId:outside.id}));
    const issued=await Promise.allSettled([custody.checkout({auth},loan),custody.checkout({auth},loan)]);
    assert.equal(issued.filter(x=>x.status==='fulfilled').length,1);
    const id=(issued.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<{id:string}>).value.id;
    const assigned=await db.equipmentAssignment.findFirstOrThrow({where:{equipmentId:tool.id}});
    await assert.rejects(()=>equipment.release({auth},assigned.id,returnedOn));
    const returned=await Promise.allSettled([
      custody.returnLoan({auth},id,{returnedOn,conditionIn:'Good'}),
      custody.returnLoan({auth},id,{returnedOn,conditionIn:'Damaged'})]);
    assert.equal(returned.filter(x=>x.status==='fulfilled').length,1);
    await assert.rejects(()=>custody.returnLoan({auth},id,{returnedOn,conditionIn:'Replay'}),
      (e:unknown)=>e instanceof ConflictException);
    await assert.rejects(()=>db.$executeRawUnsafe('DELETE FROM equipment_custody_loans WHERE id=$1::uuid',id));
    const history=await custody.list(auth,project.id,tool.id);
    assert.equal(history.length,1);
    const persistedLoan = history[0];
    assert.ok(persistedLoan, 'The returned custody loan must remain in history.');
    assert.equal(persistedLoan.borrowerEmployeeId,borrower.id);
    assert.equal(persistedLoan.returnedOn?.toISOString().slice(0,10),'2026-11-22');
    const actions=await db.auditLog.findMany({where:{companyId:company.id,entityType:'EQUIPMENT_CUSTODY',entityId:id}});
    assert.deepEqual(actions.map(e=>e.action).sort(),['CHECKOUT','RETURN']);

    // A stale cookie/request context must not resurrect a revoked live grant.
    await db.rolePermission.delete({
      where:{roleId_permissionId:{roleId:role.id,permissionId:manage.id}}});
    await assert.rejects(()=>custody.checkout({auth},loan),
      (e:unknown)=>e instanceof ForbiddenException);
    assert.equal((await custody.list(auth,project.id,tool.id)).length,1);
    await db.rolePermission.create({data:{roleId:role.id,permissionId:manage.id}});

    await db.role.update({where:{id:role.id},data:{isActive:false}});
    await assert.rejects(()=>custody.checkout({auth},loan),
      (e:unknown)=>e instanceof ForbiddenException);
    await db.role.update({where:{id:role.id},data:{isActive:true}});

    await db.userSession.update({where:{id:session.id},data:{revokedAt:new Date()}});
    await assert.rejects(()=>custody.checkout({auth},loan),
      (e:unknown)=>e instanceof ForbiddenException);
    await assert.rejects(()=>custody.list(auth,project.id,tool.id),
      (e:unknown)=>e instanceof ForbiddenException);
    await db.userSession.update({where:{id:session.id},data:{revokedAt:null}});

    await db.user.update({where:{id:user.id},data:{isActive:false}});
    await assert.rejects(()=>custody.checkout({auth},loan),(e:unknown)=>e instanceof ForbiddenException);
  } finally {await db.$disconnect();}
});
