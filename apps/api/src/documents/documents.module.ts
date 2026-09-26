import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { DocumentPolicyService } from './document-policy.service';
import { DocumentTargetsController } from './document-targets.controller';
import { DocumentTargetsService } from './document-targets.service';
import { DocumentStorage } from './document-storage';
import {
  DocumentsController,
  DocumentTypesController,
} from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorage } from './local-document-storage.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
  ],
  controllers: [DocumentsController, DocumentTypesController, DocumentTargetsController],
  providers: [
    DocumentsService,
    DocumentTargetsService,
    DocumentPolicyService,
    { provide: DocumentStorage, useClass: LocalDocumentStorage },
  ],
  exports: [DocumentsService, DocumentStorage],
})
export class DocumentsModule {}
