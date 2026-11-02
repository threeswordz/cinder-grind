import { apiRequest } from './client';
export type RequestChoice = {
    id: string;
    [key: string]: unknown;
};
export type Page<T> = {
    items: T[];
    nextCursor: string | null;
};
export type RequestSummary = {
    id: string;
    requestDate: string;
    version: number;
    requester: {
        employeeName: string;
    };
    warehouse: {
        warehouseName: string;
    };
    _count: {
        lines: number;
    };
};
export type RequestReceipt = {
    id: string;
    recipientEmployeeId: string;
    issuerEmployeeId: string;
    recipient: {
        employeeName: string;
    };
    issuer: {
        employeeName: string;
    };
    receivedAt: string;
    recordedAt: string;
    recordedBy: {
        displayName: string;
    };
    supersedesReceiptId: string | null;
    superseded: boolean;
    reason: string;
    documentId: string | null;
    evidenceChecksum: string | null;
};
export type RequestLink = {
    id: string;
    linkedAt: string;
    quantity: string;
    currentlyIssued: boolean;
    issue: {
        id: string;
        issueNumber: string;
        postedAt: string | null;
        reversedAt: string | null;
    } | null;
    materialIssueItemId: string | null;
    receipts: RequestReceipt[];
};
export type RequestLine = {
    id: string;
    lineNo: number;
    materialId: string;
    uomId: string;
    material: {
        materialCode: string;
        materialName: string;
    };
    uom: {
        uomCode: string;
    };
    requestedQuantity: string;
    issuedQuantity: string;
    acknowledgedQuantity: string;
    fulfillment: string;
    remarks: string | null;
    wbsId: string | null;
    costCodeId: string | null;
    activityId: string | null;
    issueLinks: RequestLink[];
};
export type MaterialRequest = {
    id: string;
    companyId: string;
    projectId: string;
    warehouseId: string;
    requesterEmployeeId: string;
    requestDate: string;
    remarks: string | null;
    version: number;
    requester: {
        employeeName: string;
    };
    warehouse: {
        warehouseName: string;
    };
    lines: RequestLine[];
    revisions: Array<{
        id: string;
        version: number;
        action: string;
        reason: string;
        recordedAt: string;
        actor: {
            displayName: string;
        };
        facts: {
            requestDate: string;
            remarks: string | null;
            lines: Array<{
                id: string;
                requestedQuantity: string;
                remarks: string | null;
            }>;
        };
    }>;
};
export type RequestCommandResult = {
    id: string;
    version: number;
    revisionId: string;
};
type Data<T> = {
    data: T;
};
export const materialRequestsApi = {
    projects: () => apiRequest<Data<Array<{
        id: string;
        projectCode: string;
        projectName: string;
    }>>>('/inventory/material-requests/projects'),
    list: (projectId: string, after = '') => apiRequest<Data<Page<RequestSummary>>>('/inventory/material-requests?' + new URLSearchParams({ projectId, ...(after ? { after } : {}) })),
    get: (id: string) => apiRequest<Data<MaterialRequest>>('/inventory/material-requests/' + id),
    choices: (projectId: string, kind: string, after = '') => apiRequest<Data<Page<RequestChoice>>>('/inventory/material-requests/choices?' + new URLSearchParams({ projectId, kind, ...(after ? { after } : {}) })),
    issueChoices: (id: string, lineId: string, after = '') => apiRequest<Data<Page<{
        id: string;
        lineNo: number;
        quantity: string;
        materialIssue: {
            id: string;
            issueNumber: string;
            issuedToEmployeeId: string | null;
        };
    }>>>('/inventory/material-requests/' + id + '/issue-choices?' + new URLSearchParams({ lineId, ...(after ? { after } : {}) })),
    command: (suffix: string, body: unknown) => apiRequest<Data<RequestCommandResult>>('/inventory/material-requests' + suffix, { method: 'POST', body: JSON.stringify(body) }),
};
