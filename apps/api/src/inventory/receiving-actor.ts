import {ForbiddenException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
import {RECEIVING} from './receiving-contract';
export type ReceivingDb=Prisma.TransactionClient|PrismaService;
export async function receivingActor(auth:AuthenticatedUserContext,db:ReceivingDb,extra:string[]=[]){
 const session=await db.userSession.findFirst({where:{id:auth.sessionId,userId:auth.userId,revokedAt:null,expiresAt:{gt:new Date()},user:{companyId:auth.companyId,isActive:true,company:{isActive:true}}},select:{user:{select:{employee:{select:{isActive:true}},userRoles:{select:{role:{select:{companyId:true,roleCode:true,isActive:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}}}}}}}});
 const roles=session?.user.userRoles.filter(r=>r.role.isActive&&r.role.companyId===auth.companyId).map(r=>r.role)??[];
 const permissions=[...new Set(roles.flatMap(r=>r.rolePermissions.map(p=>p.permission.permissionCode)))];
 if(!session||![RECEIVING+'view',...extra].every(p=>auth.permissions.includes(p)&&permissions.includes(p))||extra.some(p=>p!==RECEIVING+'configure')&&!session.user.employee?.isActive)throw new ForbiddenException({code:'RECEIVING_PERMISSION_DENIED'});
 return {...auth,permissions,roleCodes:roles.map(r=>r.roleCode)};
}
