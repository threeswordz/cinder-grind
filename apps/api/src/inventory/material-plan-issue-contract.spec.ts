import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {mpiEnable,mpiPost,mpiDecision,mpiIntegrity} from './material-plan-issue-contract';
import {MaterialPlanIssueService} from './material-plan-issue.service';
test('plan issue requests reject implicit activation, unknown authority/payload fields and incomplete replay bindings',()=>{
 const key=randomUUID(),pin={issueItemId:randomUUID(),planLineId:randomUUID(),expectedPlanVersion:1};
 assert.equal(mpiEnable({requestKey:key,workflowCode:'W',reason:'Owned fixture',confirmation:'ISOLATED_SYNTHETIC'}).confirmation,'ISOLATED_SYNTHETIC');
 assert.throws(()=>mpiEnable({requestKey:key,workflowCode:'W',reason:'No confirmation'}));
 assert.throws(()=>mpiEnable({requestKey:key,workflowCode:'W',reason:'Fixture',confirmation:'PRODUCTION'}));
 assert.throws(()=>mpiPost({requestKey:key,bindings:[pin,pin]}));
 assert.throws(()=>mpiPost({requestKey:key,bindings:[{...pin,quantity:'100'}]}));
 assert.throws(()=>mpiPost({requestKey:key,bindings:[{...pin,expectedPlanVersion:0}]}));
 assert.throws(()=>mpiPost({requestKey:key,bindings:[],benApproved:true}));
 assert.throws(()=>mpiDecision({requestKey:key,decision:'APPROVE',comment:'Independent',delegateUserId:randomUUID()}));
});
test('only exact module P0001 guard failures are translated; unrelated database failures remain visible',()=>{
 const msg='PostgresError { code: "P0001", message: "Material plan issue allowance or approval stale", severity: "ERROR" }';
 const err=(s:string)=>new Prisma.PrismaClientUnknownRequestError(s,{clientVersion:'6.19.3'});
 assert.equal(mpiIntegrity(err(msg))?.getStatus(),409);
 assert.equal(mpiIntegrity(err(msg.replace('P0001','42P01'))),undefined);
 assert.equal(mpiIntegrity(err(msg.replace('allowance or approval stale','unrelated server failure'))),undefined);
 assert.equal(mpiIntegrity(new Error(msg)),undefined);
 const raw=(code:string,message:string)=>new Prisma.PrismaClientKnownRequestError('Raw query failed',{clientVersion:'6.19.3',code:'P2010',meta:{code,message}});
 assert.equal(mpiIntegrity(raw('P0001','Material plan issue allowance or approval stale'))?.getStatus(),409);
 assert.equal(mpiIntegrity(raw('42P01','Material plan issue allowance or approval stale')),undefined);
 assert.equal(mpiIntegrity(raw('P0001','Unrelated server failure')),undefined);
});
test('exhausted plan issue serializable retries are bounded and cannot return server success or duplicate work',async()=>{
 let attempts=0;const db={$transaction:async()=>{attempts++;throw new Prisma.PrismaClientKnownRequestError('serialization',{clientVersion:'6.19.3',code:'P2034'});}};
 const service=new MaterialPlanIssueService(db as any,{} as any,{} as any,{} as any,{} as any);
 await assert.rejects(()=>service.withinPlan({auth:{} as any},randomUUID(),{requestKey:randomUUID(),bindings:[{issueItemId:randomUUID(),planLineId:randomUUID(),expectedPlanVersion:1}]}),(e:any)=>e.getStatus()===409&&e.getResponse().code==='MATERIAL_PLAN_ISSUE_RETRY_REQUIRED');
 assert.equal(attempts,3);
});
