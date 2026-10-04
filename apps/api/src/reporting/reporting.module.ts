import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
    SchedulingModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
