import {ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {mpId,mpObject,mpText,mpVersion,mpInvalid} from './material-plan-contract';
export const MPI={post:'inventory.material_plan.issue.post',review:'inventory.material_plan.overage.review',approve:'inventory.material_plan.overage.approve',enable:'inventory.material_plan.prototype.enable'} as const;
export function mpiEnable(v:unknown){const r=mpObject(v,['requestKey','workflowCode','reason','confirmation']);if(r.confirmation!=='ISOLATED_SYNTHETIC')return mpInvalid('confirmation');return {requestKey:mpId(r.requestKey,'requestKey'),workflowCode:mpText(r.workflowCode,'workflowCode',100),reason:mpText(r.reason,'reason'),confirmation:'ISOLATED_SYNTHETIC' as const};}
export function mpiPost(v:unknown){
 const r=mpObject(v,['requestKey','bindings']);if(!Array.isArray(r.bindings)||!r.bindings.length||r.bindings.length>200)return mpInvalid('bindings');
 const bindings=r.bindings.map(v=>{const b=mpObject(v,['issueItemId','planLineId','expectedPlanVersion']);return {issueItemId:mpId(b.issueItemId,'issueItemId'),planLineId:mpId(b.planLineId,'planLineId'),expectedPlanVersion:mpVersion(b.expectedPlanVersion)};}).sort((a,b)=>a.issueItemId.localeCompare(b.issueItemId));
 if(new Set(bindings.map(b=>b.issueItemId)).size!==bindings.length)return mpInvalid('bindings');
 return {requestKey:mpId(r.requestKey,'requestKey'),bindings};
}
export function mpiDecision(v:unknown){const r=mpObject(v,['requestKey','decision','comment']);if(r.decision!=='APPROVE'&&r.decision!=='REJECT')return mpInvalid('decision');return {requestKey:mpId(r.requestKey,'requestKey'),decision:r.decision,comment:mpText(r.comment,'comment')};}
const messages=['serializable transaction required','canonical return credit invalid','scope or payload changed','actor authority invalid','complete batch required','source or effective version invalid','allowance or approval stale','approval configuration stale','independent approval required','history immutable','policy scope invalid','historical scope cannot change','operation proof invalid','operation proof required','canonical posting incomplete','revision below effective consumption','canonical source or conversion invalid','canonical definition stale','canonical allowance or approval stale','frozen revision source required'];
const sourcePinGuards=new Set(["MATERIAL_UOM_PLAN_ALLOCATION_PIN_REQUIRED","MATERIAL_UOM_PLAN_ALLOCATION_SOURCE_MISMATCH","MATERIAL_UOM_PLAN_ALLOCATION_CONVERSION_INVALID","MATERIAL_UOM_PLAN_ALLOCATION_DEFINITION_STALE","MATERIAL_UOM_PLAN_ALLOCATION_IDENTITY_REQUIRED","MATERIAL_UOM_PLAN_ALLOCATION_IMMUTABLE","MATERIAL_UOM_ISSUE_SOURCE_MISMATCH","MATERIAL_UOM_PLAN_PIN_REQUIRED","MATERIAL_UOM_PLAN_DEFINITION_CHANGED"]);
export function mpiIntegrity(error:unknown){
 const raw=error instanceof Prisma.PrismaClientKnownRequestError
   && ['P2010','P2004'].includes(error.code)
    ? String(error.meta?.message??error.meta?.database_error??'')
    : error instanceof Prisma.PrismaClientUnknownRequestError ? error.message : '';
 const found=raw.match(/\bMATERIAL_UOM_[A-Z_]+\b/)?.[0];
 if(found && sourcePinGuards.has(found))
   return new ConflictException({code:'MATERIAL_PLAN_ISSUE_INTEGRITY_CONFLICT'});
 if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2010'&&error.meta?.code==='P0001'&&messages.some(m=>['Material plan issue '+m,'ERROR: Material plan issue '+m].includes(String(error.meta?.message))))return new ConflictException({code:'MATERIAL_PLAN_ISSUE_INTEGRITY_CONFLICT'});
 if(error instanceof Prisma.PrismaClientUnknownRequestError&&messages.some(m=>(error.message.includes('PostgresError { code: "P0001", message: "Material plan issue '+m+'"')||error.message==='Error in connector: Error querying the database: ERROR: Material plan issue '+m)))return new ConflictException({code:'MATERIAL_PLAN_ISSUE_INTEGRITY_CONFLICT'});
}
