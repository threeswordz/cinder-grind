import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedRequest } from '../auth/auth.types';
import { AuthorizationService } from './authorization.service';
import {
  REQUIRED_PERMISSIONS_KEY,
} from './permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        detail: 'Authentication is required.',
      });
    }

    if (!this.authorization.hasEveryPermission(request.auth, required)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        detail: 'You do not have permission to perform this action.',
      });
    }

    return true;
  }
}
