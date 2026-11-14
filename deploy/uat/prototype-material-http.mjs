// #338: a narrow request boundary for the future guarded populated journey.
// No CLI, database connection, provisioning, browser widening or Mac execution.
import {API,WEB,SOURCE,httpClient} from './prototype-actors.mjs';

const fail=()=>{throw Object.assign(new Error('MATERIAL_HTTP_BOUNDARY_REFUSED'),{safeCode:'MATERIAL_HTTP_BOUNDARY_REFUSED'});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const same=(a,b)=>a===b||fail();
const own=(set,id)=>set.has(id)||fail();

// The caller must first independently verify target/receipts/process/schema,
// actual grants, approved source and a private create-once journey marker.
// This transport is not that preflight and cannot authorize its own execution.
export function materialJourneyHttp(binding,fetchImpl=fetch){
  const b=structuredClone(binding);
  if(b?.sourceSha!==SOURCE||!['companyId','projectId','warehouseId','materialId','uomId',
    'budgetRevisionId','budgetRevisionLineId','storeEmployeeId','foremanEmployeeId','documentTypeId'].every(k=>uuid(b[k])))fail();
  if(new Set(Object.values(b).filter(uuid)).size!==10)fail();
  // Fixed origins: the owned Mac target, or the existing uniquely isolated CI
  // harness only. Native loopback is not an arbitrary target override.
  const native=b.api==='http://127.0.0.1:31319/api/v1'&&b.web==='http://127.0.0.1:44319'&&
    process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true';
  if(!native&&(b.api!==API||b.web!==WEB))fail();
  const owned={plans:new Set(),issues:new Set(),requests:new Set(),authorizations:new Set(),documents:new Set(),
    issueItems:new Set(),requestLines:new Set(),planLines:new Set(),links:new Set()};
  const pending={plans:new Set(),issues:new Set(),requests:new Set()};
  const materialLines=lines=>Array.isArray(lines)&&lines.length===1&&lines.every(l=>
    l?.materialId===b.materialId&&l.uomId===b.uomId&&
    ['reservationId','wbsId','costCodeId','activityId'].every(k=>l[k]===undefined||l[k]===null));
  function permit(path,method,body){
    // Check the literal spelling before URL normalization. Encoded traversal,
    // query aliases, credentials, fragments and alternate origins never leave.
    if(typeof path!=='string'||!/^\/[a-zA-Z0-9_/?=&.-]+$/.test(path)||path.includes('..')||path.includes('//'))fail();
    if(!['GET','POST'].includes(method))fail();
    if(path==='/auth/me'&&method==='GET')return;
    if(path==='/auth/login'&&method==='POST'){
      if(!/^proto-(ben|nancy|khaimook|jai|store_site|foreman|porn|koh|admin)@example\.invalid$/.test(body?.email??'')||
        !/^[a-f0-9]{64}$/.test(body?.password??''))fail();return;
    }
    if(path==='/auth/logout'&&method==='POST')return;
    if(method==='GET'&&[
      '/inventory/stock-balances?projectId='+b.projectId+'&warehouseId='+b.warehouseId+'&materialId='+b.materialId,
      '/inventory/reports/movement-summary?projectId='+b.projectId,
      '/inventory/material-plan-issues/projects/'+b.projectId+'/policy',
    ].includes(path))return;
    if(path==='/inventory/material-plans'&&method==='POST'){
      if(body?.projectId!==b.projectId||body.warehouseId!==b.warehouseId||body.budgetRevisionId!==b.budgetRevisionId||
        !materialLines(body.lines)||body.lines[0].budgetRevisionLineId!==b.budgetRevisionLineId)fail();return;
    }
    if(path==='/inventory/material-issues'&&method==='POST'){
      if(body?.projectId!==b.projectId||body.warehouseId!==b.warehouseId||!materialLines(body.lines)||
        body.issuedToEmployeeId!==b.foremanEmployeeId)fail();return;
    }
    if(path==='/inventory/material-requests'&&method==='POST'){
      if(body?.projectId!==b.projectId||body.warehouseId!==b.warehouseId||!materialLines(body.lines)||
        body.requesterEmployeeId!==b.foremanEmployeeId)fail();return;
    }
    if(path==='/inventory/material-plan-issues/projects/'+b.projectId+'/enable'&&method==='POST'){
      if(typeof b.overageWorkflowCode!=='string'||!b.overageWorkflowCode||body?.workflowCode!==b.overageWorkflowCode||
        body.confirmation!=='ISOLATED_SYNTHETIC')fail();return;
    }
    let m=path.match(/^\/inventory\/material-plans\/([a-f0-9-]+)(?:\/(submit|decision))?$/);
    if(m){if(!m[2]&&method==='GET'&&(owned.plans.has(m[1])||pending.plans.has(m[1])))return;
      own(owned.plans,m[1]);if(m[2]&&method==='POST')return;fail();}
    m=path.match(/^\/inventory\/material-issues\/([a-f0-9-]+)(\/reverse)?$/);
    if(m){if(!m[2]&&method==='GET'&&(owned.issues.has(m[1])||pending.issues.has(m[1])))return;
      own(owned.issues,m[1]);if(m[2]&&method==='POST')return;fail();}
    m=path.match(/^\/inventory\/material-plan-issues\/issues\/([a-f0-9-]+)(?:\/(preview|within-plan|overage))?$/);
    if(m){
      own(owned.issues,m[1]);if(!m[2]&&method==='GET')return;
      if(!m[2]||method!=='POST'||!Array.isArray(body?.bindings)||body.bindings.length!==1)fail();
      for(const pin of body.bindings){own(owned.issueItems,pin.issueItemId);own(owned.planLines,pin.planLineId);}return;
    }
    m=path.match(/^\/inventory\/material-plan-issues\/authorizations\/([a-f0-9-]+)\/(review|decision)$/);
    if(m&&method==='POST'){own(owned.authorizations,m[1]);return;}
    m=path.match(/^\/inventory\/material-requests\/([a-f0-9-]+)(?:\/(issue-links|receipts))?$/);
    if(m){
      if(!m[2]&&method==='GET'&&(owned.requests.has(m[1])||pending.requests.has(m[1])))return;
      own(owned.requests,m[1]);
      if(method!=='POST')fail();
      if(m[2]==='issue-links'){own(owned.requestLines,body?.requestLineId);own(owned.issueItems,body?.materialIssueItemId);return;}
      if(m[2]==='receipts'){
        own(owned.links,body?.issueLinkId);own(owned.documents,body?.documentId);
        if(body.recipientEmployeeId!==b.foremanEmployeeId||body.issuerEmployeeId!==b.storeEmployeeId||
          body.supersedesReceiptId!==null)fail();return;
      }
      fail();
    }
    const prefix='/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/';
    if(path.startsWith(prefix)){
      const rest=path.slice(prefix.length).split('/');own(owned.requests,rest[0]);
      if(rest.length===1&&method==='POST'&&body instanceof FormData&&body.get('documentTypeId')===b.documentTypeId&&
        [...body.keys()].length===2&&body.get('file') instanceof Blob)return;
      if(rest.length===3&&method==='GET'&&rest[2]==='download'){own(owned.documents,rest[1]);return;}
    }
    fail();
  }
  function capture(path,method,value){
    if(method!=='POST')return;
    const d=value?.data;
    for(const [route,kind] of [['/inventory/material-plans','plans'],['/inventory/material-issues','issues'],
      ['/inventory/material-requests','requests']])if(path===route){
      if(!uuid(d?.id))fail();pending[kind].add(d.id);
    }
    if(/^\/inventory\/material-plan-issues\/issues\/[a-f0-9-]+\/overage$/.test(path)){
      if(!uuid(d?.authorizationId)||!owned.issues.has(d.issueId)||!path.includes('/'+d.issueId+'/'))fail();
      owned.authorizations.add(d.authorizationId);
    }
  }
  // Every request from the existing login/CSRF helper passes the boundary.
  // Redirection is refused even when a server attempts a same-origin redirect.
  const guardedFetch=async(url,options)=>{
    if(typeof url!=='string'||!url.startsWith(b.api+'/'))fail();
    const path=url.slice(b.api.length),method=options?.method;
    if(options?.redirect!=='error'||options?.headers?.Origin!==b.web)fail();
    let body=options.body;
    if(typeof body==='string'){try{body=JSON.parse(body);}catch{fail();}}
    permit(path,method,body);
    try{return await fetchImpl(url,options);}catch{throw Object.assign(new Error('MATERIAL_HTTP_TRANSPORT_FAILED'),{safeCode:'MATERIAL_HTTP_TRANSPORT_FAILED'});}
  };
  const client=httpClient(b.api,b.web,guardedFetch);
  async function call(actor,id,path,expected,body,method=body===undefined?'GET':'POST',csrf=true){
    permit(path,method,body);
    const result=await client.call(actor,id,path,expected,body,method,csrf);
    if(expected>=200&&expected<300){
      capture(path,method,result.value);
      // Child identifiers are learned only from a successful read of an owned
      // parent. A returned foreign parent can never expand the write surface.
      const d=result.value?.data;
      for(const [route,kind,children,childKind] of [
        ['/inventory/material-issues/','issues','items','issueItems'],
        ['/inventory/material-requests/','requests','lines','requestLines'],
        ['/inventory/material-plans/','plans','approvedRevision','planLines'],
      ])if(method==='GET'&&path.startsWith(route)&&!path.slice(route.length).includes('/')&&
        (owned[kind].has(path.slice(route.length))||pending[kind].has(path.slice(route.length)))){
        if(d?.id!==path.slice(route.length))fail();
        same(d.projectId,b.projectId);same(d.warehouseId,b.warehouseId);same(d.companyId,b.companyId);
        const rows=children==='approvedRevision'?d.approvedRevision?.lines:d[children];
        if(rows!==undefined&&rows!==null){if(!Array.isArray(rows)||rows.length!==1||!rows.every(x=>uuid(x.id)&&
          x.materialId===b.materialId&&x.uomId===b.uomId))fail();for(const row of rows)owned[childKind].add(row.id);}
        if(kind==='requests')for(const line of rows??[])for(const link of line.issueLinks??[]){
          if(!uuid(link.id)||!owned.issueItems.has(link.materialIssueItemId))fail();owned.links.add(link.id);
        }
        owned[kind].add(d.id);pending[kind].delete(d.id);
      }
    }
    return result;
  }
  async function upload(actor,id,requestId,expected,bytes){
    if(!/^[A-Z0-9_]+$/.test(id))fail();
    const path='/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/'+requestId;
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>1048576)fail();
    const body=new FormData();body.set('documentTypeId',b.documentTypeId);
    body.set('file',new Blob([bytes],{type:'application/pdf'}),'synthetic-signed-receipt.pdf');
    const response=await guardedFetch(b.api+path,{method:'POST',headers:{Origin:b.web,Cookie:actor?.cookie??'',
      'x-csrf-token':actor?.csrf??''},redirect:'error',signal:AbortSignal.timeout(15000),body});
    client.observations.push({id,httpStatus:response.status,expected,observedAt:new Date().toISOString()});
    if(response.status!==expected)fail();
    let result;try{result=await response.json();}catch{fail();}
    if(response.ok){if(!uuid(result?.data?.id)||result.data.documentTypeId!==b.documentTypeId)fail();owned.documents.add(result.data.id);}
    return result;
  }
  async function download(actor,id,requestId,documentId,expected){
    if(!/^[A-Z0-9_]+$/.test(id))fail();
    const path='/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/'+requestId+'/'+documentId+'/download';
    const response=await guardedFetch(b.api+path,{method:'GET',headers:{Origin:b.web,Cookie:actor?.cookie??''},
      redirect:'error',signal:AbortSignal.timeout(15000)});
    client.observations.push({id,httpStatus:response.status,expected,observedAt:new Date().toISOString()});
    if(response.status!==expected)fail();
    return new Uint8Array(await response.arrayBuffer());
  }
  return {call,upload,download,login:client.login,logout:client.logout,observations:client.observations};
}
