// Pure evidence contract shared by the reviewed entry and read-only browser probe.
import {createHash} from 'node:crypto';
const APP='70013b5139292ef33563447f8937c8f132feabd2',DISCOVERY='840477f8c18665953ed3285635adc81f5091fadb';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_CONTRACT_'+c),{safeCode:'M6_RESIDUAL_CONTRACT_'+c});};
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x),uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x),digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function syntheticResidualPdf(label){
 need(typeof label==='string'&&/^[A-Z0-9 -]{1,100}$/.test(label),'PDF_LABEL');
 const stream='BT /F1 12 Tf 50 750 Td (SYNTHETIC TEST EVIDENCE ONLY) Tj 0 -24 Td ('+label+') Tj ET\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'endstream'];
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}const xref=Buffer.byteLength(pdf);pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(pdf,'ascii');
}
export function bindResidualExecutionPlan({ctx,sourcePlans,receiptArtifact,journeyKeys,revisedDate}){
 const {candidate,operatorSha,rolePlan,initial}=ctx;
 need(candidate?.sha===APP&&candidate.tree==='8152b5ac627325c91c36ed65875791966a1a8874'&&sha(operatorSha)&&rolePlan?.applicationSha===APP&&rolePlan.discoverySha===DISCOVERY&&rolePlan.database==='m6_successor_rehearsal'&&initial?.user_sessions?.length===129&&sourcePlans?.baselineSha256===digest(initial)&&sourcePlans.expectedActors?.length===5&&sourcePlans.expectedActors.every(uuid)&&new Set(sourcePlans.expectedActors).size===5&&sourcePlans.productionAuthorized===false&&sourcePlans.syntheticOnly===true,'PLAN');
 need(hex(receiptArtifact?.sha256)&&Number.isSafeInteger(receiptArtifact.size)&&receiptArtifact.size>0&&receiptArtifact.size<=1048576&&journeyKeys&&Object.keys(journeyKeys).sort().join(',')==='createKey,linkKey,postKey,receiptKey'&&Object.values(journeyKeys).every(uuid)&&new Set(Object.values(journeyKeys)).size===4&&/^\d{4}-\d{2}-\d{2}$/.test(revisedDate)&&Number.isFinite(Date.parse(revisedDate))&&new Date(revisedDate).toISOString().slice(0,10)===revisedDate,'INPUT');
 const plan={applicationSha:APP,applicationTree:candidate.tree,operatorSha,discoverySha:DISCOVERY,database:'m6_successor_rehearsal',rolePlanSha256:digest(rolePlan),baselineSha256:digest(initial),sourcesSha256:digest(sourcePlans),receiptArtifact:structuredClone(receiptArtifact),journeyKeys:structuredClone(journeyKeys),revisedDate,actorIds:[...sourcePlans.expectedActors],syntheticOnly:true,retainedMutationAuthorized:false,productionAuthorized:false,automaticRetryAllowed:false};
 return {plan,planSha256:digest(plan),baselineSha256:plan.baselineSha256};
}
export function verifyResidualBrowserText(kind,text,ref){
 const s=String(text??'').replace(/\s+/g,' ');
 if(kind==='SS08')return /Requester:.*Version 3\b/.test(s)&&s.includes('Issued in full')&&s.includes('Synthetic signed receipt only')&&s.includes('Receipt recorded')&&s.includes('Issue linked')&&s.includes('Download evidence')&&s.includes('Open issue record');
 if(kind==='FM02')return s.includes('CALCULATED_TECHNICAL_ONLY')&&s.includes('Current weighted progress: 40.00%')&&s.includes('60.00% weight · 50.00%')&&s.includes('40.00% weight · 25.00%')&&s.includes('Version 1 · Ben-confirmed (configured role)')&&s.includes('M6-RESIDUAL-266-Q')&&s.includes('M6-RESIDUAL-266-M');
 if(kind==='SUPPLIER')return uuid(ref?.handoverDocumentId)&&/^\d+(?:\.\d{1,4})?$/.test(ref.returnQuantity??'')&&s.includes('Case stage: RETURN_DISPATCH_RECORDED · Version 7 · Latest approved source: YES')&&s.includes('Discrepancy: DAMAGED · PM decision: REQUEST_RETURN')&&s.includes('Supplier signed-handover attested by operator: '+ref.returnQuantity+' held damaged units')&&s.includes('Document '+ref.handoverDocumentId)&&s.includes('no stock deduction or AP credit');
 return false;
}
