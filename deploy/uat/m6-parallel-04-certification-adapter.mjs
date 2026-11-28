// Disposable successor only. No login, logout, grant or business mutation.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {verifyM604CertificationScope} from './m6-parallel-04-certification-scope.mjs';
const roles=['finance','certificationOnly','unassigned','foreign'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId=x=>typeof x==='string'&&uuid.test(x);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_04_ADAPTER_'+code),{safeCode:'M6_04_ADAPTER_'+code});};
const money=x=>{const s=x?.toFixed?.(2);need(typeof s==='string'&&/^\d+\.\d{2}$/.test(s),'MONEY');return s;};
export async function bindM604Certification(db,{companyId,projectId,claimId,certificationId,actorIds}){
  need([companyId,projectId,claimId,certificationId,...roles.map(k=>actorIds?.[k])].every(validId)&&new Set(roles.map(k=>actorIds[k])).size===4,'INPUT');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const identity=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    const i=identity[0];need(identity.length===1&&i.db==='m6_successor_rehearsal'&&i.role==='proto_runtime'&&i.ro==='on'&&i.isolation==='repeatable read','DB');
    await requireNoLiveSessions(tx);
    const cert=await tx.subcontractCertification.findUnique({where:{id:certificationId},include:{agreement:true,claim:true,assessment:true}});
    need(cert?.companyId===companyId&&cert.projectId===projectId&&cert.claimId===claimId&&cert.state==='APPROVED'&&cert.claim?.id===claimId&&cert.assessment?.id===cert.assessmentId&&cert.assessment.claimId===claimId&&cert.agreement?.id===cert.agreementId&&[cert.claim,cert.assessment,cert.agreement].every(r=>r.companyId===companyId&&r.projectId===projectId)&&cert.claim.agreementId===cert.agreementId&&cert.assessment.agreementId===cert.agreementId,'SOURCE');
    const actors={};
    for(const key of roles){
      const u=await tx.user.findUnique({where:{id:actorIds[key]},include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
      need(u?.id===actorIds[key]&&u.isActive&&u.company?.isActive&&u.employee?.isActive&&u.employee.companyId===u.companyId&&u.employee.id===u.employeeId&&(key==='foreign'?u.companyId!==companyId:u.companyId===companyId),'ACTOR');
      const permissions=new Set(u.userRoles.filter(x=>x.companyId===u.companyId&&x.role.isActive&&x.role.companyId===u.companyId).flatMap(x=>x.role.rolePermissions.map(p=>p.permission.permissionCode)));
      need(permissions.has('subcontracts.certification.view')&&permissions.has('finance.payment.view')===(key!=='certificationOnly'),'CAPABILITY');
      const assigned=await tx.projectMember.count({where:{projectId,employeeId:u.employeeId,isActive:true}});
      need(key==='unassigned'||key==='foreign'?assigned===0&&!permissions.has('projects.access_all'):assigned>0,'ASSIGNMENT');
      actors[key]={userId:u.id,companyId:u.companyId};
    }
    const rows=await tx.subcontractPaymentAllocation.findMany({where:{subcontractCertificationId:cert.id},include:{payment:true}});
    const allocations=rows.map(a=>{
      const p=a.payment;
      need(validId(a.id)&&validId(p?.id)&&a.paymentId===p.id&&p.companyId===companyId&&p.projectId===projectId&&p.subcontractorId===cert.agreement.subcontractorId&&p.currencyCode===cert.currencyCode&&p.paymentDirection==='OUTBOUND','PAYMENT_SCOPE');
      return {id:a.id,paymentId:p.id,paymentState:p.state,allocatedAmount:money(a.allocatedAmount),paymentAmount:money(p.amount)};
    });
    return {actors,expected:{companyId,projectId,certificationId,certificationNumber:cert.certificationNumber,currencyCode:cert.currencyCode,state:cert.state,allocations}};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
// The coordinator owns session issuance, revocation and custody. Only the exact
// GET routes/statuses required by the assertion kernel may be accessed here.
export async function runM604CertificationReadback(binding,{origin,cookies,fetchImpl=fetch}){
  let url;try{url=new URL(origin);}catch{need(false,'ORIGIN');}
  need(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port&&url.origin===origin&&Number(url.port)>=1024,'ORIGIN');
  need(roles.every(k=>typeof cookies?.[k]==='string'&&/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(cookies[k]))&&new Set(roles.map(k=>cookies[k])).size===4,'COOKIES');
  const id=binding.expected?.certificationId;need(validId(id),'SOURCE');
  const path='/subcontracts/certifications/'+id,ref=path+'/finance-reference';
  const allowed={finance:new Map([['/auth/me',200],[ref,200]]),certificationOnly:new Map([['/auth/me',200],[path,200],[ref,403]]),unassigned:new Map([['/auth/me',200],[path,403],[ref,403]]),foreign:new Map([['/auth/me',200],[path,404],[ref,404]])};
  const get=async(key,p)=>{
    need(allowed[key]?.has(p),'PATH');
    let response;try{response=await fetchImpl(origin+'/api/v1'+p,{method:'GET',headers:{Accept:'application/json',Cookie:cookies[key]},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});}catch{need(false,'TRANSPORT');}
    const status=response.status;
    if(status!==200||allowed[key].get(p)!==200){await response.body?.cancel();return {status};}
    need(response.headers.get('content-type')?.toLowerCase().includes('application/json'),'CONTENT_TYPE');
    const reader=response.body?.getReader();need(reader,'BODY');
    const chunks=[];let size=0;
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;need(size<=1048576,'LIMIT');chunks.push(value);}
      const bytes=Buffer.concat(chunks.map(c=>Buffer.from(c.buffer,c.byteOffset,c.byteLength)));
      try{const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));return {status,data:envelope?.data};}
      catch{need(false,'JSON');}finally{bytes.fill(0);}
    }finally{for(const c of chunks)c.fill(0);await reader.cancel().catch(()=>{});}
  };
  const result=await verifyM604CertificationScope({...binding,get});
  return {...result,transport:'PINNED_LOOPBACK_GET_ONLY',sessionRevocationVerified:false};
}
