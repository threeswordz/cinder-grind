import { apiRequest } from './client';

type Data<T> = { data: T };

export type SourcingProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type ApprovedDemandLine = {
  id: string;
  purchaseRequestId: string;
  lineNo: number;
  lineType: 'MATERIAL' | 'SERVICE';
  materialCodeSnapshot: string | null;
  description: string;
  quantity: string;
  uomId: string;
  requiredOnSite: string | null;
  purchaseRequest: {
    id: string;
    prNumber: string;
  };
  uom: {
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  };
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: { id: string; costCode: string; costName: string } | null;
  activity: {
    id: string;
    activityCode: string;
    activityName: string;
  } | null;
  awardedQuantity: string;
  remainingAwardQuantity: string;
};

export type SupplierOption = {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
};

export type RfqListItem = {
  id: string;
  companyId: string;
  projectId: string;
  rfqNumber: string;
  rfqDate: string;
  closingDate: string | null;
  remarks: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  };
  _count: {
    lines: number;
    suppliers: number;
    quotations: number;
    awards: number;
  };
};

export type CreatedRfq = {
  id: string;
  companyId: string;
  projectId: string;
  rfqNumber: string;
  rfqDate: string;
  closingDate: string | null;
  remarks: string | null;
  createdAt: string;
  lines: Array<{
    id: string;
    lineNo: number;
    purchaseRequestLineId: string;
    quantity: string;
  }>;
};

export type RfqSupplier = {
  id: string;
  rfqId: string;
  supplierId: string;
  supplierCodeSnapshot: string;
  supplierNameSnapshot: string;
  invitedAt: string;
};

export type QuotationLine = {
  id: string;
  supplierQuotationId: string;
  rfqLineId: string;
  lineNo: number;
  quantity: string;
  uomId: string;
  uomCodeSnapshot: string;
  unitPrice: string;
  amount: string;
  remarks: string | null;
  award?: { id: string } | null;
};

export type SupplierQuotation = {
  id: string;
  companyId: string;
  rfqId: string;
  supplierId: string;
  supplierReference: string | null;
  quotationDate: string;
  validityDate: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  lines: QuotationLine[];
};

export type QuotationAward = {
  id: string;
  rfqId: string;
  rfqLineId: string;
  supplierQuotationId: string;
  supplierQuotationLineId: string;
  supplierId: string;
  supplierCodeSnapshot: string;
  supplierNameSnapshot: string;
  supplierReferenceSnapshot: string | null;
  quotationDateSnapshot: string;
  quantity: string;
  uomId: string;
  uomCodeSnapshot: string;
  unitPrice: string;
  amount: string;
  decisionReason: string | null;
  selectedAt: string;
  selectedBy: {
    id: string;
    displayName: string;
    email: string;
  };
};

export type RfqLine = {
  id: string;
  rfqId: string;
  lineNo: number;
  purchaseRequestLineId: string;
  lineType: 'MATERIAL' | 'SERVICE';
  materialCodeSnapshot: string | null;
  description: string;
  quantity: string;
  uomId: string;
  uomCodeSnapshot: string;
  requiredOnSite: string | null;
  purchaseRequestLine: {
    id: string;
    wbs: { id: string; wbsCode: string; wbsName: string } | null;
    costCode: { id: string; costCode: string; costName: string } | null;
    activity: {
      id: string;
      activityCode: string;
      activityName: string;
    } | null;
    purchaseRequest: {
      id: string;
      prNumber: string;
      cancelledAt: string | null;
      approvalInstance: { approvalState: string } | null;
    };
  };
  award: QuotationAward | null;
};

export type RfqDetail = RfqListItem & {
  project: SourcingProject;
  lines: RfqLine[];
  suppliers: RfqSupplier[];
  quotations: SupplierQuotation[];
  awards: QuotationAward[];
};

export type RfqComparison = {
  rfq: {
    id: string;
    projectId: string;
    rfqNumber: string;
    rfqDate: string;
    closingDate: string | null;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    purchaseRequestLineId: string;
    sourcePrNumber: string;
    lineType: 'MATERIAL' | 'SERVICE';
    materialCodeSnapshot: string | null;
    description: string;
    quantity: string;
    uomId: string;
    uomCodeSnapshot: string;
    requiredOnSite: string | null;
    award: QuotationAward | null;
    offers: Array<{
      supplierId: string;
      supplierCodeSnapshot: string;
      supplierNameSnapshot: string;
      quotationId: string | null;
      supplierReference: string | null;
      quotationDate: string | null;
      validityDate: string | null;
      quotationLineId: string | null;
      quotedQuantity: string | null;
      unitPrice: string | null;
      amount: string | null;
      remarks: string | null;
    }>;
  }>;
  suppliers: Array<
    RfqSupplier & {
      quotationId: string | null;
      supplierReference: string | null;
      quotationDate: string | null;
      validityDate: string | null;
      totalAmount: string | null;
    }
  >;
};

export const sourcingApi = {
  projects: () =>
    apiRequest<Data<SourcingProject[]>>('/procurement/rfq-projects'),
  approvedDemand: (projectId: string) =>
    apiRequest<Data<ApprovedDemandLine[]>>(
      '/procurement/projects/' + projectId + '/approved-demand',
    ),
  suppliers: (projectId: string) =>
    apiRequest<Data<SupplierOption[]>>(
      '/procurement/projects/' + projectId + '/supplier-options',
    ),
  rfqs: (projectId: string) =>
    apiRequest<Data<RfqListItem[]>>(
      '/procurement/projects/' + projectId + '/rfqs',
    ),
  rfq: (rfqId: string) =>
    apiRequest<Data<RfqDetail>>('/procurement/rfqs/' + rfqId),
  createRfq: (
    projectId: string,
    body: {
      closingDate?: string | null;
      remarks?: string | null;
      lines: Array<{
        purchaseRequestLineId: string;
        quantity: string | number;
      }>;
    },
  ) =>
    apiRequest<Data<CreatedRfq>>(
      '/procurement/projects/' + projectId + '/rfqs',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  inviteSupplier: (rfqId: string, supplierId: string) =>
    apiRequest<Data<RfqSupplier>>(
      '/procurement/rfqs/' + rfqId + '/suppliers',
      {
        method: 'POST',
        body: JSON.stringify({ supplierId }),
      },
    ),
  createQuotation: (
    rfqId: string,
    body: {
      supplierId: string;
      supplierReference?: string | null;
      quotationDate: string;
      validityDate?: string | null;
      remarks?: string | null;
    },
  ) =>
    apiRequest<Data<SupplierQuotation>>(
      '/procurement/rfqs/' + rfqId + '/quotations',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  updateQuotation: (
    quotationId: string,
    body: Partial<{
      supplierReference: string | null;
      quotationDate: string;
      validityDate: string | null;
      remarks: string | null;
    }>,
  ) =>
    apiRequest<Data<SupplierQuotation>>(
      '/procurement/quotations/' + quotationId,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),
  upsertQuotationLine: (
    quotationId: string,
    rfqLineId: string,
    body: {
      quantity: string | number;
      unitPrice: string | number;
      remarks?: string | null;
    },
  ) =>
    apiRequest<Data<QuotationLine>>(
      '/procurement/quotations/' +
        quotationId +
        '/lines/' +
        rfqLineId,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
    ),
  comparison: (rfqId: string) =>
    apiRequest<Data<RfqComparison>>(
      '/procurement/rfqs/' + rfqId + '/comparison',
    ),
  selectAward: (
    rfqLineId: string,
    supplierQuotationLineId: string,
    decisionReason?: string | null,
  ) =>
    apiRequest<Data<QuotationAward>>(
      '/procurement/rfq-lines/' + rfqLineId + '/award',
      {
        method: 'POST',
        body: JSON.stringify({
          supplierQuotationLineId,
          decisionReason: decisionReason ?? null,
        }),
      },
    ),
};
