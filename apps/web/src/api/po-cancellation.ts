import { apiRequest } from './client';

type Data<T> = { data: T };
export type PoCancelAction =
  | 'PROPOSE' | 'PM_FORWARD' | 'PM_RETURN' | 'BEN_APPROVE' | 'BEN_REJECT';
export type PoCancelStatus =
  | 'PM_PENDING' | 'BEN_PENDING' | 'RETURNED' | 'REJECTED' | 'BEN_APPROVED';
export type PoCancelCase = {
  caseId: string;
  companyId: string;
  projectId: string;
  orderId: string;
  poNumber: string;
  revisionNo: number;
  orderUpdatedAt: string;
  makerUserId: string;
  pmUserId: string | null;
  benUserId: string | null;
  version: number;
  status: PoCancelStatus;
};
export type PoCancelSnapshot = {
  orderId: string;
  case: PoCancelCase | null;
  expectedPreviousEventId: string | null;
};
export type PoCancelEventInput = {
  action: PoCancelAction;
  expectedVersion: number;
  expectedPreviousEventId: string | null;
  note: string;
};
export type PoCancelEventReceipt = {
  orderId: string;
  caseId: string;
  status: PoCancelStatus;
  version: number;
  expectedPreviousEventId: string;
  poCancelled: false;
  financePosted: false;
};
const path = (orderId: string) =>
  '/procurement/purchase-orders/' + encodeURIComponent(orderId) + '/cancellation-case';
export const poCancellationApi = {
  read: (orderId: string) =>
    apiRequest<Data<PoCancelSnapshot>>(path(orderId)),
  decide: (orderId: string, input: PoCancelEventInput) =>
    apiRequest<Data<PoCancelEventReceipt>>(path(orderId) + '/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
