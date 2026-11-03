import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {AuditService} from '../audit/audit.service';
import {ApprovalService} from '../approval/approval.service';
import {NumberSequenceService} from '../administration/number-sequence.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {ProjectScopeService} from '../authorization/project-scope.service';
import {AuthorizationService} from '../authorization/authorization.service';
import {InventoryQuantityService} from './inventory-quantity.service';
import {MaterialReturnService} from './material-return.service';
import {materialPlanFixture} from './material-plan-test-fixture';
import {MaterialPlanIssueService} from './material-plan-issue.service';
import {MPI} from './material-plan-issue-contract';
export async function materialPlanIssueFixture(db:PrismaService){
 const f=await materialPlanFixture(db),ben=f.sourceMaker;
 await f.grant(f.store,[MPI.post,'inventory.return.view','inventory.return.create','inventory.return.edit','inventory.return.submit','inventory.return.reverse','inventory.issue.reverse']);
 await f.grant(f.manager,[MPI.review,'inventory.return.view','inventory.return.approve']);
 await f.grant(ben,['inventory.material_plan.view','budget.quantity.view','inventory.issue.view',MPI.approve,MPI.enable]);
 await f.grant(f.outsider,['inventory.material_plan.view','budget.quantity.view']);
 const access=new ProjectAccessService(db,new ProjectScopeService(new AuthorizationService())),audit=new AuditService(db),approvals=new ApprovalService(db);
 const controls=new MaterialPlanIssueService(db,access,audit,approvals,f.issues);
 const returns=new MaterialReturnService(db,access,audit,approvals,new NumberSequenceService(db),new InventoryQuantityService(db));
 const workflow=await db.approvalWorkflow.create({data:{companyId:f.company.id,workflowCode:'MP-OVERAGE',workflowName:'Synthetic Khaimook then Ben',entityType:'MATERIAL_PLAN_OVERAGE',steps:{create:[
  {stepNo:1,stepName:'Independent project reviewer',requiredApprovals:1,stepRoles:{create:[{roleId:f.manager.role.id}]}},
  {stepNo:2,stepName:'Independent final authority',requiredApprovals:1,stepRoles:{create:[{roleId:ben.role.id}]}},
 ]}}});
 await db.numberSequence.create({data:{companyId:f.company.id,entityType:'MATERIAL_RETURN',sequenceCode:'MATERIAL_RETURN',formatTemplate:'MRTYYMM-###',resetRule:'MONTHLY'}});
 const returnWorkflow=await db.approvalWorkflow.create({data:{companyId:f.company.id,workflowCode:'MP-RETURN',workflowName:'Synthetic canonical return',entityType:'MATERIAL_RETURN',steps:{create:[{stepNo:1,stepName:'Independent return checker',requiredApprovals:1,stepRoles:{create:[{roleId:f.manager.role.id}]}}]}}});
 const historical=await f.issue('1',false);
 let p=await f.service.create({auth:f.store.auth},f.input('6')) as {id:string;version:number};
 p=await f.service.submit({auth:f.store.auth},p.id,{requestKey:randomUUID(),expectedVersion:p.version}) as {id:string;version:number};
 await f.service.decide({auth:f.manager.auth},p.id,{requestKey:randomUUID(),expectedVersion:p.version,decision:'APPROVE',comment:'Independent source plan'});
 const plan=await f.service.get(f.store.auth,p.id);if(!plan.approvedRevision)throw Error('Approved synthetic plan missing');
 const enableInput=()=>({requestKey:randomUUID(),workflowCode:workflow.workflowCode,confirmation:'ISOLATED_SYNTHETIC',reason:'Owned disposable synthetic policy'});
 const pin=async(issueId:string,lineId=plan.approvedRevision!.lines[0]!.id)=>{
  const issue=await f.issues.get(f.store.auth,issueId),current=await f.service.get(f.store.auth,plan.id);
  return {requestKey:randomUUID(),bindings:issue.items.map(i=>({issueItemId:i.id,planLineId:lineId,expectedPlanVersion:current.version}))};
 };
 const sourceReturn=async(issueId:string,quantity:string)=>{
  const issue=await f.issues.get(f.store.auth,issueId);
  const r=await returns.create({auth:f.store.auth},{projectId:f.project.id,warehouseId:f.warehouse.id,returnDate:new Date('2026-11-02'),lines:[{materialIssueItemId:issue.items[0]!.id,quantity:new Prisma.Decimal(quantity)}]});
  await returns.submit({auth:f.store.auth},r.id,returnWorkflow.workflowCode);await returns.approve({auth:f.manager.auth},r.id,randomUUID());return returns.get(f.store.auth,r.id);
 };
 return {...f,ben,controls,returns,workflow,returnWorkflow,historical,plan,enableInput,pin,sourceReturn};
}
