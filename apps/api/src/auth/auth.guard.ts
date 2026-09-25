import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthenticatedRequest } from './auth.types';
import { readSessionCookie } from './cookie.util';
import { SessionService } from './session.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawCookie = request.headers.cookie;
    const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
    const sessionToken = readSessionCookie(cookieHeader);

    if (!sessionToken) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        detail: 'Authentication is required.',
      });
    }

    const auth = await this.sessions.resolve(sessionToken);
    if (!auth) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        detail: 'The session is invalid or has expired.',
      });
    }

    request.auth = auth;
    return true;
  }
}
