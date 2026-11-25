/** SS02: Store → independent PM → existing authorized material-master creator.
 * Audit-only request workflow: this code NEVER inserts/edits Material records.
 */
export const SS02_ENTITY = 'SS02_MATERIAL_CODE_REQUEST';
export type Ss02Action = 'REQUEST' | 'PM_APPROVE' | 'PM_RETURN' | 'CREATOR_LINK';
export type Ss02Status = 'PENDING_PM' | 'PENDING_CREATOR' | 'RETURNED' | 'COMPLETED';

export type Ss02Case = {
  requestId: string; companyId: string; projectId: string;
  requestedName: string; suggestedCode: string; suggestedUomCode: string;
  requestReason: string; requestedByUserId: string;
  pmUserId: string | null; creatorUserId: string | null;
  linkedMaterialId: string | null;
  status: Ss02Status; version: number; lastEventId: string;
};

type Event = {
  id: string; entityId: string; actorUserId: string;
  action: string; newValues: unknown; occurredAt: Date;
};

const obj = (x: unknown): Record<string, unknown> | null =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
    ? x as Record<string, unknown> : null;
export const ss02Uuid = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);

export function ss02Propose(input: unknown) {
  const x = obj(input);
  if (!x || Object.keys(x).some(k => ![
    'requestedName','suggestedCode','suggestedUomCode','requestReason',
  ].includes(k))) throw new RangeError('SS02_REQUEST_INVALID');
  const name = x.requestedName, code = x.suggestedCode ?? '';
  const uom = x.suggestedUomCode ?? '', reason = x.requestReason;
  if (typeof name !== 'string' || name.trim() !== name ||
      name.length < 2 || name.length > 200 ||
      typeof code !== 'string' || code.trim() !== code || code.length > 80 ||
      typeof uom !== 'string' || uom.trim() !== uom || uom.length > 30 ||
      typeof reason !== 'string' || reason.trim() !== reason ||
      reason.length < 3 || reason.length > 2000 ||
      [name,code,uom,reason].some(s => /[\u0000-\u001f\u007f]/.test(s)))
    throw new RangeError('SS02_REQUEST_INVALID');
  return { requestedName: name, suggestedCode: code,
    suggestedUomCode: uom, requestReason: reason };
}

export function ss02Decision(input: unknown) {
  const x = obj(input);
  if (!x || Object.keys(x).some(k => ![
    'action','expectedVersion','expectedEventId','note','createdMaterialId',
  ].includes(k)) || !['PM_APPROVE','PM_RETURN','CREATOR_LINK'].includes(String(x.action)) ||
      typeof x.expectedVersion !== 'number' || !Number.isSafeInteger(x.expectedVersion) ||
      x.expectedVersion < 1 || !ss02Uuid(x.expectedEventId) ||
      typeof x.note !== 'string' || x.note.trim() !== x.note ||
      x.note.length < 3 || x.note.length > 2000 || /[\u0000-\u001f\u007f]/.test(x.note))
    throw new RangeError('SS02_DECISION_INVALID');
  if (x.action === 'CREATOR_LINK' ? !ss02Uuid(x.createdMaterialId) :
      x.createdMaterialId !== undefined) throw new RangeError('SS02_DECISION_INVALID');
  return { action: x.action as Exclude<Ss02Action,'REQUEST'>,
    expectedVersion: x.expectedVersion as number,
    expectedEventId: x.expectedEventId as string, note: x.note,
    createdMaterialId: (x.createdMaterialId ?? null) as string | null };
}

/** Validates every audit transition, immutable request fields, stage actors and chain. */
export function ss02Replay(events: readonly Event[], companyId: string,
  projectId: string, requestId: string): Ss02Case | null {
  if (!ss02Uuid(companyId) || !ss02Uuid(projectId) || !ss02Uuid(requestId))
    throw new RangeError('SS02_SCOPE_INVALID');
  if (!events.length) return null;
  if (events.length > 20) throw new RangeError('SS02_HISTORY_LIMIT');
  let previous: Event | null = null;
  let state: Ss02Case | null = null;
  const versions = new Map<number, Event>();
  for (const event of events) {
    const v = obj(event.newValues);
    if (!ss02Uuid(event.id) || event.entityId !== requestId ||
        !ss02Uuid(event.actorUserId) || !(event.occurredAt instanceof Date) ||
        !Number.isFinite(event.occurredAt.getTime()) ||
        !v || v.companyId !== companyId || v.projectId !== projectId ||
        v.requestId !== requestId || !Number.isSafeInteger(v.version) ||
        (v.version as number) < 1 || versions.has(v.version as number))
      throw new RangeError('SS02_HISTORY_INVALID');
    versions.set(v.version as number, event);
  }
  for(let version=1;version<=events.length;version++){
    const event=versions.get(version);
    if(!event)throw new RangeError('SS02_HISTORY_VERSION_GAP');
    const v=obj(event.newValues)!;
    const request=ss02Propose({
      requestedName:v.requestedName,suggestedCode:v.suggestedCode,
      suggestedUomCode:v.suggestedUomCode,requestReason:v.requestReason,
    });
    const before: Ss02Case | null = state;
    if (v.previousEventId !== (previous?.id ?? null) ||
        (previous && event.occurredAt.getTime() < previous.occurredAt.getTime()) ||
        (before && (before.requestedName !== request.requestedName ||
          before.suggestedCode !== request.suggestedCode ||
          before.suggestedUomCode !== request.suggestedUomCode ||
          before.requestReason !== request.requestReason ||
          before.requestedByUserId !== v.requestedByUserId)))
      throw new RangeError('SS02_HISTORY_TAMPER');
    if (!ss02Uuid(v.requestedByUserId) ||
        !(v.pmUserId === null || ss02Uuid(v.pmUserId)) ||
        !(v.creatorUserId === null || ss02Uuid(v.creatorUserId)) ||
        !(v.linkedMaterialId === null || ss02Uuid(v.linkedMaterialId)))
      throw new RangeError('SS02_HISTORY_ACTOR_INVALID');
    const valid =
      (!before && version===1 && event.action==='REQUEST' &&
        v.status==='PENDING_PM' && v.requestedByUserId===event.actorUserId &&
        v.pmUserId===null && v.creatorUserId===null && v.linkedMaterialId===null) ||
      (before?.status==='PENDING_PM' && v.requestedByUserId!==event.actorUserId &&
        v.pmUserId===event.actorUserId && v.creatorUserId===null &&
        v.linkedMaterialId===null &&
        ((event.action==='PM_APPROVE' && v.status==='PENDING_CREATOR') ||
         (event.action==='PM_RETURN' && v.status==='RETURNED'))) ||
      (before?.status==='PENDING_CREATOR' && event.action==='CREATOR_LINK' &&
        v.status==='COMPLETED' && v.pmUserId===before.pmUserId &&
        v.creatorUserId===event.actorUserId &&
        event.actorUserId!==before.requestedByUserId &&
        event.actorUserId!==before.pmUserId && ss02Uuid(v.linkedMaterialId));
    if (!valid) throw new RangeError('SS02_HISTORY_ILLEGAL_STAGE');
    state={
      requestId,companyId,projectId,...request,
      requestedByUserId:v.requestedByUserId as string,
      pmUserId:v.pmUserId as string|null,
      creatorUserId:v.creatorUserId as string|null,
      linkedMaterialId:v.linkedMaterialId as string|null,
      status:v.status as Ss02Status,version,lastEventId:event.id,
    };
    previous=event;
  }
  return state;
}
