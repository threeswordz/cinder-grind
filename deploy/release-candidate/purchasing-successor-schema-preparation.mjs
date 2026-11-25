// Exact successor preparation only: no PUR12 or PUR07 global admission.
import {normalizeSchema} from './pm02-schema-preparation.mjs';
export const pur12Migration='20261123190000_pur12_po_partner_short_names';
export const pur12MigrationBlob='2342d5f965adaefa97fc72c3ee862c92c696f041';
export const pur07Migration='20261123201500_pur07_po_manual_dispatch_events';
export const pur07MigrationBlob='82faa9d33f3573c6a332dec4b20047bfb5b42502';
export const pur12Columns=Object.freeze({customers:['short_name'],suppliers:['short_name'],purchase_orders:['po_display_number','supplier_short_name_snapshot']});
const identity={
 Customer:['shortName String? @map("short_name") @db.VarChar(100)'],
 Supplier:['shortName String? @map("short_name") @db.VarChar(100)'],
 PurchaseOrder:['displayNumber String? @map("po_display_number") @db.VarChar(240)','supplierShortNameSnapshot String? @map("supplier_short_name_snapshot") @db.VarChar(100)']
};
const dispatch={
 Company:['poDispatchEvents PoDispatchEvent[]'],
 User:['poDispatchEvents PoDispatchEvent[] @relation("PoDispatchActor")'],
 Project:['poDispatchEvents PoDispatchEvent[]'],
 Document:['poDispatchEvidence PoDispatchEvent[] @relation("PoDispatchEvidence")'],
 PurchaseOrder:['poDispatchEvents PoDispatchEvent[]']
};
const dispatchModel="model PoDispatchEvent {\n  id                    String   @id @default(uuid()) @db.Uuid\n  companyId             String   @map(\"company_id\") @db.Uuid\n  projectId             String   @map(\"project_id\") @db.Uuid\n  purchaseOrderId       String   @map(\"purchase_order_id\") @db.Uuid\n  kind                  String   @db.VarChar(30)\n  channel               String   @db.VarChar(20)\n  recipient             String   @db.VarChar(320)\n  evidenceReference     String   @map(\"evidence_reference\") @db.VarChar(1200)\n  evidenceDocumentId    String?  @map(\"evidence_document_id\") @db.Uuid\n  pdfFileName           String?  @map(\"pdf_file_name\") @db.VarChar(255)\n  pdfSha256             String?  @map(\"pdf_sha256\") @db.VarChar(64)\n  acknowledgesEventId   String?  @map(\"acknowledges_event_id\") @db.Uuid\n  recordedByUserId      String   @map(\"recorded_by_user_id\") @db.Uuid\n  recordedAt            DateTime @default(now()) @map(\"recorded_at\") @db.Timestamptz(6)\n\n  company          Company          @relation(fields: [companyId], references: [id], onDelete: Restrict)\n  project          Project          @relation(fields: [projectId], references: [id], onDelete: Restrict)\n  purchaseOrder    PurchaseOrder    @relation(fields: [purchaseOrderId], references: [id], onDelete: Restrict)\n  evidenceDocument Document?        @relation(\"PoDispatchEvidence\", fields: [evidenceDocumentId], references: [id], onDelete: Restrict)\n  actor            User             @relation(\"PoDispatchActor\", fields: [recordedByUserId], references: [id], onDelete: Restrict)\n  acknowledges     PoDispatchEvent? @relation(\"PoDispatchAck\", fields: [acknowledgesEventId], references: [id], onDelete: Restrict)\n  acknowledgmentEvents PoDispatchEvent[] @relation(\"PoDispatchAck\")\n\n  @@index([companyId, projectId, purchaseOrderId, recordedAt])\n  @@index([companyId, acknowledgesEventId])\n  @@index([evidenceDocumentId])\n  @@map(\"po_dispatch_events\")\n}";
function stripExactFields(schema,fields){
 let text=schema,removed=0;
 const total=Object.values(fields).reduce((n,a)=>n+a.length,0);
 for(const [name,expected] of Object.entries(fields)){
  let models=0;const seen=new Set();
  text=text.replace(new RegExp('^model '+name+' \\{[\\s\\S]*?^\\}','gm'),block=>{
   models++;
   return block.split('\n').filter(line=>{
    const key=normalizeSchema(line);
    if(!expected.includes(key))return true;
    if(seen.has(key))throw Error('Duplicate exact field in '+name);
    seen.add(key);removed++;return false;
   }).join('\n');
  });
  if(models!==1)throw Error('Expected one '+name+' model');
 }
 if(removed!==0&&removed!==total)throw Error('Partial exact purchasing successor fields');
 return {text,present:removed===total};
}
export function stripPur12Schema(schema){return stripExactFields(schema,identity);}
export function stripPur07Schema(schema){
 const fields=stripExactFields(schema,dispatch);
 let count=0;
 const text=fields.text.replace(/^model PoDispatchEvent \{[\s\S]*?^\}/gm,block=>{
  count++;
  if(normalizeSchema(block)!==normalizeSchema(dispatchModel))throw Error('Modified PoDispatchEvent model');
  return '';
 });
 if(count>1||fields.present!==(count===1))throw Error('Incomplete PUR07 dispatch model/relations');
 return {text,present:count===1};
}
function assertIncrement(previous,candidate,strip){
 const a=strip(previous),b=strip(candidate);
 if(a.present||!b.present||normalizeSchema(a.text)!==normalizeSchema(b.text))throw Error('Not an exact forward-only purchasing successor increment');
 return true;
}
export const assertExactPur12Increment=(a,b)=>assertIncrement(a,b,stripPur12Schema);
export const assertExactPur07Increment=(a,b)=>assertIncrement(a,b,stripPur07Schema);

export function stripSuccessorSchema(schema){
 const seven=stripPur07Schema(schema),twelve=stripPur12Schema(seven.text);
 if(seven.present&&!twelve.present)throw Error('PUR07 requires PUR12 identity schema');
 return {text:twelve.text,pur07:seven.present,pur12:twelve.present};
}
export function successorFlags(env=process.env){
 return {pur12:env.PUR12_SCHEMA_UPGRADE==='YES',pur07:env.PUR07_SCHEMA_UPGRADE==='YES'};
}
export function classifySuccessorPreparation(previous,candidate,classifyPrior){
 const a=stripSuccessorSchema(previous),b=stripSuccessorSchema(candidate);
 if(a.pur12&&!b.pur12||a.pur07&&!b.pur07)throw Error('Successor schema removal prohibited');
 const base=normalizeSchema(a.text)===normalizeSchema(b.text)?'migration-aware-sql-only':classifyPrior(a.text,b.text);
 const wrap=(mode,layer)=>mode==='migration-aware-sql-only'?'migration-aware-'+layer+'-schema':'migration-aware-'+layer+'-'+mode.slice('migration-aware-'.length);
 const twelve=!a.pur12&&b.pur12?wrap(base,'pur12'):base;
 return !a.pur07&&b.pur07?wrap(twelve,'pur07'):twelve;
}
