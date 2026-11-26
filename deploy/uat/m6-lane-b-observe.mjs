// Isolated M6 lane evidence discovery. Aggregate counts only; not business acceptance.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export const queries=Object.freeze({"poLinkedDeliveries":"SELECT count(*) AS n FROM public.receiving_deliveries WHERE purchase_order_id IS NOT NULL","receivingEvidenceBindingDifferences":"SELECT count(*) AS n FROM public.receiving_delivery_evidence e LEFT JOIN public.receiving_deliveries r ON r.id=e.delivery_id AND r.company_id=e.company_id LEFT JOIN public.documents d ON d.id=e.document_id AND d.company_id=e.company_id WHERE r.id IS NULL OR d.id IS NULL OR e.checksum IS DISTINCT FROM public.d.checksum","transferReceiptBindingDifferences":"SELECT count(*) AS n FROM public.transfer_receipts r LEFT JOIN public.stock_transfers t ON t.id=r.transfer_id LEFT JOIN public.documents d ON d.id=r.document_id AND d.company_id=t.company_id WHERE t.id IS NULL OR (r.document_id IS NOT NULL AND (d.id IS NULL OR r.checksum IS DISTINCT FROM public.d.checksum))","correctionLinkedPrLines":"SELECT count(*) AS n FROM public.purchase_request_lines WHERE correction_source_line_id IS NOT NULL"});
export async function observeLane(db){
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db==='proto_a_01'&&id[0].role==='proto_runtime'&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_LANE_DB_IDENTITY_INVALID');
    await requireNoLiveSessions(tx);
    const observations={};
    for(const [key,sql] of Object.entries(queries)){
      const rows=await tx.$queryRawUnsafe(sql);
      need(Array.isArray(rows)&&rows.length===1&&typeof rows[0]?.n==='bigint'&&rows[0].n>=0n,'M6_LANE_COUNT_INVALID');
      observations[key]=rows[0].n.toString();
    }
    return {lane:'B',observations,workflowVerified:false,mayMutate:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
