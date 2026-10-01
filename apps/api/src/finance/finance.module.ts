import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
    AuditModule,
    ApprovalModule,
    AdministrationModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
