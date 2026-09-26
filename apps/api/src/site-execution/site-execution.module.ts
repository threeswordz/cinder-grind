import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DocumentsModule } from '../documents/documents.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SiteExecutionController } from './site-execution.controller';
import { SiteExecutionService } from './site-execution.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
    DocumentsModule,
  ],
  controllers: [SiteExecutionController],
  providers: [SiteExecutionService],
})
export class SiteExecutionModule {}
