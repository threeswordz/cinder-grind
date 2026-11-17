import { apiRequest } from './client';
type Data<T> = { data: T };
export type TransferDestination = {
  id: string; projectId: string; transferNumber: string; version: number; reversedAt: string | null;
  destinationWarehouse: { warehouseCode: string; warehouseName: string }; dispatchedAt: string | null;
  assignedEmployeeId: string | null; canReceive: boolean;
  lines: Array<{ id: string; material: { materialCode: string; materialName: string }; uom: { uomCode: string }; quantity: string; accepted: string; outstanding: string }>;
  receipts: Array<{ id: string; createdByUserId: string; reason: string; createdAt: string; postedAt: string | null; documentId: string | null; lines: Array<{ transferItemId: string; quantity: string; note: string }> }>;
};
export const transferRoot = '/inventory/transfer-custody';
export const transferDestinationPath = (project: string, id: string) => `${transferRoot}/projects/${project}/transfers/${id}`;
export const transferCustodyApi = {
  projects: () => apiRequest<Data<Array<{ id: string; projectCode: string; projectName: string }>>>(transferRoot + '/projects'),
  list: (projectId: string) => apiRequest<Data<Array<{ id: string; transferNumber: string }>>>(`${transferRoot}/projects/${projectId}/transfers`),
  get: (projectId: string, id: string) => apiRequest<Data<TransferDestination>>(transferDestinationPath(projectId, id)),
  receivers: (projectId: string, id: string) => apiRequest<Data<Array<{id:string;employeeCode:string;employeeName:string}>>>(transferDestinationPath(projectId,id)+'/receivers'),
  command: (path: string, body: unknown) => apiRequest<Data<{ id: string; receiptId?: string; version: number }>>(path, { method: 'POST', body: JSON.stringify(body) }),
};
