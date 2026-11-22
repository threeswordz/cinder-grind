import {createHash} from 'node:crypto';

export const URGENT_DOC_ENTITY = 'MATERIAL_ISSUE_URGENT_DOCS';
export const URGENT_DOC_REGISTER = 'REGISTER';
export const URGENT_DOC_SUBMIT = 'SUBMIT';
export const URGENT_DOC_RETURN = 'RETURN';
export const URGENT_DOC_CLOSE = 'CLOSE';
export const URGENT_DOC_WINDOW_MS = 48 * 60 * 60 * 1000;

export type UrgentDocumentRow = {
  id: string;
  actorUserId: string;
  action: string;
  occurredAt: Date;
  newValues: unknown;
};
export type UrgentDocumentSnapshot = {
  id: string;
  checksum: string;
  uploadedAt: string;
  fileSizeBytes: number;
  linkIds: string[];
};
export type UrgentDocumentState = {
  status: 'OPEN' | 'SUBMITTED' | 'RETURNED' | 'CLOSED';
  reason: string;
  createdByUserId: string;
  registeredAt: string;
  dueAt: string;
  sourcePostedAt: string;
  lastEventId: string;
  documentIds: string[];
  evidenceFingerprint: string | null;
  submittedAt: string | null;
  docsUploadedByDeadline: boolean | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  onTime: boolean | null;
};

const hex = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const isHash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isIso = (v: unknown): v is string => typeof v === 'string' &&
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function corrupted(message: string): never { throw new RangeError('PM09_' + message); }

export function urgentDueAt(sourcePostedAt: Date): string {
  if (!(sourcePostedAt instanceof Date) || !Number.isFinite(sourcePostedAt.getTime()))
    return corrupted('POSTED_AT_INVALID');
  const end = sourcePostedAt.getTime() + URGENT_DOC_WINDOW_MS;
  if (!Number.isFinite(end) || end > 8.64e15) return corrupted('DEADLINE_OVERFLOW');
  return new Date(end).toISOString();
}

export function urgentSnapshotDigest(docs: readonly UrgentDocumentSnapshot[]): string {
  if (!docs.length || docs.length > 100) return corrupted('DOCUMENTS_REQUIRED');
  const ids = new Set<string>();
  const sorted = [...docs].sort((a,b)=>a.id.localeCompare(b.id));
  for (const d of sorted) {
    if (!uuid(d.id) || ids.has(d.id) || !isHash(d.checksum) ||
      !isIso(d.uploadedAt) || !Number.isSafeInteger(d.fileSizeBytes) ||
      d.fileSizeBytes <= 0 || !d.linkIds.length || d.linkIds.some(id=>!uuid(id)))
      return corrupted('DOCUMENT_SOURCE_INVALID');
    ids.add(d.id);
    if (new Set(d.linkIds).size !== d.linkIds.length) return corrupted('DOCUMENT_LINK_DUPLICATE');
  }
  return hex(sorted.map(d=>({
    id:d.id,sha256:d.checksum,uploadedAt:d.uploadedAt,
    fileSizeBytes:d.fileSizeBytes,linkIds:[...d.linkIds].sort(),
  })));
}

export function urgentIssueEvidence(
  postedAt: Date,
  rows: readonly UrgentDocumentRow[],
): UrgentDocumentState | null {
  const dueAt = urgentDueAt(postedAt);
  if (!rows.length) return null;
  const roots = rows.filter(row=>row.action===URGENT_DOC_REGISTER);
  if (roots.length!==1) return corrupted('REGISTER_REQUIRED_ONCE');
  const root=roots[0]!;
  const init=object(root.newValues);
  if (!isString(root.id) || !isString(root.actorUserId) ||
    !isString(init?.reason) || init.sourcePostedAt !== postedAt.toISOString() ||
    init.dueAt !== dueAt || init.authority !== 'DOCUMENT_TRACKING_ONLY_NO_STOCK_POSTING' ||
    root.occurredAt.getTime()<postedAt.getTime())
    return corrupted('REGISTER_INVALID');
  const links = new Map<string,UrgentDocumentRow>();
  const used = new Set<string>();
  for (const row of rows) {
    if (!isString(row.id) || used.has(row.id) || !Number.isFinite(row.occurredAt.getTime()))
      return corrupted('EVENT_ID_OR_TIME_INVALID');
    used.add(row.id);
    if (row===root) continue;
    const v=object(row.newValues);
    if (![URGENT_DOC_SUBMIT,URGENT_DOC_RETURN,URGENT_DOC_CLOSE].includes(row.action) ||
      !isString(v?.previousEventId) || links.has(v.previousEventId))
      return corrupted('EVENT_CHAIN_INVALID');
    links.set(v.previousEventId,row);
  }
  const state: UrgentDocumentState={
    status:'OPEN', reason:init.reason,createdByUserId:root.actorUserId,
    registeredAt:root.occurredAt.toISOString(),dueAt,
    sourcePostedAt:postedAt.toISOString(),lastEventId:root.id,
    documentIds:[],evidenceFingerprint:null,submittedAt:null,
    docsUploadedByDeadline:null,reviewedByUserId:null,reviewedAt:null,
    reviewerNote:null,onTime:null,
  };
  let prior=root;
  while(links.size){
    const event=links.get(prior.id);
    if(!event || event.occurredAt.getTime()<prior.occurredAt.getTime())
      return corrupted('EVENT_ORDER_OR_ORPHAN');
    const v=object(event.newValues);
    if(!v) return corrupted('EVENT_BODY_INVALID');
    if(event.action===URGENT_DOC_SUBMIT){
      if(state.status!=='OPEN'&&state.status!=='RETURNED')return corrupted('SUBMIT_STATE_INVALID');
      if(event.actorUserId!==root.actorUserId || !isHash(v.evidenceFingerprint) ||
        !Array.isArray(v.documentIds) || !v.documentIds.length ||
        v.documentIds.length>100 || v.documentIds.some(id=>!uuid(id)) ||
        new Set(v.documentIds).size!==v.documentIds.length ||
        typeof v.docsUploadedByDeadline!=='boolean' || !isString(v.completionNote))
        return corrupted('SUBMISSION_INVALID');
      state.status='SUBMITTED';
      state.documentIds=[...v.documentIds] as string[];
      state.evidenceFingerprint=v.evidenceFingerprint;
      state.submittedAt=event.occurredAt.toISOString();
      state.docsUploadedByDeadline=v.docsUploadedByDeadline;
      state.reviewedAt=null;state.reviewedByUserId=null;state.reviewerNote=null;state.onTime=null;
    }else{
      if(state.status!=='SUBMITTED' || event.actorUserId===root.actorUserId ||
        !isString(v.note) || v.evidenceFingerprint!==state.evidenceFingerprint ||
        v.reviewedSubmissionEventId!==prior.id)
        return corrupted('DECISION_INVALID');
      state.status=event.action===URGENT_DOC_CLOSE?'CLOSED':'RETURNED';
      state.reviewedAt=event.occurredAt.toISOString();
      state.reviewedByUserId=event.actorUserId;
      state.reviewerNote=v.note;
      state.onTime=state.status==='CLOSED' &&
        Date.parse(state.submittedAt!)<=Date.parse(dueAt) &&
        state.docsUploadedByDeadline===true;
    }
    links.delete(prior.id);
    state.lastEventId=event.id;
    prior=event;
  }
  return state;
}
