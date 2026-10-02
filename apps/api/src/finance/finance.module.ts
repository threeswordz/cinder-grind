import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { ClientInvoiceController } from './client-invoice.controller';
import { ClientInvoiceService } from './client-invoice.service';
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
  controllers: [FinanceController, ClientInvoiceController],
  providers: [FinanceService, ClientInvoiceService],
  exports: [FinanceService],
})
export class FinanceModule {}
