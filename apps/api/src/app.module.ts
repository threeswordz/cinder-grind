import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AdministrationModule } from './administration/administration.module';
import { ApprovalModule } from './approval/approval.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { HealthModule } from './health/health.module';
import { DocumentsModule } from './documents/documents.module';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { WbsModule } from './wbs/wbs.module';

@Module({
  imports: [
    PrismaModule,
    ProjectsModule,
    WbsModule,
    DocumentsModule,
    AdministrationModule,
    AuthModule,
    AuthorizationModule,
    ApprovalModule,
    AuditModule,
    HealthModule,
    MasterDataModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
