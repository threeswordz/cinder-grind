import { apiRequest } from './client';

export type PhysicalObservation = {
  id: string; claimLineId: string; basis: 'MEASURED' | 'MILESTONE' | 'LUMP_SUM';
  item: string; location: string; basisDescription: string; quantity: string | null;
  uomId: string | null; progressPercent: string; reason: string; documentIds: string[]; heldSourceId: string | null;
};
export type PhysicalDecisionInput = {
  observationId: string; acceptedQuantity?: string; accepted?: boolean; acceptedAmount: string;
  heldDisposition: 'REWORK' | 'REJECTED' | null; reason: string;
};
export type PhysicalSource = {
  controlled: true; claimId: string; version: number; canCapture: boolean; canDecide: boolean;
  uoms: Array<{ id: string; uomCode: string; uomName: string; decimalPlaces: number; isActive: boolean }>;
  heldSources: Array<Pick<PhysicalObservation, 'id' | 'item' | 'location' | 'basis' | 'basisDescription' | 'uomId'> & { claimNumber: string; remainingQuantity: string | null }>;
  heldOrigins: Array<{ id: string; claimNumber: string; item: string; location: string }>;
  revisions: Array<{ id: string; version: number; reason: string; actorName: string; createdAt: string; observations: PhysicalObservation[] }>;
  submission: { revisionId: string; sourceDigest: string; actorName: string; createdAt: string;
    evidence: Array<{ id: string; checksum: string; size: number; fileName: string; mimeType: string }> } | null;
  decision: { reason: string; actorName: string; createdAt: string; assessedAmount?: string;
    decisions: Array<{ observationId: string; claimLineId: string; acceptedQuantity: string | null; heldQuantity: string | null;
      accepted: boolean; acceptedAmount?: string; heldDisposition: 'REWORK' | 'REJECTED' | null; reason: string }> } | null;
};
export type PhysicalCapture = { requestKey: string; expectedVersion: number; reason: string; observations: PhysicalObservation[] };
export type PhysicalDecision = { requestKey: string; expectedVersion: number; sourceDigest: string; reason: string; decisions: PhysicalDecisionInput[] };
const path = (id: string) => '/subcontracts/physical/claims/' + id;
export const physicalSubcontractsApi = {
  source: (id: string) => apiRequest<{ data: PhysicalSource | { controlled: false } }>(path(id)),
  capture: (id: string, body: PhysicalCapture) => apiRequest<{ data: { claimId: string; version: number; revisionId: string } }>(path(id) + '/capture', { method: 'POST', body: JSON.stringify(body) }),
  decide: (id: string, body: PhysicalDecision) => apiRequest<{ data: { id: string; state: string } }>(path(id) + '/decide', { method: 'POST', body: JSON.stringify(body) }),
};
