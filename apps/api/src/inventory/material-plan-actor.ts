import {ForbiddenException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
export type MaterialPlanDb=Prisma.TransactionClient|PrismaService;
export async function materialPlanActor(auth:AuthenticatedUserContext,db:MaterialPlanDb,extra:string[]=[]){
 const session=await db.userSession.findFirst({where:{id:auth.sessionId,userId:auth.userId,revokedAt:null,expiresAt:{gt:new Date()},user:{companyId:auth.companyId,isActive:true,company:{isActive:true}}},
  select:{user:{select:{userRoles:{select:{role:{select:{roleCode:true,companyId:true,isActive:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}}}}}}}});
 const roles=session?.user.userRoles.filter(x=>x.role.isActive&&x.role.companyId===auth.companyId).map(x=>x.role)??[];
 const permissions=[...new Set(roles.flatMap(r=>r.rolePermissions.map(p=>p.permission.permissionCode)))];
 if(!session||!['inventory.material_plan.view',...extra].every(p=>auth.permissions.includes(p)&&permissions.includes(p)))throw new ForbiddenException({code:'MATERIAL_PLAN_PERMISSION_DENIED'});
 return {...auth,permissions,roleCodes:roles.map(r=>r.roleCode)};
}
export function materialPlanSourceRight(auth:AuthenticatedUserContext){
 if(!['budget.quantity.view','budget.revision.view'].some(p=>auth.permissions.includes(p)))throw new ForbiddenException({code:'MATERIAL_PLAN_SOURCE_PERMISSION_DENIED'});
}
