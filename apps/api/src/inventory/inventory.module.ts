import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { GoodsReceiptController } from './goods-receipt.controller';
import { GoodsReceiptService } from './goods-receipt.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockBalanceController } from './stock-balance.controller';
import { StockBalanceService } from './stock-balance.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    AuditModule,
    ProjectsModule,
    ApprovalModule,
    AdministrationModule,
  ],
  controllers: [
    InventoryController,
    GoodsReceiptController,
    StockBalanceController,
  ],
  providers: [InventoryService, GoodsReceiptService, StockBalanceService],
  exports: [InventoryService, GoodsReceiptService, StockBalanceService],
})
export class InventoryModule {}
