import {activatedStockMaterials,lockStockWarehouses} from './material-uom-active-source';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { uomDate } from '../master-data/material-uom-contract';
import { resolveStockEffectPin } from '../master-data/material-uom-effect-pin';

type ReceiptSource = {
  id: string; companyId: string; projectId: string; warehouseId: string;
  items: { id: string; materialId: string; uomId: string; quantity: Prisma.Decimal }[];
};

// Called only for explicitly activated items in the canonical submission
// transaction, after its approval instance exists. Commercial fields stay unchanged.
export async function freezeSubmittedReceiptSources(
  tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, receipt: ReceiptSource, businessDate: string,
) {
  const date = uomDate(businessDate);
  const session = await tx.userSession.findFirst({
    where: { id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
      user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } },
    select: { user: { select: { employee: { select: { companyId: true, isActive: true } },
      userRoles: { select: { companyId: true, role: { select: { companyId: true, roleCode: true, isActive: true,
        rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } } } } },
  });
  const permissions = session?.user.userRoles.filter(r => r.companyId === auth.companyId && r.role.companyId === auth.companyId && r.role.isActive && r.role.roleCode !== 'SYS_ADMIN')
    .flatMap(r => r.role.rolePermissions.map(p => p.permission.permissionCode)) ?? [];
  if (receipt.companyId !== auth.companyId || !session?.user.employee?.isActive ||
      session.user.employee.companyId !== auth.companyId || !permissions.includes('inventory.receipt.submit') ||
      !auth.permissions.includes('inventory.receipt.submit')) throw new ForbiddenException({code:'MATERIAL_UOM_RECEIPT_AUTHORITY_DENIED'});
  // Deterministic material ordering matches definition locking and prevents
  // multi-material receipts taking incompatible lock orders.
  for (const item of [...receipt.items].sort((a,b)=>a.materialId.localeCompare(b.materialId)||a.id.localeCompare(b.id))) {
    const { effectSign: _effectSign, ...pin } = await resolveStockEffectPin(tx, {
      companyId: receipt.companyId, materialId: item.materialId, sourceUomId: item.uomId,
      quantity: item.quantity, businessDate: date, effectSign: 1,
    });
    await tx.materialUomReceiptSourcePin.create({data:{receiptId:receipt.id,receiptItemId:item.id,projectId:receipt.projectId,...pin}});
  }
}

// Reconcile the activated subset; legacy items in a mixed receipt retain
// their own commercial stock source and must not acquire invented pins.
export async function loadReceiptPostingPins(tx: Prisma.TransactionClient, receipt: ReceiptSource) {
  await lockStockWarehouses(tx,[receipt.warehouseId]);
  const pins=await tx.materialUomReceiptSourcePin.findMany({where:{companyId:receipt.companyId,receiptId:receipt.id}});
  const result=new Map(pins.map(pin=>[pin.receiptItemId,pin]));
  const activated=await activatedStockMaterials(tx,receipt.companyId,receipt.items.map(i=>i.materialId));
  const controlled=receipt.items.filter(i=>activated.has(i.materialId));
  if (pins.length!==controlled.length||pins.some(p=>!activated.has(p.materialId))) throw new ConflictException({code:'MATERIAL_UOM_RECEIPT_SOURCE_INCOMPLETE'});
  for (const item of [...controlled].sort((a,b)=>a.materialId.localeCompare(b.materialId)||a.id.localeCompare(b.id))) {
    const pin=result.get(item.id);
    if (!pin || pin.projectId!==receipt.projectId || pin.materialId!==item.materialId ||
        pin.sourceUomId!==item.uomId || !pin.sourceQuantity.eq(item.quantity))
      throw new ConflictException({code:'MATERIAL_UOM_RECEIPT_SOURCE_MISMATCH'});
    const current=await resolveStockEffectPin(tx,{companyId:receipt.companyId,materialId:item.materialId,
      sourceUomId:item.uomId,quantity:item.quantity,businessDate:pin.businessDate.toISOString().slice(0,10),effectSign:1});
    if (current.revisionId!==pin.revisionId || current.stockUomId!==pin.stockUomId ||
        !current.stockQuantity.eq(pin.stockQuantity) || current.numerator!==pin.numerator || current.denominator!==pin.denominator)
      throw new ConflictException({code:'MATERIAL_UOM_RECEIPT_DEFINITION_CHANGED'});
  }
  return result;
}
