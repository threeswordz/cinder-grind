import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentsModule } from '../documents/documents.module';
import { HrPrivateCrypto } from './hr-private-crypto';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

@Module({ imports: [PrismaModule, AuditModule, AuthModule, AuthorizationModule, ProjectsModule, DocumentsModule],
  providers: [HrService, { provide: HrPrivateCrypto, useFactory: () => new HrPrivateCrypto() }], controllers: [HrController] })
export class HrModule {}
