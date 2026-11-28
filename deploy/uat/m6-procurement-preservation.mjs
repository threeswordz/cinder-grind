// Read-only successor proof for completed procurement/stock journeys.
const additions={suppliers:['short_name'],purchase_request_lines:['review_decision','review_reason','reviewed_by_user_id','reviewed_at','correction_source_line_id'],purchase_orders:['delivery_location','delivery_contact','delivery_terms','payment_terms','credit_terms','discount_amount','freight_amount','additional_charge_amount','vat_rate_percent','supplier_quote_exception_reason','po_display_number','supplier_short_name_snapshot']};
const required=['suppliers','purchase_orders','purchase_order_lines','goods_receipts','goods_receipt_items','stock_transactions','stock_transfers','stock_transfer_items','receiving_deliveries','receiving_delivery_evidence','transfer_receipts'];
export const procurementTables=Object.freeze([...required,'purchase_requests','purchase_request_lines','rfqs','rfq_lines','rfq_suppliers','supplier_quotations','supplier_quotation_lines','quotation_awards','warehouses','stock_counts','material_reservations','receiving_project_policies','receiving_delivery_lines','receiving_delivery_events','receiving_operations','transfer_project_policies','transfer_custodies','transfer_dispatches','transfer_receiver_assignments','transfer_receipt_lines','transfer_custody_events','transfer_operations','material_uom_bases','material_uom_revisions','material_uom_operations','material_uom_effect_pins','material_uom_receipt_source_pins','material_uom_reservation_pins','material_uom_transfer_source_pins','material_uom_activations']);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
// Split only top-level JSON members, retaining exact decimal and nested value bytes.
function fields(raw){
  need(typeof raw==='string','M6_PI_EXACT_SQL_REQUIRED');
  let value;try{value=JSON.parse(raw);}catch{need(false,'M6_PI_SQL_INVALID');}
  need(value&&typeof value==='object'&&!Array.isArray(value),'M6_PI_SQL_INVALID');
  const s=raw.trim(),out=new Map();let start=1,depth=0,quoted=false,escaped=false;
  const add=end=>{const part=s.slice(start,end).trim();if(!part)return;const m=part.match(/^("(?:[^"\\]|\\.)*")\s*:\s*([\s\S]+)$/);need(m,'M6_PI_SQL_INVALID');const key=JSON.parse(m[1]);need(!out.has(key),'M6_PI_SQL_INVALID');out.set(key,m[2].trim());};
  for(let i=1;i<s.length-1;i++){const c=s[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;else if(c===','&&depth===0){add(i);start=i+1;}}
  add(s.length-1);return {value,fields:out};
}
function rows(snapshot,table){need(Array.isArray(snapshot?.[table]),'M6_PI_TABLE_MISSING');return snapshot[table].map(r=>fields(r?.__fm03_exact_row_json));}
function normalize(row,columns,successor){const m=new Map(row.fields);for(const key of columns){need(successor?m.get(key)==='null':!m.has(key),'M6_PI_UNEXPECTED_HISTORIC_BACKFILL');m.delete(key);}return JSON.stringify([...m].sort(([a],[b])=>a<b?-1:a>b?1:0));}
function compare(old,next,columns=[]){need(JSON.stringify(old.map(r=>normalize(r,columns,false)).sort())===JSON.stringify(next.map(r=>normalize(r,columns,true)).sort()),'M6_PI_HISTORICAL_DRIFT');}
function inventory(entries){need(Array.isArray(entries),'M6_PI_INVENTORY_INVALID');const m=new Map();for(const e of entries){need(Array.isArray(e)&&typeof e[0]==='string'&&!m.has(e[0]),'M6_PI_INVENTORY_INVALID');m.set(e[0],e);}return m;}
export function verifyM6Procurement(before,after,filesBefore,filesAfter){
  for(const table of procurementTables){const old=rows(before,table);if(required.includes(table))need(old.length>0,'M6_PI_COMPLETED_PREDECESSOR_REQUIRED');compare(old,rows(after,table),additions[table]??[]);}
  const oldLinks=rows(before,'document_links'),newLinks=rows(after,'document_links');
  const targets=new Set([...rows(before,'receiving_deliveries').map(r=>'RECEIVING_DELIVERY:'+r.value.id),...rows(before,'transfer_receipts').map(r=>'TRANSFER_RECEIPT:'+r.value.id)]);
  const evidence=[...rows(before,'receiving_delivery_evidence').map(r=>({target:'RECEIVING_DELIVERY:'+r.value.delivery_id,id:r.value.document_id,checksum:r.value.checksum})),...rows(before,'transfer_receipts').filter(r=>r.value.document_id).map(r=>({target:'TRANSFER_RECEIPT:'+r.value.id,id:r.value.document_id,checksum:r.value.checksum}))];
  need(evidence.some(e=>e.target.startsWith('RECEIVING_DELIVERY:'))&&evidence.some(e=>e.target.startsWith('TRANSFER_RECEIPT:')),'M6_PI_EVIDENCE_REQUIRED');
  const target=r=>r.value.entity_type+':'+r.value.entity_id;
  for(const e of evidence)need(targets.has(e.target)&&typeof e.id==='string'&&oldLinks.some(r=>target(r)===e.target&&r.value.document_id===e.id),'M6_PI_EVIDENCE_LINK_MISSING');
  const ids=new Set(oldLinks.filter(r=>targets.has(target(r))).map(r=>r.value.document_id));
  const related=r=>ids.has(r.value.document_id)||targets.has(target(r));
  compare(oldLinks.filter(related),newLinks.filter(related));
  const docs=rows(before,'documents').filter(r=>ids.has(r.value.id));
  need(docs.length===ids.size&&new Set(docs.map(r=>r.value.id)).size===ids.size,'M6_PI_EVIDENCE_METADATA_MISSING');
  compare(docs,rows(after,'documents').filter(r=>ids.has(r.value.id)));
  const previous=inventory(filesBefore),current=inventory(filesAfter);
  for(const {value:d} of docs){const a=previous.get(d.storage_key),b=current.get(d.storage_key);need(typeof d.storage_key==='string'&&Number.isSafeInteger(d.file_size_bytes)&&d.file_size_bytes>=0&&/^[a-f0-9]{64}$/.test(d.checksum??'')&&a?.[1]===d.file_size_bytes&&a[2]===d.checksum&&JSON.stringify(a)===JSON.stringify(b)&&evidence.filter(e=>e.id===d.id).every(e=>e.checksum===d.checksum),'M6_PI_EVIDENCE_BYTES_DRIFT');}
  return {historicalProcurementStockPreserved:true,receivingTransferEvidencePreserved:true};
}
