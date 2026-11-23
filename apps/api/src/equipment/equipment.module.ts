import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { EquipmentController } from './equipment.controller';
import { EquipmentCustodyController } from './equipment-custody.controller';
import { EquipmentCustodyService } from './equipment-custody.service';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
  ],
  controllers: [EquipmentController, EquipmentCustodyController],
  providers: [EquipmentService, EquipmentCustodyService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
