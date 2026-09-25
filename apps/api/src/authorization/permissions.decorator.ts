import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'construction_erp_required_permissions';

export function RequirePermissions(...permissions: string[]) {
  return SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
}
