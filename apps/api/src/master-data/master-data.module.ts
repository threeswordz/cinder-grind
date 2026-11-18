import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { MaterialUomController } from './material-uom.controller';
import { MaterialUomService } from './material-uom.service';

@Module({
  imports: [PrismaModule, AuthModule, AuthorizationModule, AuditModule],
  controllers: [MasterDataController, MaterialUomController],
  providers: [MasterDataService, MaterialUomService],
  exports: [MasterDataService, MaterialUomService],
})
export class MasterDataModule {}
