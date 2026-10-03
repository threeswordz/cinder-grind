import { Module } from '@nestjs/common';

import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { CostControlController } from './cost-control.controller';
import { CostControlService } from './cost-control.service';
import { DirectCostController } from './direct-cost.controller';
import { DirectCostService } from './direct-cost.service';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';

@Module({
  imports: [
    PrismaModule,
    ApprovalModule,
    AuditModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
  ],
  controllers: [CostControlController, DirectCostController, ForecastController],
  providers: [CostControlService, DirectCostService, ForecastService],
  exports: [CostControlService, DirectCostService, ForecastService],
})
export class CostControlModule {}
