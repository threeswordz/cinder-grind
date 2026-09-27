import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { SourcingController } from './sourcing.controller';
import { SourcingService } from './sourcing.service';

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
  controllers: [ProcurementController, SourcingController],
  providers: [ProcurementService, SourcingService],
  exports: [ProcurementService, SourcingService],
})
export class ProcurementModule {}
