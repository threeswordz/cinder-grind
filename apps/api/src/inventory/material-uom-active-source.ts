import {Prisma} from '@prisma/client';
import {UnprocessableEntityException} from '@nestjs/common';
import {uomDate} from '../master-data/material-uom-contract';

// Existing warehouse archival/posting mutex precedes material and stock locks.
export async function lockStockWarehouses(tx:Pick<Prisma.TransactionClient,'$executeRaw'>,warehouseIds:string[]){
 for(const id of [...new Set(warehouseIds)].sort())await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'inventory-warehouse:'+id}))`;
}

// Source selection and activation share a deterministic material-lock order.
// An activation racing a legacy submission cannot silently change its basis.
export async function activatedStockMaterials(tx:Prisma.TransactionClient,companyId:string,materialIds:string[]){
 const ids=[...new Set(materialIds)].sort();
 for(const id of ids)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom',companyId,id].join(':')},0))`;
 const rows=await tx.materialUomActivation.findMany({where:{companyId,materialId:{in:ids}},select:{materialId:true}});
 return new Set(rows.map(row=>row.materialId));
}
export function explicitStockBusinessDate(value:string|undefined,active:boolean){
 if(active&&value===undefined)throw new UnprocessableEntityException({code:'MATERIAL_UOM_BUSINESS_DATE_REQUIRED',detail:'Provide the explicit conversion business date.'});
 if(!active&&value!==undefined)throw new UnprocessableEntityException({code:'MATERIAL_UOM_NOT_ACTIVATED',detail:'Prepared definitions do not activate inventory conversion.'});
 return value===undefined?undefined:uomDate(value,'conversionBusinessDate');
}
