import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mpCreate,mpRevise,mpAction,mpDate,mpQuantity,mpVersion} from './material-plan-contract';
test('material plan input preserves exact quantities, valid dates and strict replay/version bodies',()=>{
 const body={requestKey:randomUUID(),projectId:randomUUID(),warehouseId:randomUUID(),budgetRevisionId:randomUUID(),workPackageCode:'Work',validFrom:'2026-11-01',validTo:'2026-11-30',reason:'Plan',lines:[{budgetRevisionLineId:randomUUID(),materialId:randomUUID(),uomId:randomUUID(),quantity:'90071992547409.1234'}]};
 assert.equal(mpCreate(body).lines[0]!.quantity,'90071992547409.1234');
 for(const qty of [0,1,'0','0.0000','-1','1e3','NaN','Infinity','01','100000000000000','1.00001'])assert.throws(()=>mpQuantity(qty));
 for(const date of ['2026-02-30','0000-01-01','2026-13-01','2026-1-01','2026-01-01T00:00:00Z'])assert.throws(()=>mpDate(date,'date'));
 assert.throws(()=>mpCreate({...body,companyId:randomUUID()}));assert.throws(()=>mpCreate({...body,validTo:'2026-10-01'}));assert.throws(()=>mpCreate({...body,lines:[...body.lines,...body.lines]}));
 assert.throws(()=>mpRevise({...body,expectedVersion:1}));assert.throws(()=>mpAction({requestKey:randomUUID(),expectedVersion:1,decision:'APPROVED',comment:'x'},true));
 for(const v of [0,-1,1.1,2147483647,'1'])assert.throws(()=>mpVersion(v));
});

import {Prisma} from '@prisma/client';
import {materialPlanIntegrityException} from './material-plan-errors';
test('only exact Prisma material-plan allocation guards become safe conflicts',()=>{
 const message='PostgresError { code: "P0001", message: "Material plan cumulative source allocation exceeded", severity: "ERROR" }';
 const unknown=(text:string)=>new Prisma.PrismaClientUnknownRequestError(text,{clientVersion:'6.19.3'});
 const result=materialPlanIntegrityException(unknown(message));assert.equal(result?.getStatus(),409);assert.deepEqual(result?.getResponse(),{code:'MATERIAL_PLAN_INTEGRITY_CONFLICT'});
 assert.equal(materialPlanIntegrityException(unknown(message.replace('P0001','42P01'))),undefined);
 assert.equal(materialPlanIntegrityException(unknown(message.replace('Material plan cumulative source allocation exceeded','unrelated failure'))),undefined);
 assert.equal(materialPlanIntegrityException(new Error(message)),undefined);
});

import {MaterialPlanService} from './material-plan.service';
import {ConflictException} from '@nestjs/common';
test('exhausted serializable retries return a bounded conflict without leaking database details',async()=>{
 let attempts=0;
 const db={$transaction:async()=>{attempts++;throw new Prisma.PrismaClientKnownRequestError('synthetic serialization failure',{code:'P2034',clientVersion:'6.19.3'});}};
 const service=new MaterialPlanService(db as any,{} as any,{} as any);
 const body={requestKey:randomUUID(),projectId:randomUUID(),warehouseId:randomUUID(),budgetRevisionId:randomUUID(),workPackageCode:'Retry',validFrom:'2026-11-01',validTo:'2026-11-30',reason:'Synthetic retry',lines:[{budgetRevisionLineId:randomUUID(),materialId:randomUUID(),uomId:randomUUID(),quantity:'1'}]};
 await assert.rejects(()=>service.create({auth:{} as any},body),(error:unknown)=>error instanceof ConflictException && error.getStatus()===409 && (error.getResponse() as any).code==='MATERIAL_PLAN_RETRY_REQUIRED');
 assert.equal(attempts,3);
});
