import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { IdentityAdminController } from './identity-admin.controller';
import { IdentityAdminService } from './identity-admin.service';
import { NumberSequenceService } from './number-sequence.service';

@Module({
  imports: [PrismaModule, AuthModule, AuthorizationModule, AuditModule],
  controllers: [AdministrationController, IdentityAdminController],
  providers: [
    AdministrationService,
    IdentityAdminService,
    NumberSequenceService,
  ],
  exports: [NumberSequenceService],
})
export class AdministrationModule {}
