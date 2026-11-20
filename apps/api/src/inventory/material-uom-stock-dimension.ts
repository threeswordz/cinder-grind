import {lockStockWarehouses} from './material-uom-active-source';
import {Prisma} from '@prisma/client';
import {UnprocessableEntityException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
type Db=Prisma.TransactionClient|PrismaService;
export async function trackedCanonicalBasis(db:Db,companyId:string,materialId:string){
 const rows=await db.$queryRaw<{stockUomId:string;stockPrecision:number}[]>`
 SELECT stock_uom_id AS "stockUomId", stock_precision AS "stockPrecision"
 FROM erp_material_uom_tracked_stock_basis(${companyId}::uuid,${materialId}::uuid)`;
 return rows[0]??null;
}
export async function requireTrackedStockUnit(tx:Db,row:{companyId:string;materialId:string;uomId:string;warehouseId?:string},quantity?:Prisma.Decimal){
 if(row.warehouseId)await lockStockWarehouses(tx,[row.warehouseId]);
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom',row.companyId,row.materialId].join(':')},0))`;
 const basis=await trackedCanonicalBasis(tx,row.companyId,row.materialId);
 if(basis&&(basis.stockUomId!==row.uomId||(quantity!==undefined&&quantity.decimalPlaces()>basis.stockPrecision)))
  throw new UnprocessableEntityException({code:'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'});
 return basis;
}
