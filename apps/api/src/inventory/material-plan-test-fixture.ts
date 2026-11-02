import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {BudgetService} from '../budget/budget.service';
import {AuditService} from '../audit/audit.service';
import {ApprovalService} from '../approval/approval.service';
import {NumberSequenceService} from '../administration/number-sequence.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {ProjectScopeService} from '../authorization/project-scope.service';
import {AuthorizationService} from '../authorization/authorization.service';
import {MaterialPlanService} from './material-plan.service';
import {materialRequestFixture} from './material-request-test-fixture';
export async function materialPlanFixture(db:PrismaService){
 const f=await materialRequestFixture(db);
 const codes=['view','create','revise','submit','approve'].map(x=>'inventory.material_plan.'+x);
 async function grant(actor:typeof f.store,extra:string[]){
  const perms=await db.permission.findMany({where:{permissionCode:{in:extra}}});if(perms.length!==extra.length)throw Error('Missing material plan permission definitions');
  await db.rolePermission.createMany({data:perms.map(p=>({roleId:actor.role.id,permissionId:p.id})),skipDuplicates:true});
  const auth=await f.sessions.resolve(actor.session.sessionToken);if(!auth)throw Error('Synthetic plan session invalid');actor.auth=auth;
 }
 await grant(f.store,[...codes,'budget.quantity.view']);
 await grant(f.manager,['inventory.material_plan.view','inventory.material_plan.approve','budget.quantity.view','budget.revision.view','budget.revision.approve']);
 const sourceMaker=f.documentOnly;await grant(sourceMaker,['budget.boq.view','budget.boq.manage','budget.revision.view','budget.revision.submit']);
 const access=new ProjectAccessService(db,new ProjectScopeService(new AuthorizationService())),audit=new AuditService(db);
 const budget=new BudgetService(db,access,audit,new ApprovalService(db),new NumberSequenceService(db));
 await db.numberSequence.create({data:{companyId:f.company.id,entityType:'BUDGET_REVISION',sequenceCode:'BUDGET_REVISION',formatTemplate:'BRYY-###',resetRule:'YEARLY'}});
 const wf=await db.approvalWorkflow.create({data:{companyId:f.company.id,workflowCode:'MP-BUDGET',workflowName:'Synthetic approved Cost BOQ',entityType:'BUDGET_REVISION',steps:{create:[{stepNo:1,stepName:'Independent source checker',requiredApprovals:1,stepRoles:{create:[{roleId:f.manager.role.id}]}}]}}});
 const boq=await budget.createBoq({auth:sourceMaker.auth},f.project.id,'Synthetic plan quantity basis');
 const section=await budget.createSection({auth:sourceMaker.auth},boq.id,{sectionCode:'MP',sectionName:'Synthetic work',sortOrder:1});
 const item=await budget.createItem({auth:sourceMaker.auth},boq.id,{sectionId:section.id,itemCode:'MP-STEEL',description:'Synthetic material quantity',quantity:new Prisma.Decimal('10'),uomId:f.uom.id,rate:new Prisma.Decimal('98765.4321'),sortOrder:1});
 const material2=await db.material.create({data:{companyId:f.company.id,materialCode:'MP-SECOND',materialName:'Synthetic second material',defaultUomId:f.uom.id}});
 const item2=await budget.createItem({auth:sourceMaker.auth},boq.id,{sectionId:section.id,itemCode:'MP-SECOND',description:'Synthetic second quantity',quantity:new Prisma.Decimal('8'),uomId:f.uom.id,rate:new Prisma.Decimal('654321.4321'),sortOrder:2});
 const draft=await budget.createRevisionDraft({auth:sourceMaker.auth},f.project.id,'Synthetic approved quantity source');
 await budget.submitRevision({auth:sourceMaker.auth},draft.id,wf.workflowCode);
 const approved=await budget.approveRevision({auth:f.manager.auth},draft.id,'Independent synthetic source approval');
 const source=await db.budgetRevisionLine.findFirstOrThrow({where:{budgetRevisionId:approved.id,boqItemId:item.id}});
 const source2=await db.budgetRevisionLine.findFirstOrThrow({where:{budgetRevisionId:approved.id,boqItemId:item2.id}});
 const service=new MaterialPlanService(db,access,audit);
 const input=(quantity='6.0000',workPackageCode='PACKAGE-A')=>({requestKey:randomUUID(),projectId:f.project.id,warehouseId:f.warehouse.id,budgetRevisionId:approved.id,workPackageCode,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Synthetic source-backed work package',lines:[{budgetRevisionLineId:source.id,materialId:f.material.id,uomId:f.uom.id,quantity}]});
 return {...f,service,sourceMaker,budget,boq,item,approved,source,source2,material2,wf,input,grant,codes};
}
