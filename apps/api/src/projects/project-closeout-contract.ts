// BEN04 / PM16: operational closure evidence only. NEVER archives Project,
// settles AP/AR, posts stock, revalues BOQ, or deletes unsettled obligations.
import { createHash } from 'node:crypto';

export const CLOSEOUT_ENTITY = 'PROJECT_OPERATIONAL_CLOSEOUT';
export const PREPARE_CLOSEOUT = 'PREPARE';
export const BEN_CLOSEOUT_SIGN = 'SIGN_BEN';
export const NANCY_CLOSEOUT_SIGN = 'SIGN_NANCY';

export const CLOSEOUT_CATEGORIES = [
  'WORK_ACCEPTANCE', 'PO_CONTRACTS', 'AP_AR_PAYMENTS',
  'STOCK_TOOLS_ASSETS', 'BOQ_VO_COST', 'HANDOVER_DOCUMENTS',
] as const;
export type CloseoutCategory = typeof CLOSEOUT_CATEGORIES[number];
export type CloseoutChecklistRow = {
  category: CloseoutCategory;
  state: 'CLEAR' | 'WARNING';
  evidenceNote: string;
  evidenceReference: string;
};
export type OutstandingFollowup = {
  category: CloseoutCategory;
  description: string;
  reason: string;
  ownerUserId: string;
  dueDate: string;
  remainingAmount: string | null;
  remainingQuantity: string | null;
  quantityUom: string | null;
  notQuantifiableReason: string | null;
};
export type CloseoutPreparation = {
  checklist: CloseoutChecklistRow[];
  outstandingItems: OutstandingFollowup[];
  overallNote: string;
  revisionReason: string | null;
};
export type CloseoutAuditRow = {
  id: string;action: string;actorUserId:string;occurredAt:Date;newValues:unknown;
};

const categorySet = new Set<string>(CLOSEOUT_CATEGORIES);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,2})?$/;
const quantity = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/;
const validText=(v:unknown,min:number,max:number):v is string=>
  typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max;
const object=(v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))
    throw new RangeError('BEN04_INVALID_OBJECT');
  return v as Record<string,unknown>;
};
const dateIsValid=(s:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T00:00:00.000Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
};
function textValue(v:unknown,min:number,max:number,label:string) {
  if(!validText(v,min,max))throw new RangeError(label);
  return (v as string).trim();
}
function categoryValue(v:unknown):CloseoutCategory {
  if(typeof v!=='string'||!categorySet.has(v))
    throw new RangeError('BEN04_CATEGORY_INVALID');
  return v as CloseoutCategory;
}
export function validateCloseoutPreparation(raw:unknown,revision:boolean):CloseoutPreparation {
  const input=object(raw);
  if(!Array.isArray(input.checklist)||input.checklist.length!==6)
    throw new RangeError('BEN04_SIX_CHECKS_REQUIRED');
  const seen=new Set<string>();
  const checklist=input.checklist.map(rawRow=>{
    const row=object(rawRow),category=categoryValue(row.category);
    if(seen.has(category))throw new RangeError('BEN04_DUPLICATE_CATEGORY');
    seen.add(category);
    if(row.state!=='CLEAR'&&row.state!=='WARNING')
      throw new RangeError('BEN04_CHECK_STATE_INVALID');
    return {
      category,state:row.state,
      evidenceNote:textValue(row.evidenceNote,8,2000,'BEN04_EVIDENCE_NOTE_REQUIRED'),
      evidenceReference:textValue(row.evidenceReference,3,300,'BEN04_SOURCE_REFERENCE_REQUIRED'),
    } as CloseoutChecklistRow;
  }).sort((a,b)=>CLOSEOUT_CATEGORIES.indexOf(a.category)-CLOSEOUT_CATEGORIES.indexOf(b.category));
  if(!Array.isArray(input.outstandingItems)||input.outstandingItems.length>100)
    throw new RangeError('BEN04_OUTSTANDING_REGISTER_INVALID');
  const outstandingItems=input.outstandingItems.map(rawItem=>{
    const row=object(rawItem),category=categoryValue(row.category);
    const owner=textValue(row.ownerUserId,36,36,'BEN04_FOLLOWUP_OWNER_REQUIRED');
    if(!uuid.test(owner))throw new RangeError('BEN04_FOLLOWUP_OWNER_UUID');
    const due=textValue(row.dueDate,10,10,'BEN04_DUE_DATE_REQUIRED');
    if(!dateIsValid(due))throw new RangeError('BEN04_DUE_DATE_INVALID');
    const amount=row.remainingAmount==null||row.remainingAmount===''?null:row.remainingAmount;
    const qty=row.remainingQuantity==null||row.remainingQuantity===''?null:row.remainingQuantity;
    if(amount!==null&&(typeof amount!=='string'||!money.test(amount)))
      throw new RangeError('BEN04_AMOUNT_INVALID');
    if(qty!==null&&(typeof qty!=='string'||!quantity.test(qty)))
      throw new RangeError('BEN04_QUANTITY_INVALID');
    const uom=qty===null?null:textValue(row.quantityUom,1,30,'BEN04_QUANTITY_UOM_REQUIRED');
    if(qty===null&&row.quantityUom!=null&&row.quantityUom!=='')
      throw new RangeError('BEN04_UNLINKED_UOM');
    const nonquant=amount===null&&qty===null?
      textValue(row.notQuantifiableReason,8,500,'BEN04_UNQUANTIFIED_REASON_REQUIRED'):null;
    return {
      category,
      description:textValue(row.description,8,2000,'BEN04_FOLLOWUP_DESCRIPTION_REQUIRED'),
      reason:textValue(row.reason,8,2000,'BEN04_WARNING_REASON_REQUIRED'),
      ownerUserId:owner,dueDate:due,
      remainingAmount:amount as string|null,
      remainingQuantity:qty as string|null,
      quantityUom:uom,
      notQuantifiableReason:nonquant,
    };
  }).sort((a,b)=>a.category.localeCompare(b.category)||a.description.localeCompare(b.description)||a.ownerUserId.localeCompare(b.ownerUserId));
  for(const row of checklist){
    const count=outstandingItems.filter(x=>x.category===row.category).length;
    if(row.state==='WARNING'&&!count)throw new RangeError('BEN04_WARNING_NEEDS_FOLLOWUP');
    if(row.state==='CLEAR'&&count)throw new RangeError('BEN04_CLEAR_WITH_UNRESOLVED_ITEM');
  }
  return {
    checklist,outstandingItems,
    overallNote:textValue(input.overallNote,8,2000,'BEN04_PREPARATION_NOTE_REQUIRED'),
    revisionReason:revision?
      textValue(input.revisionReason,8,1000,'BEN04_REVISION_REASON_REQUIRED'):null,
  };
}

export function closeoutFingerprint(input:{
  projectId:string;version:number;preparedBy:string;preparation:CloseoutPreparation;
}) {
  if(!uuid.test(input.projectId)||!uuid.test(input.preparedBy)||
    !Number.isSafeInteger(input.version)||input.version<1)
    throw new RangeError('BEN04_INVALID_SOURCE_IDENTITY');
  return createHash('sha256').update(JSON.stringify({
    schemaVersion:1,projectId:input.projectId,version:input.version,
    preparedBy:input.preparedBy,preparation:input.preparation,
  })).digest('hex');
}
// UUIDs are random IDs, not causal sequence numbers. Even committed events
// can share the same DB occurred_at timestamp. Reconstruct the trusted audit
// stream from explicit preparation version and signature's preparationEventId,
// then validate the existing event hash/version/actor chain. This keeps
// prior-version signatures as history while returning only latest-version signs.
export function orderCloseoutEvents(events:readonly CloseoutAuditRow[]):CloseoutAuditRow[] {
  const ids=new Set<string>();
  for(const e of events) {
    if(!uuid.test(e.id)||ids.has(e.id)||!(e.occurredAt instanceof Date)||
      !Number.isFinite(e.occurredAt.getTime()))
      throw new RangeError('BEN04_INVALID_OR_DUPLICATE_EVENT');
    ids.add(e.id);
  }
  const preparations=events.filter(e=>e.action===PREPARE_CLOSEOUT);
  const versions=new Map<number,CloseoutAuditRow>();
  for(const e of preparations) {
    const v=object(e.newValues);
    if(!Number.isSafeInteger(v.version)||Number(v.version)<1||
      versions.has(Number(v.version)))
      throw new RangeError('BEN04_DUPLICATE_OR_INVALID_VERSION');
    versions.set(v.version as number,e);
  }
  const sorted=[...versions.entries()].sort((a,b)=>a[0]-b[0]).map(pair=>pair[1]);
  const ordered:CloseoutAuditRow[]=[];
  const signedIds=new Set<string>();
  for(const [i,p] of sorted.entries()) {
    if(i>0&&p.occurredAt<sorted[i-1]!.occurredAt)
      throw new RangeError('BEN04_REVERSED_PREPARATION_TIME');
    ordered.push(p);
    const successor=sorted[i+1];
    const signatures=events.filter(e=>
      (e.action===BEN_CLOSEOUT_SIGN||e.action===NANCY_CLOSEOUT_SIGN) &&
      object(e.newValues).preparationEventId===p.id);
    for(const e of signatures) {
      if(e.occurredAt<p.occurredAt||
        (successor&&e.occurredAt>successor.occurredAt))
        throw new RangeError('BEN04_INVALID_SIGNATURE_TIME');
    }
    // Independent role signatures can share a timestamp. Their relative
    // order cannot determine validity; the reducer checks dual separation.
    signatures.sort((a,b)=>a.action.localeCompare(b.action));
    ordered.push(...signatures);
    for(const e of signatures)signedIds.add(e.id);
  }
  // Orphans and unexpected source actions must still reach the strict parser,
  // not disappear during reconstruction.
  ordered.push(...events.filter(e=>e.action!==PREPARE_CLOSEOUT&&!signedIds.has(e.id)));
  if(ordered.length!==events.length)
    throw new RangeError('BEN04_UNRECONCILED_EVENT_COUNT');
  return ordered;
}

export function parseCloseoutEvents(
  events:readonly CloseoutAuditRow[],projectId:string
) {
  let prepared:null|{
    eventId:string;fingerprint:string;version:number;preparedBy:string;
    preparedAt:string;preparation:CloseoutPreparation;
    signatures:Partial<Record<'BEN'|'NANCY',{userId:string;at:string;note:string;eventId:string}>>;
  }=null;
  for(const e of orderCloseoutEvents(events)){
    const v=object(e.newValues);
    if(!uuid.test(e.id)||!uuid.test(e.actorUserId)||!Number.isFinite(e.occurredAt.getTime()))
      throw new RangeError('BEN04_INVALID_AUDIT_IDENTITY');
    if(e.action===PREPARE_CLOSEOUT){
      const version: number=(prepared?.version??0)+1;
      const prep=validateCloseoutPreparation(v.preparation,version>1);
      if(v.projectId!==projectId||v.version!==version||v.preparedBy!==e.actorUserId||
        (version>1&&v.previousEventId!==prepared?.eventId))
        throw new RangeError('BEN04_INVALID_PREPARATION_CHAIN');
      const digest=closeoutFingerprint({projectId,version,preparedBy:e.actorUserId,preparation:prep});
      if(v.fingerprint!==digest)throw new RangeError('BEN04_SOURCE_FINGERPRINT_MISMATCH');
      prepared={eventId:e.id,fingerprint:digest,version,preparedBy:e.actorUserId,
        preparedAt:e.occurredAt.toISOString(),preparation:prep,signatures:{}};
    } else if(e.action===BEN_CLOSEOUT_SIGN||e.action===NANCY_CLOSEOUT_SIGN){
      if(!prepared||v.projectId!==projectId||v.fingerprint!==prepared.fingerprint||
        v.preparationEventId!==prepared.eventId||v.preparedBy!==prepared.preparedBy||
        e.actorUserId===prepared.preparedBy)
        throw new RangeError('BEN04_STALE_OR_SELF_SIGNATURE');
      const role=e.action===BEN_CLOSEOUT_SIGN?'BEN':'NANCY';
      if(prepared.signatures[role]||Object.values(prepared.signatures).some(x=>x?.userId===e.actorUserId))
        throw new RangeError('BEN04_DUPLICATE_OR_SELF_APPROVAL');
      const note=typeof v.note==='string'?v.note:'';
      prepared.signatures[role]={userId:e.actorUserId,at:e.occurredAt.toISOString(),
        note,eventId:e.id};
    }else {
      throw new RangeError('BEN04_UNRECOGNIZED_EVENT');
    }
  }
  if(!prepared)return {status:'NOT_PREPARED' as const,current:null};
  const ben=Boolean(prepared.signatures.BEN),nancy=Boolean(prepared.signatures.NANCY);
  const status=ben&&nancy?'JOINTLY_APPROVED' as const:
    ben?'BEN_SIGNED' as const:nancy?'NANCY_SIGNED' as const:'PREPARED' as const;
  return {status,current:prepared};
}
