// Retained C/D HTTP assertion kernel. No network, credentials, DB or session
// creation here. Caller must bind independently verified synthetic retained
// actors, exact current runtime and an allowlisted GET-only transport.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const need = (ok, code) => { if (!ok) throw new Error('M6_CD_READBACK_'+code); };
const id = value => { need(typeof value==='string'&&uuid.test(value),'BAD_ID'); return value; };
const seq = (actual, expected) => Array.isArray(actual)&&Array.isArray(expected)&&expected.length>0&&actual.length===expected.length&&actual.every((x,i)=>x===expected[i]);
const data = async (get,actor,path) => {
  const response=await get(actor,path);
  need(response?.status===200&&response.data!==null&&typeof response.data==='object','POSITIVE_FAILED');
  return response.data;
};
const denied = async (get,actor,path) => {
  const response=await get(actor,path);
  need([403,404].includes(response?.status),'DENIAL_FAILED');
};
const exactKeys = (row,keys) => row&&Object.keys(row).length===keys.length&&keys.every(k=>Object.hasOwn(row,k));
const money = value => typeof value==='string'&&/^\d+(\.\d{1,2})?$/.test(value)?value.split('.')[0].replace(/^0+(?=\d)/,'')+'.'+(value.split('.')[1]??'').padEnd(2,'0'):null;
export async function assertRetainedCDMetadata({get,actors,finance,hr}) {
  need(typeof get==='function','TRANSPORT_REQUIRED');
  const keys=['BEN','NANCY','KOH','FOREMAN'];
  need(keys.every(k=>actors?.[k])&&new Set(keys.map(k=>id(actors[k].userId))).size===4,'ACTOR_BINDING');
  for(const key of keys) id(actors[key].companyId);
  const company=id(finance.companyId),project=id(finance.projectId),claim=id(finance.claimId),cert=id(finance.certificationId),doc=id(finance.documentId);
  need(actors.BEN.companyId===company&&actors.NANCY.companyId===company,'FINANCE_COMPANY');
  const hc=id(hr.companyId),employee=id(hr.employeeId),attachmentEmployee=id(hr.attachmentEmployeeId);
  need(employee!==attachmentEmployee,'HR_DISTINCT_SUBJECTS');
  need(actors.KOH.companyId===hc,'HR_COMPANY');
  need(Array.isArray(hr.privateCategories)&&hr.privateCategories.length>0&&new Set(hr.privateCategories.map(c=>c.category)).size===hr.privateCategories.length,'PRIVATE_COVERAGE');
  for(const c of hr.privateCategories)need(['identity','bank'].includes(c.category)&&Array.isArray(c.ids)&&c.ids.length>0&&c.ids.every(x=>uuid.test(x))&&Array.isArray(c.versions)&&c.versions.length===c.ids.length&&c.versions.every((v,i)=>Number.isSafeInteger(v)&&v>0&&(i===0||v>c.versions[i-1])),'PRIVATE_EXPECTED');
  need(Array.isArray(finance.revisionIds)&&finance.revisionIds.length>0&&finance.revisionIds.every(x=>uuid.test(x))&&finance.revisionIds.includes(id(finance.submissionRevisionId))&&/^[a-f0-9]{64}$/i.test(finance.sourceDigest??'')&&money(finance.assessedAmount)!==null&&money(finance.certifiedGross)!==null&&money(finance.retainedAmount)!==null,'FINANCE_EXPECTED');
  need(Array.isArray(hr.employmentVersions)&&hr.employmentVersions.length>0&&hr.employmentVersions.every((v,i)=>Number.isSafeInteger(v)&&v>0&&(i===0||v>hr.employmentVersions[i-1]))&&Array.isArray(hr.attachments)&&hr.attachments.length>0&&hr.attachments.length<100&&hr.attachments.every((a,i)=>uuid.test(a.id)&&Number.isSafeInteger(a.version)&&a.version>0&&(i===0||a.version>hr.attachments[i-1].version)),'HR_EXPECTED');
  // Transport is required to decode JSON without logging. It must refuse
  // non-GET requests, redirects and any non-pinned loopback origin.
  for(const k of keys){
    const me=await data(get,k,'/auth/me');
    need(me.id===actors[k].userId&&me.companyId===actors[k].companyId,'WRONG_ACTOR');
  }
  const physicalPath='/subcontracts/physical/claims/'+claim;
  const p=await data(get,'BEN',physicalPath);
  need(p.controlled===true&&p.claimId===claim&&seq(p.revisions?.map(x=>x.id),finance.revisionIds)&&p.submission?.revisionId===finance.submissionRevisionId&&p.submission?.sourceDigest===finance.sourceDigest&&p.decision?.actorUserId===actors.BEN.userId&&money(p.decision?.assessedAmount)===money(finance.assessedAmount)&&p.canCapture===false&&p.canDecide===false&&p.submission?.evidence?.some(x=>x.id===doc),'PHYSICAL_HISTORY');
  const c=await data(get,'NANCY','/subcontracts/certifications/'+cert);
  need(c.id===cert&&c.companyId===company&&c.projectId===project&&c.claimId===claim&&c.state==='APPROVED'&&money(c.certifiedGross)===money(finance.certifiedGross)&&money(c.retainedAmount)===money(finance.retainedAmount),'CERTIFICATION_HISTORY');
  await denied(get,'FOREMAN',physicalPath);
  const base='/hr/companies/'+hc+'/employees/'+employee;
  const documentBase='/hr/companies/'+hc+'/employees/'+attachmentEmployee;
  const e=await data(get,'KOH',base+'/employment');
  need(e.employee?.id===employee&&seq(e.employment?.revisions?.map(x=>x.version),hr.employmentVersions)&&e.employment?.currentVersion===hr.employmentVersions.at(-1),'EMPLOYMENT_HISTORY');
  const d=await data(get,'KOH',documentBase+'/documents');
  need(d.nextCursor===null&&Array.isArray(d.items)&&d.items.length===hr.attachments.length&&d.items.every((x,i)=>exactKeys(x,['id','version','createdAt'])&&x.id===hr.attachments[i].id&&x.version===hr.attachments[i].version),'ATTACHMENT_METADATA');
  await denied(get,'FOREMAN',base+'/employment');
  await denied(get,'FOREMAN',documentBase+'/documents');
  for(const cat of hr.privateCategories){
    const path=base+'/private/'+cat.category;
    const h=await data(get,'KOH',path+'/history');
    need(Array.isArray(h)&&h.every(x=>exactKeys(x,['id','version','createdAt','actorUserId']))&&seq(h.map(x=>x.id),cat.ids)&&seq(h.map(x=>x.version),cat.versions),'PRIVATE_HISTORY');
    const m=await data(get,'KOH',path);
    need(exactKeys(m,['version','values'])&&m.version===cat.versions.at(-1)&&m.values&&typeof m.values==='object'&&!Array.isArray(m.values)&&Object.keys(m.values).length>0&&Object.values(m.values).every(x=>x==='••••'),'PRIVATE_MASK');
    await denied(get,'FOREMAN',path);
    await denied(get,'FOREMAN',path+'/history');
  }
  // Deliberately no positive HR download: GET writes DOCUMENT_DOWNLOAD audit.
  // No /auth/csrf: GET rotates token. No generic document alias yet.
  return {status:'M6_CD_METADATA_ASSERTIONS_PASS',financeHistory:true,hrMaskedHistory:true,roleDenials:true,privateCategoriesChecked:hr.privateCategories.length,protectedBytesVerified:false,sessionRevocationVerified:false,historicalBaselineVerified:false,productionAuthorized:false};
}
