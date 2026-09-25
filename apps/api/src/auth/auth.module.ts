import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CsrfGuard } from './csrf.guard';
import { LoginRateLimitService } from './login-rate-limit.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimitService,
    PasswordService,
    SessionService,
    AuthGuard,
    CsrfGuard,
  ],
  exports: [PasswordService, SessionService, AuthGuard, CsrfGuard],
})
export class AuthModule {}
