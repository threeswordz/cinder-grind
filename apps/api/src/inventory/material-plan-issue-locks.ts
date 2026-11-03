import {Prisma} from '@prisma/client';
export async function lockMaterialPlanIssues(tx:Prisma.TransactionClient,issueIds:string[]){
 for(const id of [...new Set(issueIds)].sort())await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'material-plan-issue:'+id},0))`;
}
export async function lockMaterialPlanLineages(tx:Prisma.TransactionClient,issueIds:string[]){
 if(!issueIds.length)return;
 await tx.$executeRaw`SELECT erp_mpi_lock_sources(${issueIds}::uuid[])`;
}
export async function lockMaterialPlanIds(tx:Prisma.TransactionClient,ids:string[]){
 for(const id of [...new Set(ids)].sort())await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'material-plan:'+id},0))`;
}
