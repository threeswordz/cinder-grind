import { Module } from '@nestjs/common';

import { AdministrationModule } from '../administration/administration.module';
import { ApprovalModule } from '../approval/approval.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProcurementController } from './procurement.controller';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderCancellationCaseController } from './purchase-order-cancellation-case.controller';
import { PurchaseOrderCancellationCaseService } from './purchase-order-cancellation-case.service';
import { ProcurementService } from './procurement.service';
import { PurchaseOrderService } from './purchase-order.service';
import { SupplierDeliveryCaseController } from './supplier-delivery-case.controller';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';
import { PurchaseOrderPur07Service } from './purchase-order-pur07.service';
import { SourcingController } from './sourcing.controller';
import { SourcingService } from './sourcing.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    ProjectsModule,
    AuditModule,
    ApprovalModule,
    AdministrationModule,
    DocumentsModule,
  ],
  controllers: [ProcurementController, SourcingController, PurchaseOrderController, PurchaseOrderCancellationCaseController, SupplierDeliveryCaseController],
  providers: [ProcurementService, SourcingService, PurchaseOrderService, PurchaseOrderPur07Service, PurchaseOrderCancellationCaseService, SupplierDeliveryCaseService],
  exports: [ProcurementService, SourcingService, PurchaseOrderService],
})
export class ProcurementModule {}
