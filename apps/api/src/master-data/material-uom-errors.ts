import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const codes = new Set(['MATERIAL_UOM_AUTHORITY_DENIED', 'MATERIAL_UOM_REFERENCE_INVALID', 'MATERIAL_UOM_HISTORY_IMMUTABLE', 'MATERIAL_UOM_PRECISION_PINNED', 'MATERIAL_UOM_REVISION_CONFLICT', 'MATERIAL_UOM_RECEIPT_REQUIRED']);
export function materialUomException(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003' && ['material_uom_basis_material_scope_fk', 'material_uom_basis_precision_fk', 'material_uom_revision_precision_fk'].some(name => String(error.meta?.field_name).includes(name) || error.message.includes('`' + name + '`'))) return new ConflictException({ code: 'MATERIAL_UOM_PRECISION_PINNED', detail: 'The Company and unit precision are pinned by immutable material definitions.' });
  let message: string;
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2004', 'P2010'].includes(error.code)) message = String(error.meta?.database_error ?? error.meta?.message ?? '');
  else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const match = error.message.match(/PostgresError \{ code: "(?:P0001|P1201)", message: "(MATERIAL_UOM_[A-Z_]+)"/);
    if (!match) return;
    message = match[1]!;
  } else return;
  const code = message.match(/\bMATERIAL_UOM_[A-Z_]+\b/)?.[0];
  if (!code || !codes.has(code)) return;
  const body = { code, detail: 'Refresh the material definition and check current authority, active units and pinned precision.' };
  return code === 'MATERIAL_UOM_AUTHORITY_DENIED' ? new ForbiddenException(body) : new ConflictException(body);
}
