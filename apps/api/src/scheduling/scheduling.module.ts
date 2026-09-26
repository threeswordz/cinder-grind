import { Module } from '@nestjs/common';

import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import {
  ActivitiesController,
  ActivityDependenciesController,
  ActivityTypesController,
  ScheduleController,
  WorkingCalendarsController,
} from './scheduling.controller';
import {
  ActivityProgressController,
  ScheduleBaselinesController,
  ScheduleComparisonController,
} from './scheduling-progress.controller';
import { SchedulingProgressService } from './scheduling-progress.service';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [
    PrismaModule,
    ApprovalModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
  ],
  controllers: [
    ScheduleController,
    WorkingCalendarsController,
    ActivityTypesController,
    ActivitiesController,
    ActivityDependenciesController,
    ScheduleBaselinesController,
    ActivityProgressController,
    ScheduleComparisonController,
  ],
  providers: [SchedulingService, SchedulingProgressService],
  exports: [SchedulingService, SchedulingProgressService],
})
export class SchedulingModule {}
