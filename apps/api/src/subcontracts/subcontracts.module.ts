import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { SubcontractsController } from './subcontracts.controller';
import { SubcontractsService } from './subcontracts.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    AdministrationModule,
    ProjectsModule,
  ],
  controllers: [SubcontractsController],
  providers: [SubcontractsService],
  exports: [SubcontractsService],
})
export class SubcontractsModule {}
