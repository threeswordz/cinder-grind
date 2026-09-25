import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AuthenticatedRequest } from './auth.types';
import { safeHashEquals } from './crypto.util';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.auth;
    const supplied = request.headers['x-csrf-token'];
    const token = Array.isArray(supplied) ? supplied[0] : supplied;

    if (!auth || !token || !safeHashEquals(auth.csrfTokenHash, token)) {
      throw new ForbiddenException({
        code: 'CSRF_TOKEN_INVALID',
        detail: 'A valid CSRF token is required.',
      });
    }

    return true;
  }
}
