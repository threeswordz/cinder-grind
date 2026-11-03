import {ConflictException} from '@nestjs/common';
import {Prisma} from '@prisma/client';

// PostgreSQL RAISE EXCEPTION is reported as an unknown request by Prisma's
// connector. Translate only this module's exact guard messages and SQLSTATE;
// unrelated database/programming failures must still surface as server errors.
const guardMessages=[
 'Material plan issue revision below effective consumption',
 'Material plan source or material scope invalid',
 'Material plan approved mapping is immutable',
 'Material plan approved source mapping or basis conflicts',
 'Material plan cumulative source allocation exceeded',
] as const;
export function materialPlanIntegrityException(error:unknown):ConflictException|undefined{
 if(error instanceof Prisma.PrismaClientKnownRequestError && ['P2003','P2004'].includes(error.code))
  return new ConflictException({code:'MATERIAL_PLAN_INTEGRITY_CONFLICT'});
 if(error instanceof Prisma.PrismaClientUnknownRequestError && guardMessages.some(message=>
  error.message.includes('PostgresError { code: "P0001", message: "'+message+'"')))
  return new ConflictException({code:'MATERIAL_PLAN_INTEGRITY_CONFLICT'});
}

// Native Prisma may identify a SQL-only composite FK in its exact constraint
// message rather than meta.field_name. Never classify another FK/server error.
export function isMaterialPlanWarehouseScopeConflict(error:unknown):boolean{
 const name='material_usage_plans_warehouse_scope_fkey';
 return error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2003'&&
  ([name,name+' (index)'].includes(String(error.meta?.field_name))||
   error.message.includes('Foreign key constraint violated on the constraint: `'+name+'`'));
}
