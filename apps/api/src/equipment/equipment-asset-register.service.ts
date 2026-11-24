import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type Tx=Prisma.TransactionClient;
type Context={auth:AuthenticatedUserContext;correlationId?:string};
type Version={id:string;version:number;previousVersionId:string|null;purchaseDate:Date|null;
 acquisitionValueTHB:string|null;evidenceReference:string;recordedBaseLocation:string|null;
 reason:string;recordedByUserId:string;createdAt:Date};
type Input={expectedVersionId:string|null;purchaseDate:string|null;acquisitionValueTHB:string|null;
 evidenceReference:string;recordedBaseLocation:string|null;reason:string};
const denied=():never=>{throw new ForbiddenException({code:'ASSET_REGISTER_DENIED'});};
const invalid=():never=>{throw new UnprocessableEntityException({code:'ASSET_REGISTER_INPUT_INVALID'});};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const date=(s:string)=>new Date(s+'T00:00:00.000Z');
function parse(body:unknown):Input{
 if(!body||typeof body!=='object'||Array.isArray(body))return invalid();
 const b=body as Record<string,unknown>;
 const keys=['expectedVersionId','purchaseDate','acquisitionValueTHB','evidenceReference','recordedBaseLocation','reason'];
 if(Object.keys(b).length!==keys.length||Object.keys(b).some(k=>!keys.includes(k)))return invalid();
 if(b.expectedVersionId!==null&&!uuid(b.expectedVersionId))return invalid();
 if(b.purchaseDate!==null&&(typeof b.purchaseDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.purchaseDate)||
   !Number.isFinite(date(b.purchaseDate).getTime())||date(b.purchaseDate).toISOString().slice(0,10)!==b.purchaseDate||
   b.purchaseDate<'1900-01-01'||b.purchaseDate>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))return invalid();
 if(b.acquisitionValueTHB!==null&&(typeof b.acquisitionValueTHB!=='string'||
   !/^(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?$/.test(b.acquisitionValueTHB)))return invalid();
 const nonempty=(x:unknown,max:number):x is string=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x;
 if(!nonempty(b.evidenceReference,500)||!nonempty(b.reason,1000)||
   (b.recordedBaseLocation!==null&&!nonempty(b.recordedBaseLocation,300)))return invalid();
 return b as Input;
}
@Injectable()
export class EquipmentAssetRegisterService{
 constructor(private readonly prisma:PrismaService,private readonly access:ProjectAccessService,private readonly audit:AuditService){}
 private async actor(supplied:AuthenticatedUserContext,tx:Tx,write:boolean){
  const session=await tx.userSession.findFirst({where:{id:supplied.sessionId,userId:supplied.userId,
   revokedAt:null,expiresAt:{gt:new Date()},user:{companyId:supplied.companyId,isActive:true,company:{isActive:true}}},
   select:{user:{select:{employee:{select:{companyId:true,isActive:true}},
    userRoles:{select:{role:{select:{companyId:true,isActive:true,roleCode:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}}}}}}});
  const roles=session?.user.userRoles.map(x=>x.role).filter(r=>r.isActive&&r.companyId===supplied.companyId&&supplied.roleCodes.includes(r.roleCode))??[];
  const codes=roles.map(r=>r.roleCode);
  const permissions=[...new Set(roles.flatMap(r=>r.rolePermissions.map(p=>p.permission.permissionCode)))].filter(p=>supplied.permissions.includes(p));
  if(!session?.user.employee?.isActive||session.user.employee.companyId!==supplied.companyId||
   !permissions.includes('equipment.equipment.view')||
   !(write?codes.includes('PROCUREMENT_OFFICER')&&permissions.includes('equipment.equipment.manage'):
    codes.some(c=>['PROCUREMENT_OFFICER','FINANCE_MANAGER'].includes(c))))return denied();
  return {...supplied,roleCodes:codes,permissions};
 }
 private async scoped(auth:AuthenticatedUserContext,id:string,tx:Tx,lock:boolean){
  if(lock)await tx.$queryRaw(Prisma.sql`SELECT id FROM equipment WHERE id=${id}::uuid AND company_id=${auth.companyId}::uuid FOR UPDATE`);
  const equipment=await tx.equipment.findFirst({where:{id,companyId:auth.companyId},select:{id:true,equipmentCode:true,equipmentName:true,isActive:true}});
  if(!equipment||!/^CG[0-9]{5}$/.test(equipment.equipmentCode))throw new NotFoundException({code:'CG_ASSET_NOT_FOUND'});
  const today=date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  // Scope both the effective assignment and any future open assignment.
  const assignments=await tx.equipmentAssignment.findMany({where:{companyId:auth.companyId,equipmentId:id,
   OR:[{assignedTo:null},{assignedFrom:{lte:today},assignedTo:{gte:today}}]},
   select:{projectId:true,assignedFrom:true,assignedTo:true,project:{select:{id:true,projectCode:true,projectName:true}}},take:3});
  if(assignments.length>2)throw new ConflictException({code:'ASSET_ASSIGNMENT_SOURCE_INVALID'});
  if(!assignments.length&&!this.access.canAccessAll(auth))return denied();
  for(const a of assignments)await this.access.assertAccess(auth,a.projectId,tx);
  const effective=assignments.find(a=>a.assignedFrom<=today&&(!a.assignedTo||a.assignedTo>=today));
  return {equipment,currentProject:effective?.project??null};
 }
 private async versions(auth:AuthenticatedUserContext,id:string,tx:Tx){
  const rows=await tx.$queryRaw<Version[]>(Prisma.sql`
   SELECT id,version,previous_version_id AS "previousVersionId",purchase_date AS "purchaseDate",
    acquisition_value_thb::text AS "acquisitionValueTHB",evidence_reference AS "evidenceReference",
    recorded_base_location AS "recordedBaseLocation",reason,recorded_by_user_id AS "recordedByUserId",created_at AS "createdAt"
   FROM equipment_asset_register_versions WHERE company_id=${auth.companyId}::uuid AND equipment_id=${id}::uuid
   ORDER BY version DESC LIMIT 101`);
  if(rows.length>100)throw new ConflictException({code:'ASSET_REGISTER_HISTORY_LIMIT'});
  return rows;
 }
 async read(supplied:AuthenticatedUserContext,id:string){
  return this.prisma.$transaction(async tx=>{
   const auth=await this.actor(supplied,tx,false);
   const scope=await this.scoped(auth,id,tx,false);
   const history=await this.versions(auth,id,tx);
   const canCustody=auth.permissions.includes('equipment.custody.view');
   const loans=canCustody&&scope.currentProject?await tx.$queryRaw<{id:string;borrowerName:string;siteLabel:string;dueOn:Date}[]>(Prisma.sql`
    SELECT l.id,e.employee_name AS "borrowerName",l.site_label AS "siteLabel",l.due_on AS "dueOn"
    FROM equipment_custody_loans l JOIN employees e ON e.id=l.borrower_employee_id AND e.company_id=l.company_id
    WHERE l.company_id=${auth.companyId}::uuid AND l.equipment_id=${id}::uuid AND l.project_id=${scope.currentProject.id}::uuid AND l.returned_on IS NULL`):[];
   return {...scope,current:history[0]??null,history,
    custodyVisible:canCustody,currentCustody:loans[0]??null,
    canEdit:auth.roleCodes.includes('PROCUREMENT_OFFICER')&&auth.permissions.includes('equipment.equipment.manage'),
    acquisitionBasis:'OPERATOR_RECORDED_NOT_INVOICE_VERIFIED',financeEffect:false,depreciationEffect:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
 async set(context:Context,id:string,body:unknown){
  const input=parse(body);
  return this.prisma.$transaction(async tx=>{
   const auth=await this.actor(context.auth,tx,true);
   const scope=await this.scoped(auth,id,tx,true);
   const history=await this.versions(auth,id,tx);
   const prior=history[0]??null;
   if(input.expectedVersionId!==(prior?.id??null))throw new ConflictException({code:'ASSET_REGISTER_STALE_VERSION'});
   if(history.length>=100)throw new ConflictException({code:'ASSET_REGISTER_HISTORY_LIMIT'});
   const rows=await tx.$queryRaw<{id:string;version:number}[]>(Prisma.sql`
    INSERT INTO equipment_asset_register_versions(company_id,equipment_id,equipment_code_snapshot,version,previous_version_id,
     purchase_date,acquisition_value_thb,evidence_reference,recorded_base_location,reason,recorded_by_user_id)
    VALUES(${auth.companyId}::uuid,${id}::uuid,${scope.equipment.equipmentCode},${(prior?.version??0)+1},${input.expectedVersionId}::uuid,
     ${input.purchaseDate}::date,${input.acquisitionValueTHB}::decimal,${input.evidenceReference},${input.recordedBaseLocation},${input.reason},${auth.userId}::uuid)
    RETURNING id,version`);
   const created=rows[0]!;
   // Acquisition amounts stay in the dedicated restricted source, not generic audit payloads.
   await this.audit.record({...context,auth,entityType:'EQUIPMENT_ASSET_REGISTER',entityId:id,action:'RECORD_VERSION',
    newValues:{versionId:created.id,version:created.version,previousVersionId:input.expectedVersionId,financeEffect:false}},tx);
   return {...created,financeEffect:false,depreciationEffect:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 }
}
