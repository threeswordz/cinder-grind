import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { CostControlController } from './cost-control.controller';
import { CostControlService } from './cost-control.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
  ],
  controllers: [CostControlController],
  providers: [CostControlService],
  exports: [CostControlService],
})
export class CostControlModule {}
