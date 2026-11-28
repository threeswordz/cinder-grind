// Read-only evidence capture for append-only residual phases. No CLI, grants or writes.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_NATIVE_EVIDENCE_'+c),{safeCode:'M6_NATIVE_EVIDENCE_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sort=x=>[...x].sort(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const tables=['documents','document_links','audit_logs','po_dispatch_events','project_progress_plans','project_progress_plan_lines','activity_progress'];
const validIds=(xs,max)=>Array.isArray(xs)&&xs.length<=max&&xs.every(uuid)&&new Set(xs).size===xs.length;
function census(x){const keys=sort(Object.keys(x??{}));need(keys.length===174&&tables.every(t=>keys.includes(t))&&keys.includes('user_sessions')&&keys.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)&&Array.isArray(x[t])&&x[t].length<=10000&&x[t].every(hex)),'CENSUS');return keys;}
function exactRows(rows,ids){need(Array.isArray(rows)&&rows.length===ids.length&&same(sort(rows.map(r=>r.id)),sort(ids)),'ROW_IDS');return rows;}
export async function captureResidualNativeEvidence({db,captureFixtureRows,verifyRuntime,companyId,projectId,selection}){
 const s=structuredClone(selection),docIds=s?.documents?.map(d=>d.id),auditIds=s?.auditIds??[],targets=s?.auditTargets??[],dispatchIds=s?.dispatchIds??[],progressIds=s?.progressIds??[];
 need(uuid(companyId)&&uuid(projectId)&&companyId!==projectId&&typeof captureFixtureRows==='function'&&typeof verifyRuntime==='function'&&validIds(docIds,8)&&validIds(auditIds,16)&&validIds(dispatchIds,2)&&validIds(progressIds,2)&&Array.isArray(targets)&&targets.length<=32&&targets.every(t=>uuid(t.entityId)&&uuid(t.actorUserId)&&/^[A-Z_]{1,50}$/.test(t.entityType)&&/^[A-Z_]{1,50}$/.test(t.action))&&(!s.planId||uuid(s.planId))&&(!dispatchIds.length||uuid(s.orderId)),'INPUT');
 need(s.documents.every(d=>d.projectId===projectId&&uuid(d.entityId)&&uuid(d.actorUserId)&&hex(d.sha256)&&Number.isSafeInteger(d.size)&&d.size>0&&d.size<=1048576&&['MATERIAL_REQUEST','PURCHASE_ORDER','RECEIVING_DELIVERY'].includes(d.entityType)),'DOCUMENT_SPEC');
 await verifyRuntime();
 const result=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const ident=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(ident.length===1&&ident[0].db==='m6_successor_rehearsal'&&ident[0].role==='proto_runtime'&&ident[0].ro==='on'&&ident[0].isolation==='repeatable read','DATABASE');
  const snapshot=await captureFixtureRows(tx);census(snapshot);const addedRows=Object.fromEntries(tables.map(t=>[t,[]]));
  async function bind(table,rows){need(tables.includes(table)&&validIds(rows.map(r=>r.id),64),'HASH_IDS');for(const row of rows){const a=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+table+'" t WHERE id=$1::uuid',row.id);need(a.length===1&&hex(a[0].hash)&&snapshot[table].includes(a[0].hash),'ROW_HASH');addedRows[table].push({id:row.id,hash:a[0].hash});}return rows.map(r=>({...r,hash:addedRows[table].find(x=>x.id===r.id).hash}));}
  const documents=docIds.length?exactRows(await tx.document.findMany({where:{id:{in:docIds}},include:{links:true}}),docIds):[];
  for(const d of documents){const e=s.documents.find(x=>x.id===d.id);need(d.companyId===companyId&&d.isActive===true&&d.storageProvider==='LOCAL'&&uuid(d.storageKey)&&d.uploadedByUserId===e.actorUserId&&d.checksum===e.sha256&&d.fileSizeBytes===e.size&&Array.isArray(d.links)&&d.links.length===2&&d.links.every(l=>l.documentId===d.id&&l.linkedByUserId===e.actorUserId)&&d.links.some(l=>l.entityType==='PROJECT'&&l.entityId===projectId)&&d.links.some(l=>l.entityType===e.entityType&&l.entityId===e.entityId),'DOCUMENT');}
  await bind('documents',documents);await bind('document_links',documents.flatMap(d=>d.links));
  const audits=auditIds.length?exactRows(await tx.auditLog.findMany({where:{id:{in:auditIds}}}),auditIds):[];
  const auditTargets=[...targets,...(s.documentAudits===true?documents.flatMap(d=>[{entityType:'DOCUMENT',entityId:d.id,action:'CREATE',actorUserId:d.uploadedByUserId},...d.links.map(l=>({entityType:'DOCUMENT_LINK',entityId:l.id,action:'CREATE',actorUserId:d.uploadedByUserId}))]):[])];need(auditTargets.length<=32,'AUDIT_TARGET_LIMIT');
  for(const t of auditTargets){const found=await tx.auditLog.findMany({where:{companyId,entityType:t.entityType,entityId:t.entityId,action:t.action,actorUserId:t.actorUserId},take:2});need(found.length===1&&found[0].entityType===t.entityType&&found[0].entityId===t.entityId&&found[0].action===t.action&&found[0].actorUserId===t.actorUserId,'AUDIT_TARGET');audits.push(found[0]);}
  need(audits.every(a=>a.companyId===companyId)&&validIds(audits.map(a=>a.id),48),'AUDIT_SCOPE');const auditRows=await bind('audit_logs',audits);
  const dispatch=dispatchIds.length?exactRows(await tx.poDispatchEvent.findMany({where:{id:{in:dispatchIds}}}),dispatchIds):[];need(dispatch.every(r=>r.companyId===companyId&&r.projectId===projectId&&r.purchaseOrderId===s.orderId),'DISPATCH_SCOPE');await bind('po_dispatch_events',dispatch);
  const plans=s.planId?exactRows(await tx.projectProgressPlan.findMany({where:{id:s.planId},include:{lines:true}}),[s.planId]):[];need(plans.every(p=>p.companyId===companyId&&p.projectId===projectId&&Array.isArray(p.lines)&&p.lines.length===2&&p.lines.every(l=>l.planId===p.id)),'PLAN_SCOPE');await bind('project_progress_plans',plans);await bind('project_progress_plan_lines',plans.flatMap(p=>p.lines));
  const progress=progressIds.length?exactRows(await tx.activityProgress.findMany({where:{id:{in:progressIds}}}),progressIds):[];need(progress.every(r=>r.companyId===companyId&&r.projectId===projectId),'PROGRESS_SCOPE');await bind('activity_progress',progress);
  need(same(snapshot,await captureFixtureRows(tx)),'SNAPSHOT_DRIFT');return {snapshot,addedRows,documents,auditRows,dispatch,plans,progress};
 },{isolationLevel:'RepeatableRead',timeout:120000});await verifyRuntime();return result;
}
// Only append-only phases. Caller must separately verify semantic journey facts.
// The old census is immutable, all observed new rows must be specifically bound.
export function verifyResidualNativeAppendDelta({before,evidence,expected}){
 const keys=census(before),after=evidence?.snapshot;need(same(keys,census(after))&&expected&&Object.keys(expected).every(t=>tables.includes(t)&&Number.isSafeInteger(expected[t])&&expected[t]>=0&&expected[t]<=64)&&evidence.addedRows&&same(sort(Object.keys(evidence.addedRows)),sort(tables)),'EXPECTED');
 for(const t of keys){const rows=evidence.addedRows[t]??[],old=before[t],next=after[t];need(Array.isArray(rows)&&rows.length===(expected[t]??0)&&validIds(rows.map(r=>r.id),64)&&rows.every(r=>hex(r.hash)&&!old.includes(r.hash))&&new Set(rows.map(r=>r.hash)).size===rows.length,'ADDITIONS');need(same(sort([...old,...rows.map(r=>r.hash)]),sort(next)),'UNEXPECTED_DELTA');}
 return true;
}
