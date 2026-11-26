import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { MasterDataService } from '../master-data/master-data.service';
import { MaterialCodeRequestService } from './material-code-request.service';

const D=(s:string)=>new Prisma.Decimal(s);

/** New-only SS02 native test; never retained MKE/TCJ or a historical master-data rerun. */
test('SS02 native PG17: Store→independent PM→authorized master CREATE audit; Company/Project/session denial',async()=>{
  const db=new PrismaService();
  await db.$connect();
  try{
    const key=randomUUID().slice(0,8);
    const company=await db.company.create({data:{
      companyCode:'SS02A-'+key,companyName:'SS02 disposable Company A',
    }});
    const foreignCompany=await db.company.create({data:{
      companyCode:'SS02B-'+key,companyName:'SS02 disposable Company B',
    }});
    const customer=await db.customer.create({data:{
      companyId:company.id,customerCode:'SS02C-'+key,customerName:'SS02 disposable Customer',
    }});
    const project=await db.project.create({data:{
      companyId:company.id,customerId:customer.id,projectCode:'SS02P-'+key,
      projectName:'Authorized SS02 Project',contractValue:D('1000'),
      plannedStartDate:new Date('2026-10-01T00:00:00Z'),
      plannedCompletionDate:new Date('2027-01-01T00:00:00Z'),
    }});
    const otherProject=await db.project.create({data:{
      companyId:company.id,customerId:customer.id,projectCode:'SS02O-'+key,
      projectName:'Foreign same-Company Project',contractValue:D('1000'),
      plannedStartDate:new Date('2026-10-01T00:00:00Z'),
      plannedCompletionDate:new Date('2027-01-01T00:00:00Z'),
    }});
    const uom=await db.unitOfMeasure.create({data:{
      companyId:company.id,uomCode:'EA-'+key,uomName:'Each',
      decimalPlaces:0,
    }});

    // Real persisted role permissions, active employees, sessions and project
    // membership. No SYS_ADMIN fallback or artificial direct access grant.
    const identities=[
      {name:'Store',companyId:company.id,projectId:project.id,
        roleCode:'STOREKEEPER',permissions:['inventory.material_request.view']},
      {name:'Khaimook',companyId:company.id,projectId:project.id,
        roleCode:'PROJECT_MANAGER',permissions:['inventory.stock.view']},
      {name:'Jai',companyId:company.id,projectId:project.id,
        roleCode:'PROCUREMENT_OFFICER',
        permissions:['master.material.view','master.material.manage']},
      {name:'ForeignPM',companyId:company.id,projectId:otherProject.id,
        roleCode:'PROJECT_MANAGER',permissions:['inventory.stock.view']},
      {name:'ForeignStore',companyId:foreignCompany.id,projectId:undefined,
        roleCode:'STOREKEEPER',permissions:['inventory.material_request.view']},
    ] as const;
    const output: Array<{userId:string;employeeId:string;
      roleId:string;auth:AuthenticatedUserContext}>=[];

    for(const [index,item] of identities.entries()){
      const employee=await db.employee.create({data:{
        companyId:item.companyId,employeeCode:'S02E-'+index+'-'+key,
        employeeName:'Synthetic '+item.name,
      }});
      const user=await db.user.create({data:{
        companyId:item.companyId,employeeId:employee.id,
        email:'ss02-'+index+'-'+key+'@example.invalid',
        displayName:item.name+' SS02',passwordHash:'synthetic-no-login',
      }});
      if(item.projectId)await db.projectMember.create({data:{
        employeeId:employee.id,projectId:item.projectId,projectRole:'SS02 test member',
      }});
      // RoleCode may repeat within different companies; same-Company role
      // reuse is intentional and does not broaden any actor's permissions.
      let role=await db.role.findFirst({where:{
        companyId:item.companyId,roleCode:item.roleCode,
      }});
      if(!role)role=await db.role.create({data:{
        companyId:item.companyId,roleCode:item.roleCode,
        roleName:'SS02 '+item.roleCode,
      }});
      await db.userRole.create({data:{
        companyId:item.companyId,userId:user.id,roleId:role.id,
      }});
      for(const permissionCode of item.permissions){
        const permission=await db.permission.upsert({
          where:{permissionCode},
          create:{permissionCode,moduleCode:permissionCode.startsWith('master.')?
            'MASTER':'INVENTORY',description:'SS02 existing capability fixture'},
          update:{},
        });
        await db.rolePermission.upsert({
          where:{roleId_permissionId:{roleId:role.id,permissionId:permission.id}},
          create:{roleId:role.id,permissionId:permission.id},
          update:{},
        });
      }
      const session=await db.userSession.create({data:{
        userId:user.id,tokenHash:randomUUID().replace(/-/g,'')+
          randomUUID().replace(/-/g,''),
        csrfTokenHash:'c'.repeat(64),expiresAt:new Date(Date.now()+3600000),
      }});
      output.push({
        userId:user.id,employeeId:employee.id,roleId:role.id,
        auth:{sessionId:session.id,userId:user.id,companyId:item.companyId,
          email:user.email,displayName:user.displayName,
          roleCodes:[item.roleCode],permissions:[...item.permissions],
          csrfTokenHash:'c'.repeat(64)},
      });
    }
    const [store,pm,jai,outsider,foreign]=output as [
      (typeof output)[number],(typeof output)[number],(typeof output)[number],
      (typeof output)[number],(typeof output)[number]
    ];
    const access=new ProjectAccessService(db,
      new ProjectScopeService(new AuthorizationService()));
    const requestService=new MaterialCodeRequestService(db,access);
    const canonicalMaster=new MasterDataService(db,new AuditService(db));
    const proposal={
      requestedName:'SS02 Galvanized fitting '+key,
      suggestedCode:'SS02-PROPOSED-'+key,
      suggestedUomCode:'EA-'+key,
      requestReason:'Store Site requests a new approved fitting for this job',
    };

    await assert.rejects(
      ()=>requestService.create({auth:foreign.auth},project.id,proposal),
      (e:unknown)=>e instanceof NotFoundException||e instanceof ForbiddenException,
    );
    await assert.rejects(
      ()=>requestService.list(outsider.auth,project.id),ForbiddenException,
    );
    assert.equal(await db.material.count({where:{companyId:company.id}}),0);

    const requested=await requestService.create({auth:store.auth},project.id,proposal);
    assert.equal(requested.status,'PENDING_PM');
    assert.equal(await db.material.count({where:{companyId:company.id}}),0);

    // Even granting PM role to the maker does not allow self-review.
    await db.userRole.create({data:{
      companyId:company.id,userId:store.userId,roleId:pm.roleId,
    }});
    const makerWithPmRole={...store.auth,
      roleCodes:['STOREKEEPER','PROJECT_MANAGER'],
      permissions:['inventory.material_request.view','inventory.stock.view']};
    await assert.rejects(()=>requestService.decide({auth:makerWithPmRole},
      project.id,requested.requestId,{
        action:'PM_APPROVE',expectedVersion:1,
        expectedEventId:requested.expectedEventId,
        note:'Attempted maker PM self-review',
      }),ForbiddenException);

    const reviewed=await requestService.decide({auth:pm.auth},
      project.id,requested.requestId,{
        action:'PM_APPROVE',expectedVersion:1,
        expectedEventId:requested.expectedEventId,
        note:'Khaimook confirms fitting required by the site',
      });
    assert.equal(reviewed.status,'PENDING_CREATOR');
    await assert.rejects(()=>requestService.decide({auth:jai.auth},
      project.id,requested.requestId,{
        action:'CREATOR_LINK',expectedVersion:2,
        expectedEventId:reviewed.expectedEventId,
        note:'No canonical material created yet',createdMaterialId:randomUUID(),
      }),ConflictException);
    assert.equal(await db.material.count({where:{companyId:company.id}}),0);

    // Canonical creation happens independently through the unchanged
    // MasterDataService, which records the MATERIAL CREATE audit.
    const material=await canonicalMaster.createMaterial({auth:jai.auth},{
      materialCode:'S02-CREATED-'+key,
      materialName:proposal.requestedName,
      defaultUomId:uom.id,
      description:'Created after Khaimook approval',
    });
    const canonicalEvent=await db.auditLog.findFirst({where:{
      companyId:company.id,entityType:'MATERIAL',
      entityId:material.id,action:'CREATE',actorUserId:jai.userId,
    }});
    assert.ok(canonicalEvent);

    await db.userSession.update({
      where:{id:jai.auth.sessionId},data:{revokedAt:new Date()},
    });
    await assert.rejects(()=>requestService.decide({auth:jai.auth},
      project.id,requested.requestId,{
        action:'CREATOR_LINK',expectedVersion:2,
        expectedEventId:reviewed.expectedEventId,
        note:'Revoked creator must not finish case',createdMaterialId:material.id,
      }),ForbiddenException);

    // Re-authentication is synthetic, not a retained-user grant.
    const newSession=await db.userSession.create({data:{
      userId:jai.userId,tokenHash:randomUUID().replace(/-/g,'')+
        randomUUID().replace(/-/g,''),
      csrfTokenHash:'d'.repeat(64),expiresAt:new Date(Date.now()+3600000),
    }});
    const linked=await requestService.decide({
      auth:{...jai.auth,sessionId:newSession.id,csrfTokenHash:'d'.repeat(64)},
    },project.id,requested.requestId,{
      action:'CREATOR_LINK',expectedVersion:2,
      expectedEventId:reviewed.expectedEventId,
      note:'Jai links verified canonical new material audit',createdMaterialId:material.id,
    });
    assert.deepEqual([linked.status,linked.linkedMaterialId,linked.materialCreated],
      ['COMPLETED',material.id,false]);

    const rows=await requestService.list(store.auth,project.id);
    assert.deepEqual([rows.length,rows[0]?.status,rows[0]?.version],
      [1,'COMPLETED',3]);
    assert.equal(rows[0]?.requestedByUserId,store.userId);
    assert.equal(rows[0]?.pmUserId,pm.userId);
    assert.equal(rows[0]?.creatorUserId,jai.userId);
    assert.equal(await db.auditLog.count({where:{
      companyId:company.id,entityType:'SS02_MATERIAL_CODE_REQUEST',
      entityId:requested.requestId,
    }}),3);
    assert.equal(await db.material.count({where:{companyId:company.id}}),1);
    assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),0);
    console.log('SS02_NATIVE_PG_CANONICAL_MATERIAL_HANDOFF_AND_AUDIT_PASS');
  } finally {
    await db.$disconnect();
  }
});
