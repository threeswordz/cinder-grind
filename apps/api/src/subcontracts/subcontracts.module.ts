import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubcontractsWorkflowController } from './subcontracts-workflow.controller';
import { SubcontractsWorkflowService } from './subcontracts-workflow.service';
import { SubcontractsController } from './subcontracts.controller';
import { SubcontractsService } from './subcontracts.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    AdministrationModule,
    ApprovalModule,
    ProjectsModule,
  ],
  controllers: [SubcontractsController, SubcontractsWorkflowController],
  providers: [SubcontractsService, SubcontractsWorkflowService],
  exports: [SubcontractsService, SubcontractsWorkflowService],
})
export class SubcontractsModule {}
