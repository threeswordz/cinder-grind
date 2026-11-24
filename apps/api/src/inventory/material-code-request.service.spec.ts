import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {ConflictException,ForbiddenException} from '@nestjs/common';
import type {AuthenticatedUserContext} from '../auth/auth.types';
import type {PrismaService} from '../prisma/prisma.service';
import type {ProjectAccessService} from '../projects/project-access.service';
import {MaterialCodeRequestService} from './material-code-request.service';

const companyId=randomUUID(),projectId=randomUUID();
const storeId=randomUUID(),pmId=randomUUID(),jaiId=randomUUID(),materialId=randomUUID();
const proposal={
  requestedName:'Electrical junction box',suggestedCode:'JB-20',
  suggestedUomCode:'EA',requestReason:'Project site needs a new fitting',
};
const credentials={
  store:{id:storeId,role:'STOREKEEPER',permission:'inventory.material_request.view'},
  pm:{id:pmId,role:'PROJECT_MANAGER',permission:'inventory.stock.view'},
  jai:{id:jaiId,role:'PROCUREMENT_OFFICER',permission:'master.material.manage'},
};
const auth=(id:string,permission:string,role:string):AuthenticatedUserContext=>({
  companyId,userId:id,sessionId:randomUUID(),csrfTokenHash:'a'.repeat(64),
  roleCodes:[role],permissions:[permission],email:'fixture@example.invalid',
  displayName:'Test fixture',
});
const store=auth(storeId,credentials.store.permission,credentials.store.role);
const pm=auth(pmId,credentials.pm.permission,credentials.pm.role);
const jai=auth(jaiId,credentials.jai.permission,credentials.jai.role);

function fixture(options:{
  revokedId?:string;foreignProject?:boolean;duplicateMaterial?:boolean;
  materialOwnerId?:string; materialName?:string; auditCreated?:boolean;
}={}) {
  const trace:string[]=[];
  const events:Array<{
    id:string;entityId:string;actorUserId:string;action:string;
    entityType:string;companyId:string;occurredAt:Date;newValues:unknown;
  }>=[];
  let materialWrites=0;
  let postedStock=0;
  const db={
    userSession:{findFirst:async ({where}:{where:{userId:string}})=>{
      if(options.revokedId===where.userId)return null;
      const target=Object.values(credentials).find(x=>x.id===where.userId);
      return target?{user:{
        employee:{companyId,isActive:true},
        userRoles:[{role:{companyId,isActive:true,roleCode:target.role,
          rolePermissions:[{permission:{permissionCode:target.permission}}]}}],
      }}:null;
    }},
    project:{
      findFirst:async ({where}:{where:{id?:string}})=>{
        trace.push('project');
        return where.id===projectId?{
          id:projectId,projectCode:'PRJ-A',projectName:'Project A',
        }:null;
      },
    },
    material:{
      findFirst:async ({where}:{where:{id?:string;materialName?:unknown}})=>{
        trace.push('material.lookup');
        if(where.materialName)return options.duplicateMaterial?{id:materialId}:null;
        if(where.id!==materialId)return null;
        return {id:materialId,materialName:options.materialName??proposal.requestedName,
          defaultUomId:randomUUID(),createdAt:new Date('2026-11-24T00:00:02Z')};
      },
      create:async()=>{materialWrites++;return null;},
    },
    stockTransaction:{create:async()=>{postedStock++;}},
    auditLog:{
      findMany:async ({where}:{where:{companyId:string;entityType:string;entityId?:string}})=>
        events.filter(x=>x.companyId===where.companyId&&x.entityType===where.entityType&&
          (!where.entityId||x.entityId===where.entityId)),
      findUnique:async ({where}:{where:{id:string}})=>
        events.find(x=>x.id===where.id)??null,
      findFirst:async ({where}:{where:{actorUserId:string;entityId:string}})=>{
        if(options.auditCreated===false||
            (options.materialOwnerId??jaiId)!==where.actorUserId||
            where.entityId!==materialId)return null;
        return {id:randomUUID()};
      },
      create:async ({data}:{data:{
        companyId:string;entityType:string;entityId:string;
        actorUserId:string;action:string;newValues:unknown;
      }})=>{
        const id=randomUUID();
        events.push({...data,id,occurredAt:new Date(Date.now()+events.length*1000)});
        return {id};
      },
    },
    $executeRawUnsafe:async()=>{trace.push('case_lock');return 1;},
    $transaction:async <T>(fn:(tx:unknown)=>Promise<T>):Promise<T>=>fn(db),
  };
  const access={
    assertAccess:async (_:unknown,id:string)=>{
      trace.push('assertAccess');
      if(options.foreignProject||id!==projectId)
        throw new ForbiddenException({code:'PROJECT_ACCESS_DENIED'});
    },
  };
  const service=new MaterialCodeRequestService(db as unknown as PrismaService,
    access as unknown as ProjectAccessService);
  return {service,trace,events,get materialWrites(){return materialWrites;},
    get postedStock(){return postedStock;}};
}

const reason='Reviewed and required for the current project';
test('SS02 Store request PM forwarding Jai canonical material link remains audit-only',async()=>{
  const f=fixture();
  const a=await f.service.create({auth:store},projectId,proposal);
  assert.equal(a.status,'PENDING_PM');
  assert.equal(a.materialCreated,false);
  const b=await f.service.decide({auth:pm},projectId,a.requestId,{
    action:'PM_APPROVE',expectedVersion:1,expectedEventId:a.expectedEventId,note:reason,
  });
  assert.equal(b.status,'PENDING_CREATOR');
  await assert.rejects(
    f.service.decide({auth:jai},projectId,a.requestId,{
      action:'CREATOR_LINK',expectedVersion:2,expectedEventId:'00000000-0000-4000-8000-000000000000',
      note:'Created material',createdMaterialId:materialId,
    }),ConflictException);
  const c=await f.service.decide({auth:jai},projectId,a.requestId,{
    action:'CREATOR_LINK',expectedVersion:2,expectedEventId:b.expectedEventId,
    note:'Material created by authorized master-data service',createdMaterialId:materialId,
  });
  assert.equal(c.status,'COMPLETED');
  assert.equal(c.linkedMaterialId,materialId);
  const rows=await f.service.list(store,projectId);
  assert.equal(rows.length,1);
  assert.deepEqual([rows[0]?.status,rows[0]?.version],['COMPLETED',3]);
  assert.deepEqual([f.materialWrites,f.postedStock],[0,0]);
  assert.ok(f.trace.includes('case_lock'));
  await assert.rejects(
    f.service.decide({auth:jai},projectId,a.requestId,{
      action:'CREATOR_LINK',expectedVersion:2,expectedEventId:b.expectedEventId,
      note:'Replay old event',createdMaterialId:materialId,
    }),ConflictException);
});

test('SS02 Store cannot PM-review; PM cannot bypass existing master-material grant',async()=>{
  const f=fixture();
  const a=await f.service.create({auth:store},projectId,proposal);
  await assert.rejects(f.service.decide({auth:store},projectId,a.requestId,{
    action:'PM_APPROVE',expectedVersion:1,expectedEventId:a.expectedEventId,note:reason,
  }),ForbiddenException);
  const b=await f.service.decide({auth:pm},projectId,a.requestId,{
    action:'PM_APPROVE',expectedVersion:1,expectedEventId:a.expectedEventId,note:reason,
  });
  await assert.rejects(f.service.decide({auth:pm},projectId,a.requestId,{
    action:'CREATOR_LINK',expectedVersion:2,expectedEventId:b.expectedEventId,
    note:'Unauthorized material creation',createdMaterialId:materialId,
  }),ForbiddenException);
  assert.equal(f.materialWrites,0);
});

test('SS02 creator cannot claim prior material, another creator or wrong Company source',async()=>{
  for(const extra of [{auditCreated:false},{materialOwnerId:randomUUID()},
    {materialName:'Unrelated material'}]){
    const f=fixture(extra);
    const a=await f.service.create({auth:store},projectId,proposal);
    const b=await f.service.decide({auth:pm},projectId,a.requestId,{
      action:'PM_APPROVE',expectedVersion:1,expectedEventId:a.expectedEventId,note:reason,
    });
    await assert.rejects(f.service.decide({auth:jai},projectId,a.requestId,{
      action:'CREATOR_LINK',expectedVersion:2,expectedEventId:b.expectedEventId,
      note:'Wrong material provenance',createdMaterialId:materialId,
    }),ConflictException);
    assert.equal(f.materialWrites,0);
  }
});

test('SS02 revoked user, foreign Project, and duplicate existing material are denied',async()=>{
  const revoked=fixture({revokedId:storeId});
  await assert.rejects(revoked.service.create({auth:store},projectId,proposal),
    ForbiddenException);
  const foreign=fixture({foreignProject:true});
  await assert.rejects(foreign.service.create({auth:store},projectId,proposal),
    ForbiddenException);
  assert.ok(!foreign.trace.includes('material.lookup'));
  const duplicate=fixture({duplicateMaterial:true});
  await assert.rejects(duplicate.service.create({auth:store},projectId,proposal),
    ConflictException);
});

test('SS02 PM return is a terminal preserved case, not a silent creation',async()=>{
  const f=fixture();
  const a=await f.service.create({auth:store},projectId,proposal);
  const b=await f.service.decide({auth:pm},projectId,a.requestId,{
    action:'PM_RETURN',expectedVersion:1,expectedEventId:a.expectedEventId,
    note:'Please describe the exact fitting',
  });
  assert.equal(b.status,'RETURNED');
  await assert.rejects(f.service.decide({auth:jai},projectId,a.requestId,{
    action:'CREATOR_LINK',expectedVersion:2,expectedEventId:b.expectedEventId,
    note:'Should not complete returned case',createdMaterialId:materialId,
  }),ForbiddenException);
  assert.equal(f.materialWrites,0);
});
