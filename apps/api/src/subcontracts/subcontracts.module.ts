import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubcontractsCertificationController } from './subcontracts-certification.controller';
import { SubcontractsCertificationService } from './subcontracts-certification.service';
import { SubcontractsClaimsController } from './subcontracts-claims.controller';
import { SubcontractsClaimsService } from './subcontracts-claims.service';
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
  controllers: [
    SubcontractsController,
    SubcontractsWorkflowController,
    SubcontractsClaimsController,
    SubcontractsCertificationController,
  ],
  providers: [
    SubcontractsService,
    SubcontractsWorkflowService,
    SubcontractsClaimsService,
    SubcontractsCertificationService,
  ],
  exports: [
    SubcontractsService,
    SubcontractsWorkflowService,
    SubcontractsClaimsService,
    SubcontractsCertificationService,
  ],
})
export class SubcontractsModule {}
