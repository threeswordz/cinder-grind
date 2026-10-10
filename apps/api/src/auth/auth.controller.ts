import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { loginRateLimitKey } from './client-identity';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
} from './cookie.util';
import { CsrfGuard } from './csrf.guard';
import { parseLoginInput } from './login-input';
import { LoginRateLimitService } from './login-rate-limit.service';
import { SessionService } from './session.service';

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

function requireAuth(request: AuthenticatedRequest) {
  if (!request.auth) {
    throw new Error('AuthGuard did not attach authentication context.');
  }
  return request.auth;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly loginRateLimit: LoginRateLimitService,
  ) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    const input = parseLoginInput(body);
    const clientKey = loginRateLimitKey(request);
    await this.loginRateLimit.consume(clientKey);

    const result = await this.authService.login(input.email, input.password);
    await this.loginRateLimit.reset(clientKey);
    const maxAgeSeconds = Math.max(
      0,
      Math.floor((result.expiresAt.getTime() - Date.now()) / 1000),
    );

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader(
      'Set-Cookie',
      buildSessionCookie(
        result.sessionToken,
        maxAgeSeconds,
        process.env.NODE_ENV === 'production',
      ),
    );

    return {
      data: {
        user: result.user,
        csrfToken: result.csrfToken,
        expiresAt: result.expiresAt.toISOString(),
      },
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const auth = requireAuth(request);
    return {
      data: {
        id: auth.userId,
        companyId: auth.companyId,
        email: auth.email,
        displayName: auth.displayName,
        roleCodes: auth.roleCodes,
        permissions: auth.permissions,
      },
    };
  }

  @Get('csrf')
  @UseGuards(AuthGuard)
  async csrf(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    const auth = requireAuth(request);
    const csrfToken = await this.sessions.rotateCsrfToken(auth.sessionId);
    return { data: { csrfToken } };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AuthGuard, CsrfGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: HeaderResponse,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    const auth = requireAuth(request);
    await this.sessions.revoke(auth.sessionId);
    response.setHeader(
      'Set-Cookie',
      buildClearedSessionCookie(process.env.NODE_ENV === 'production'),
    );
  }
}
