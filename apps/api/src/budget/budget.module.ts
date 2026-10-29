import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { CustomerBoqService } from './customer-boq.service';
import { CustomerBoqController } from './customer-boq.controller';
import { QuantityBoqController } from './quantity-boq.controller';
import { BudgetDisclosureInterceptor } from './budget-disclosure.interceptor';
import { ProjectSummaryController } from './project-summary.controller';
import { ProjectSummaryService } from './project-summary.service';

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
  controllers: [BudgetController, CustomerBoqController, QuantityBoqController, ProjectSummaryController],
  providers: [BudgetService, CustomerBoqService, BudgetDisclosureInterceptor, ProjectSummaryService],
  exports: [BudgetService],
})
export class BudgetModule {}
