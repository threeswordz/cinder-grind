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
import { InventoryQuantityService } from './inventory-quantity.service';
import { InventoryReportController } from './inventory-report.controller';
import { InventoryReportService } from './inventory-report.service';
import { MaterialIssueService } from './material-issue.service';
import { MaterialMovementController } from './material-movement.controller';
import { MaterialReservationService } from './material-reservation.service';
import { MaterialReturnService } from './material-return.service';
import { StockBalanceController } from './stock-balance.controller';
import { StockBalanceService } from './stock-balance.service';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferService } from './stock-transfer.service';

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
    InventoryReportController,
    GoodsReceiptController,
    StockBalanceController,
    MaterialMovementController,
    StockTransferController,
  ],
  providers: [
    InventoryService,
    InventoryReportService,
    GoodsReceiptService,
    StockBalanceService,
    InventoryQuantityService,
    MaterialReservationService,
    MaterialIssueService,
    MaterialReturnService,
    StockTransferService,
  ],
  exports: [
    InventoryService,
    InventoryReportService,
    GoodsReceiptService,
    StockBalanceService,
    InventoryQuantityService,
    MaterialReservationService,
    MaterialIssueService,
    MaterialReturnService,
    StockTransferService,
  ],
})
export class InventoryModule {}
