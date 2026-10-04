import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CostControlModule } from '../cost-control/cost-control.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { ReportingModule } from '../reporting/reporting.module';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
    ReportingModule,
    CostControlModule,
    FinanceModule,
    InventoryModule,
  ],
  controllers: [ManagementController],
  providers: [ManagementService],
  exports: [ManagementService],
})
export class ManagementModule {}
