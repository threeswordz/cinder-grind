import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { UploadedDocumentFile } from './document-policy.service';
import { DocumentsService } from './documents.service';

export type DocumentTargetType =
  | 'WBS'
  | 'ACTIVITY'
  | 'PURCHASE_REQUEST'
  | 'RFQ'
  | 'SUPPLIER_QUOTATION'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'MATERIAL_RESERVATION'
  | 'MATERIAL_ISSUE'
  | 'MATERIAL_RETURN'
  | 'STOCK_TRANSFER'
  | 'SUPPLIER_INVOICE'
  | 'CLIENT_INVOICE'
  | 'PAYMENT'
  | 'SUBCONTRACT_AGREEMENT'
  | 'SUBCONTRACT_WORK_ORDER'
  | 'SUBCONTRACT_CLAIM'
  | 'SUBCONTRACT_CERTIFICATION'
  | 'SUBCONTRACT_VARIATION';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

@Injectable()
export class DocumentTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const projectScope = await this.access.scopeWhere(auth);
    const accessibleProjects = await this.prisma.project.findMany({
      where: projectScope,
      select: { id: true },
    });
    const accessibleProjectIds = accessibleProjects.map((row) => row.id);
    const can = (permission: string) => auth.permissions.includes(permission);
    const [
      wbs,
      activities,
      purchaseRequests,
      rfqs,
      supplierQuotations,
      purchaseOrders,
      goodsReceipts,
      materialReservations,
      materialIssues,
      materialReturns,
      stockTransfers,
      supplierInvoices,
      clientInvoices,
      payments,
      subcontractAgreements,
      subcontractWorkOrders,
      subcontractClaims,
      subcontractCertifications,
      subcontractVariations,
    ] = await Promise.all([
      this.prisma.wbsElement.findMany({
        where: { projectId, isActive: true },
        select: { id: true, wbsCode: true, wbsName: true, parentId: true },
        orderBy: { wbsCode: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: {
          projectId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: {
          id: true,
          activityCode: true,
          activityName: true,
          wbsId: true,
        },
        orderBy: { activityCode: 'asc' },
      }),
      this.prisma.purchaseRequest.findMany({
        where: { projectId, companyId: auth.companyId },
        select: { id: true, prNumber: true },
        orderBy: { prNumber: 'asc' },
      }),
      this.prisma.rfq.findMany({
        where: { projectId, companyId: auth.companyId },
        select: { id: true, rfqNumber: true },
        orderBy: { rfqNumber: 'asc' },
      }),
      this.prisma.supplierQuotation.findMany({
        where: {
          companyId: auth.companyId,
          rfq: { projectId, companyId: auth.companyId },
        },
        select: {
          id: true,
          supplierReference: true,
          rfq: { select: { rfqNumber: true } },
          supplier: {
            select: { supplierCode: true, supplierName: true },
          },
        },
        orderBy: [{ rfq: { rfqNumber: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.prisma.purchaseOrder.findMany({
        where: { projectId, companyId: auth.companyId },
        select: {
          id: true,
          poNumber: true,
          revisionNo: true,
          supplier: {
            select: { supplierCode: true, supplierName: true },
          },
        },
        orderBy: [{ poNumber: 'asc' }, { revisionNo: 'asc' }],
      }),
      can('inventory.receipt.view')
        ? this.prisma.goodsReceipt.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, receiptNumber: true, postedAt: true },
            orderBy: { receiptNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('inventory.reservation.view')
        ? this.prisma.materialReservation.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, reservationNumber: true, status: true },
            orderBy: { reservationNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('inventory.issue.view')
        ? this.prisma.materialIssue.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, issueNumber: true, postedAt: true },
            orderBy: { issueNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('inventory.return.view')
        ? this.prisma.materialReturn.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, returnNumber: true, postedAt: true },
            orderBy: { returnNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('inventory.transfer.view') && accessibleProjectIds.length
        ? this.prisma.stockTransfer.findMany({
            where: {
              companyId: auth.companyId,
              items: {
                some: {
                  OR: [
                    { sourceProjectId: projectId },
                    { destinationProjectId: projectId },
                  ],
                },
                every: {
                  AND: [
                    { sourceProjectId: { in: accessibleProjectIds } },
                    { destinationProjectId: { in: accessibleProjectIds } },
                  ],
                },
              },
            },
            select: { id: true, transferNumber: true, postedAt: true },
            orderBy: { transferNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('finance.supplier_invoice.view')
        ? this.prisma.supplierInvoice.findMany({
            where: { projectId, companyId: auth.companyId },
            select: {
              id: true,
              supplierInvoiceNumber: true,
              supplierReference: true,
              state: true,
            },
            orderBy: { supplierInvoiceNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('finance.client_invoice.view')
        ? this.prisma.clientInvoice.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, clientInvoiceNumber: true, state: true },
            orderBy: { clientInvoiceNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('finance.payment.view')
        ? this.prisma.payment.findMany({
            where: { projectId, companyId: auth.companyId },
            select: {
              id: true,
              paymentNumber: true,
              paymentDirection: true,
              state: true,
              reference: true,
            },
            orderBy: { paymentNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('subcontracts.agreement.view')
        ? this.prisma.subcontractAgreement.findMany({
            where: { projectId, companyId: auth.companyId },
            select: {
              id: true,
              agreementNumber: true,
              approvalState: true,
            },
            orderBy: { agreementNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('subcontracts.work_order.view')
        ? this.prisma.subcontractWorkOrder.findMany({
            where: { projectId, companyId: auth.companyId },
            select: {
              id: true,
              workOrderNumber: true,
              approvalState: true,
            },
            orderBy: { workOrderNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('subcontracts.claim.view')
        ? this.prisma.subcontractClaim.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, claimNumber: true, state: true },
            orderBy: { claimNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('subcontracts.certification.view')
        ? this.prisma.subcontractCertification.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, certificationNumber: true, state: true },
            orderBy: { certificationNumber: 'asc' },
          })
        : Promise.resolve([]),
      can('subcontracts.variation.view')
        ? this.prisma.subcontractVariation.findMany({
            where: { projectId, companyId: auth.companyId },
            select: { id: true, variationNumber: true, state: true },
            orderBy: { variationNumber: 'asc' },
          })
        : Promise.resolve([]),
    ]);
    return {
      wbs,
      activities,
      purchaseRequests,
      rfqs,
      supplierQuotations,
      purchaseOrders,
      goodsReceipts,
      materialReservations,
      materialIssues,
      materialReturns,
      stockTransfers,
      supplierInvoices,
      clientInvoices,
      payments,
      subcontractAgreements,
      subcontractWorkOrders,
      subcontractClaims,
      subcontractCertifications,
      subcontractVariations,
    };
  }

  async list(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    await this.assertTarget(auth, projectId, entityType, entityId);

    const rows = await this.prisma.document.findMany({
      where: {
        companyId: auth.companyId,
        links: {
          some: { entityType, entityId },
        },
      },
      include: {
        documentType: {
          select: {
            id: true,
            documentTypeCode: true,
            documentTypeName: true,
          },
        },
        uploadedBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: [{ uploadedAt: 'desc' }, { fileName: 'asc' }],
    });

    return rows.map((row) => this.toDto(row));
  }

  async upload(
    context: AuditContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentTypeId: string,
    file: UploadedDocumentFile,
  ) {
    await this.assertTarget(
      context.auth,
      projectId,
      entityType,
      entityId,
    );

    const document = await this.documents.uploadProjectDocument(
      context,
      projectId,
      documentTypeId,
      file,
    );

    await this.prisma.$transaction(async (tx) => {
      const link = await tx.documentLink.create({
        data: {
          documentId: document.id,
          entityType,
          entityId,
          linkedByUserId: context.auth.userId,
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'DOCUMENT_LINK',
          entityId: link.id,
          action: 'CREATE',
          newValues: {
            documentId: document.id,
            entityType,
            entityId,
            projectId,
          },
        },
        tx,
      );
    });

    return document;
  }

  async download(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
  ) {
    await this.assertTarget(auth, projectId, entityType, entityId);
    await this.assertLinked(
      auth,
      documentId,
      entityType,
      entityId,
    );
    return this.documents.downloadProjectDocument(
      auth,
      projectId,
      documentId,
    );
  }

  async setActive(
    context: AuditContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
    isActive: boolean,
  ) {
    await this.assertTarget(
      context.auth,
      projectId,
      entityType,
      entityId,
    );
    await this.assertLinked(
      context.auth,
      documentId,
      entityType,
      entityId,
    );
    return this.documents.setProjectDocumentActive(
      context,
      projectId,
      documentId,
      isActive,
    );
  }

  private async assertTarget(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    this.assertTargetPermission(auth, entityType);

    if (entityType === 'WBS') {
      const row = await this.prisma.wbsElement.findFirst({
        where: { id: entityId, projectId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'ACTIVITY') {
      const row = await this.prisma.activity.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'PURCHASE_REQUEST') {
      const row = await this.prisma.purchaseRequest.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'RFQ') {
      const row = await this.prisma.rfq.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUPPLIER_QUOTATION') {
      const row = await this.prisma.supplierQuotation.findFirst({
        where: {
          id: entityId,
          companyId: auth.companyId,
          rfq: { projectId, companyId: auth.companyId },
        },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'PURCHASE_ORDER') {
      const row = await this.prisma.purchaseOrder.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'GOODS_RECEIPT') {
      const row = await this.prisma.goodsReceipt.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'MATERIAL_RESERVATION') {
      const row = await this.prisma.materialReservation.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'MATERIAL_ISSUE') {
      const row = await this.prisma.materialIssue.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'MATERIAL_RETURN') {
      const row = await this.prisma.materialReturn.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUPPLIER_INVOICE') {
      const row = await this.prisma.supplierInvoice.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'CLIENT_INVOICE') {
      const row = await this.prisma.clientInvoice.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'PAYMENT') {
      const row = await this.prisma.payment.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUBCONTRACT_AGREEMENT') {
      const row = await this.prisma.subcontractAgreement.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUBCONTRACT_WORK_ORDER') {
      const row = await this.prisma.subcontractWorkOrder.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUBCONTRACT_CLAIM') {
      const row = await this.prisma.subcontractClaim.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUBCONTRACT_CERTIFICATION') {
      const row = await this.prisma.subcontractCertification.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    if (entityType === 'SUBCONTRACT_VARIATION') {
      const row = await this.prisma.subcontractVariation.findFirst({
        where: { id: entityId, projectId, companyId: auth.companyId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    const transfer = await this.prisma.stockTransfer.findFirst({
      where: {
        id: entityId,
        companyId: auth.companyId,
        items: {
          some: {
            OR: [
              { sourceProjectId: projectId },
              { destinationProjectId: projectId },
            ],
          },
        },
      },
      select: {
        id: true,
        items: {
          select: { sourceProjectId: true, destinationProjectId: true },
        },
      },
    });
    if (!transfer) throw this.targetNotFound();
    const projects = new Set(
      transfer.items.flatMap((item) => [
        item.sourceProjectId,
        item.destinationProjectId,
      ]),
    );
    for (const transferProjectId of projects) {
      await this.access.assertAccess(auth, transferProjectId);
    }
  }

  private assertTargetPermission(
    auth: AuthenticatedUserContext,
    entityType: DocumentTargetType,
  ) {
    const permission: Partial<Record<DocumentTargetType, string>> = {
      GOODS_RECEIPT: 'inventory.receipt.view',
      MATERIAL_RESERVATION: 'inventory.reservation.view',
      MATERIAL_ISSUE: 'inventory.issue.view',
      MATERIAL_RETURN: 'inventory.return.view',
      STOCK_TRANSFER: 'inventory.transfer.view',
      SUPPLIER_INVOICE: 'finance.supplier_invoice.view',
      CLIENT_INVOICE: 'finance.client_invoice.view',
      PAYMENT: 'finance.payment.view',
      SUBCONTRACT_AGREEMENT: 'subcontracts.agreement.view',
      SUBCONTRACT_WORK_ORDER: 'subcontracts.work_order.view',
      SUBCONTRACT_CLAIM: 'subcontracts.claim.view',
      SUBCONTRACT_CERTIFICATION: 'subcontracts.certification.view',
      SUBCONTRACT_VARIATION: 'subcontracts.variation.view',
    };
    const required = permission[entityType];
    if (required && !auth.permissions.includes(required)) {
      throw new ForbiddenException({
        code: 'DOCUMENT_TARGET_PERMISSION_DENIED',
        detail:
          'Document target visibility requires the matching business-record view permission.',
      });
    }
  }

  private async assertLinked(
    auth: AuthenticatedUserContext,
    documentId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    const linked = await this.prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType,
        entityId,
        document: { companyId: auth.companyId },
      },
      select: { id: true },
    });
    if (!linked) {
      throw new NotFoundException({
        code: 'DOCUMENT_TARGET_LINK_NOT_FOUND',
        detail: 'Document is not linked to the requested target.',
      });
    }
  }

  private toDto(row: {
    id: string;
    documentTypeId: string;
    fileName: string;
    storageProvider: string;
    mimeType: string;
    fileSizeBytes: number;
    checksum: string | null;
    uploadedAt: Date;
    isActive: boolean;
    documentType: {
      id: string;
      documentTypeCode: string;
      documentTypeName: string;
    };
    uploadedBy: {
      id: string;
      displayName: string;
    };
  }) {
    return {
      id: row.id,
      documentTypeId: row.documentTypeId,
      fileName: row.fileName,
      storageProvider: row.storageProvider,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      checksum: row.checksum,
      uploadedAt: row.uploadedAt,
      isActive: row.isActive,
      documentType: row.documentType,
      uploadedBy: row.uploadedBy,
    };
  }

  private targetNotFound() {
    return new UnprocessableEntityException({
      code: 'DOCUMENT_TARGET_INVALID',
      detail:
        'Document target must be a valid WBS, Activity, Procurement or Inventory transaction in the selected Project.',
    });
  }
}
