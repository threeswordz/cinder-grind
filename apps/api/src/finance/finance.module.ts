import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { CashFlowController } from './cash-flow.controller';
import { CashFlowService } from './cash-flow.service';
import { ClientInvoiceController } from './client-invoice.controller';
import { ClientInvoiceService } from './client-invoice.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

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
  controllers: [
    FinanceController,
    CashFlowController,
    ClientInvoiceController,
    PaymentController,
    RetentionController,
  ],
  providers: [
    FinanceService,
    CashFlowService,
    ClientInvoiceService,
    PaymentService,
    RetentionService,
  ],
  exports: [FinanceService, CashFlowService, RetentionService],
})
export class FinanceModule {}
