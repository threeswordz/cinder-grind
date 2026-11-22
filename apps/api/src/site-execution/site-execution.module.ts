import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SiteExecutionController } from './site-execution.controller';
import { SiteExecutionService } from './site-execution.service';
import { SiteWeeklyEventsService } from './site-weekly-events.service';
import { SiteIssueController } from './site-issue.controller';
import { SiteIssueService } from './site-issue.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
    DocumentsModule,
  ],
  controllers: [SiteExecutionController, SiteIssueController],
  providers: [SiteExecutionService, SiteWeeklyEventsService, SiteIssueService],
})
export class SiteExecutionModule {}
