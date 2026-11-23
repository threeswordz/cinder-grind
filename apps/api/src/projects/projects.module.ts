import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectAccessService } from './project-access.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectCloseoutService } from './project-closeout.service';

@Module({
  imports: [PrismaModule, AuthModule, AuthorizationModule, AuditModule],
  controllers: [ProjectsController],
  providers: [ProjectAccessService, ProjectsService, ProjectCloseoutService],
  exports: [ProjectAccessService, ProjectsService],
})
export class ProjectsModule {}
