import { Module } from '@nestjs/common';

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
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [
    PrismaModule,
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
  ],
  providers: [SchedulingService],
})
export class SchedulingModule {}
