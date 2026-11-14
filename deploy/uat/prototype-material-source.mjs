// Create the missing ten-unit synthetic Cost BOQ through existing HTTP routes.
// Never picks a source by price/UOM/count or approves by SQL/service shortcut.
import {API,WEB,SOURCE,httpClient} from './prototype-actors.mjs';
const demand=(ok,code='MATERIAL_SOURCE_BOUNDARY_REFUSED')=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export function materialSourceHttp(binding,fetchImpl=fetch){
  const b=structuredClone(binding);
  demand(b.sourceSha===SOURCE&&['companyId','projectId','materialId','uomId'].every(k=>uuid(b[k])));
  const native=process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&
    b.api==='http://127.0.0.1:31319/api/v1'&&b.web==='http://127.0.0.1:44319';
  demand(native||(b.api===API&&b.web===WEB));
  const project='/budget/projects/'+b.projectId;
  let boqId,sectionId,itemId,revisionId;
  const guarded=async(url,options)=>{
    demand(typeof url==='string'&&url.startsWith(b.api+'/'));
    const path=url.slice(b.api.length),method=options?.method;
    demand(options?.redirect==='error'&&options?.headers?.Origin===b.web);
    let body;try{body=options.body===undefined?undefined:JSON.parse(options.body);}catch{demand(false);}
    let allowed=false;
    if(path==='/auth/login'&&method==='POST')allowed=/^proto-(ben|store_site|khaimook|foreman)@example\.invalid$/.test(body?.email??'')&&/^[a-f0-9]{64}$/.test(body?.password??'');
    if((path==='/auth/me'&&method==='GET')||(path==='/auth/logout'&&method==='POST'))allowed=true;
    if(path===project+'/boq'&&method==='GET')allowed=true;
    if(path===project+'/boq'&&method==='POST')allowed=body?.boqName==='Synthetic material journey quantity source';
    if(boqId&&path==='/budget/boqs/'+boqId+'/sections'&&method==='POST')allowed=JSON.stringify(body)===JSON.stringify({sectionCode:'PROTO_MATERIAL',sectionName:'Synthetic material work',sortOrder:1});
    if(boqId&&sectionId&&path==='/budget/boqs/'+boqId+'/items'&&method==='POST')allowed=JSON.stringify(body)===JSON.stringify({sectionId,itemCode:'PROTO_STEEL_10',description:'Explicit synthetic ten-unit steel mapping',quantity:'10.0000',uomId:b.uomId,rate:'1.0000',wbsId:null,costCodeId:null,sortOrder:1});
    if(itemId&&path===project+'/revisions'&&method==='POST')allowed=body?.revisionNote==='Synthetic material journey quantity source';
    if(revisionId&&path==='/budget/revisions/'+revisionId&&method==='GET')allowed=true;
    if(revisionId&&path==='/budget/revisions/'+revisionId+'/submit'&&method==='POST')allowed=body?.workflowCode===b.sourceWorkflowCode;
    if(revisionId&&path==='/budget/revisions/'+revisionId+'/approve'&&method==='POST')allowed=body?.comment==='Independent synthetic quantity source approval';
    demand(allowed);
    try{return await fetchImpl(url,options);}catch{demand(false,'MATERIAL_SOURCE_TRANSPORT_FAILED');}
  };
  const client=httpClient(b.api,b.web,guarded);
  async function prepare(ben,khaimook){
    demand(typeof b.sourceWorkflowCode==='string'&&b.sourceWorkflowCode.length>0);
    const current=(await client.call(ben,'SOURCE_EXISTING_BOQ',project+'/boq',200)).value.data;
    demand(current===null,'MATERIAL_EXISTING_BOQ_REQUIRES_EXPLICIT_MAPPING');
    const boq=(await client.call(ben,'SOURCE_BOQ_CREATE',project+'/boq',201,{boqName:'Synthetic material journey quantity source'})).value.data;
    demand(uuid(boq?.id)&&boq.companyId===b.companyId&&boq.projectId===b.projectId);boqId=boq.id;
    const section=(await client.call(ben,'SOURCE_SECTION_CREATE','/budget/boqs/'+boqId+'/sections',201,
      {sectionCode:'PROTO_MATERIAL',sectionName:'Synthetic material work',sortOrder:1})).value.data;
    demand(uuid(section?.id)&&section.boqId===boqId);sectionId=section.id;
    const item=(await client.call(ben,'SOURCE_ITEM_CREATE','/budget/boqs/'+boqId+'/items',201,
      {sectionId,itemCode:'PROTO_STEEL_10',description:'Explicit synthetic ten-unit steel mapping',quantity:'10.0000',uomId:b.uomId,rate:'1.0000',wbsId:null,costCodeId:null,sortOrder:1})).value.data;
    demand(uuid(item?.id)&&item.boqId===boqId&&item.sectionId===sectionId&&item.uomId===b.uomId);itemId=item.id;
    const revision=(await client.call(ben,'SOURCE_REVISION_CREATE',project+'/revisions',201,
      {revisionNote:'Synthetic material journey quantity source'})).value.data;
    demand(uuid(revision?.id));revisionId=revision.id;
    await client.call(ben,'SOURCE_SUBMIT','/budget/revisions/'+revisionId+'/submit',201,{workflowCode:b.sourceWorkflowCode});
    await client.call(khaimook,'SOURCE_APPROVE','/budget/revisions/'+revisionId+'/approve',201,
      {comment:'Independent synthetic quantity source approval'});
    const saved=(await client.call(ben,'SOURCE_APPROVED_READ','/budget/revisions/'+revisionId,200)).value.data;
    demand(saved?.id===revisionId&&saved.companyId===b.companyId&&saved.projectId===b.projectId&&
      saved.createdByUserId===ben.userId&&saved.submittedByUserId===ben.userId&&
      saved.approvalInstance?.approvalState==='APPROVED'&&saved.approvalInstance.actions?.length===1&&
      saved.approvalInstance.actions[0].action==='APPROVE'&&saved.approvalInstance.actions[0].actionByUserId===khaimook.userId&&
      saved.lines?.length===1,'MATERIAL_SOURCE_APPROVAL_READBACK_FAILED');
    const line=saved.lines[0];
    demand(uuid(line.id)&&line.boqItemId===itemId&&line.uomId===b.uomId&&
      /^10(?:\.0{1,4})?$/.test(String(line.quantity))&&line.wbsId===null&&line.costCodeId===null,
      'MATERIAL_SOURCE_MAPPING_READBACK_FAILED');
    return {budgetRevisionId:revisionId,budgetRevisionLineId:line.id,materialId:b.materialId,uomId:b.uomId,quantity:'10.0000'};
  }
  return {login:client.login,logout:client.logout,observations:client.observations,prepare};
}
