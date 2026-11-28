// Successor GET-only assertion kernel. Caller supplies existing authenticated
// disposable sessions, pinned transport and independently captured expectations.
const need = (ok, code) => { if (!ok) throw Object.assign(new Error('M6_04_SCOPE_'+code), {safeCode:'M6_04_SCOPE_'+code}); };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = x => typeof x === 'string' && uuid.test(x);
const cents = x => {
  need(typeof x === 'string' && /^\d+(\.\d{1,2})?$/.test(x),'MONEY');
  const [whole, fraction=''] = x.split('.'); return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
};
const certView='subcontracts.certification.view', payView='finance.payment.view';
const has=(me, ...codes)=>Array.isArray(me.permissions)&&codes.every(c=>me.permissions.includes(c));
export async function verifyM604CertificationScope({get, actors, expected}) {
  const roles=['finance','certificationOnly','unassigned','foreign'];
  need(typeof get==='function' && roles.every(k=>id(actors?.[k]?.userId)&&id(actors[k].companyId)) && new Set(roles.map(k=>actors[k].userId)).size===roles.length,'ACTORS');
  need(id(expected?.companyId)&&id(expected.projectId)&&id(expected.certificationId)&&typeof expected.certificationNumber==='string'&&typeof expected.currencyCode==='string'&&typeof expected.state==='string'&&Array.isArray(expected.allocations),'SOURCE');
  need(roles.slice(0,3).every(k=>actors[k].companyId===expected.companyId)&&actors.foreign.companyId!==expected.companyId,'COMPANIES');
  const positive=async (role,path)=>{const r=await get(role,path);need(r?.status===200&&r.data&&typeof r.data==='object','POSITIVE');return r.data;};
  const deny=async(role,path,status)=>{const r=await get(role,path);need(r?.status===status,'DENIAL');};
  const me={};
  for(const k of roles){me[k]=await positive(k,'/auth/me');need(me[k].id===actors[k].userId&&me[k].companyId===actors[k].companyId,'IDENTITY');}
  need(has(me.finance,certView,payView)&&has(me.certificationOnly,certView)&&!has(me.certificationOnly,payView)&&has(me.unassigned,certView,payView)&&!has(me.unassigned,'projects.access_all')&&has(me.foreign,certView,payView),'CAPABILITIES');
  const path='/subcontracts/certifications/'+expected.certificationId, reference=path+'/finance-reference';
  const own=await positive('certificationOnly',path);
  need(own.id===expected.certificationId&&own.companyId===expected.companyId&&own.projectId===expected.projectId,'CERTIFICATION_SCOPE');
  const r=await positive('finance',reference);
  need(r.certificationId===expected.certificationId&&r.certificationNumber===expected.certificationNumber&&r.projectId===expected.projectId&&r.currencyCode===expected.currencyCode&&r.state===expected.state&&Array.isArray(r.allocations)&&r.allocations.length===expected.allocations.length,'REFERENCE');
  const keys=new Set();
  for(const e of expected.allocations){
    need(id(e.id)&&id(e.paymentId)&&!keys.has(e.id),'ALLOCATION_SOURCE');keys.add(e.id);
    const matches=r.allocations.filter(a=>a.id===e.id);need(matches.length===1,'ALLOCATION_ID');const a=matches[0];
    need(a.payment?.id===e.paymentId&&a.payment.currencyCode===expected.currencyCode&&a.payment.state===e.paymentState&&cents(a.allocatedAmount)===cents(e.allocatedAmount)&&cents(a.payment.amount)===cents(e.paymentAmount),'ALLOCATION_HISTORY');
  }
  await deny('certificationOnly',reference,403);
  await deny('unassigned',path,403);await deny('unassigned',reference,403);
  await deny('foreign',path,404);await deny('foreign',reference,404);
  return {status:'M6_04_CERTIFICATION_SCOPE_ASSERTIONS_PASS',allocationCount:keys.size,allocationHistoryPopulated:keys.size>0,scopedDenialAssertions:5,liveTransportVerified:false,milestone6Accepted:false,mayMutate:false};
}
