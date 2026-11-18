import { apiRequest } from './client';

export type MaterialUomRevision = { id: string; revisionNo: number; sourceUomId: string; sourceUomCode: string; sourceUomName: string; sourcePrecision: number; numerator: string; denominator: string; effectiveFrom: string; reason: string };
export type MaterialUomState = { material: { id: string; materialCode: string; materialName: string; isActive: boolean }; state: string; inventoryConversionEnabled: false;
  basis: { stockUomId: string; stockUomCode: string; stockUomName: string; stockPrecision: number; version: number; reason: string } | null;
  revisions: MaterialUomRevision[]; nextBefore: number | null };
export type MaterialUomPreview = { materialId: string; basisVersion: number; businessDate: string; revisionId: string | null; effectiveFrom: string | null; numerator: string; denominator: string; sourceUomCode: string; stockUomCode: string; enteredQuantity: string; stockQuantity: string };
const root = (id: string) => '/master-data/material-conversions/' + encodeURIComponent(id);
const post = <T>(path: string, body: Record<string, unknown>) => apiRequest<{ data: T }>(path, { method: 'POST', body: JSON.stringify(body) });
export const materialUomApi = {
  get: (id: string, before?: number) => apiRequest<{ data: MaterialUomState }>(root(id) + (before ? '?before=' + before : '')),
  prepare: (id: string, body: Record<string, unknown>) => post(root(id) + '/basis', body),
  revise: (id: string, body: Record<string, unknown>) => post(root(id) + '/revisions', body),
  preview: (id: string, body: Record<string, unknown>) => post<MaterialUomPreview>(root(id) + '/preview', body),
};
