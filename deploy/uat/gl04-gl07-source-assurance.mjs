// GL-04/GL-07 source-only preflight: no HTTP, credentials or Production attestation.
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROLE_COUNTS={ben:12,nancy:12,khaimook:18,jai:15,store:21,foreman:6,porn:20,koh:8};
export const SOURCE_STATES={'implemented':4,'configuration-only':10,'partially implemented':67,'missing':29,'unverified':2};
export const ACTORS=[
 ['Ben','PO/subcontract approval and customer BOQ; no self/delegated approval'],
 ['Nancy','Customer BOQ/Finance permissions; narrow HR privacy, no write-off assumption'],
 ['Khaimook','PR/GR review; independent stock-count checker only with separately verified grants'],
 ['Jai','RFQ/PO maker; no PO self-approval or #245 multi-Project assumption'],
 ['Store Site','PR/GR/issue; #300 count maker only, no count approval'],
 ['Foreman','Project-scoped daily and read-only weekly reports; no PR/count authority'],
 ['Koh','HR Company/category entitlement; integration does not prove retained role activation'],
 ['Porn','Existing Accounting, narrowly granted HR bank view only'],
];
export const ROUTES=[
 ['STORE_PR_CREATE','procurement/procurement.controller.ts','Post','projects/:projectId/purchase-requests','procurement.pr.manage'],
 ['PM_PR_APPROVE','procurement/procurement.controller.ts','Post','purchase-requests/:requestId/approve','procurement.pr.approve'],
 ['JAI_PO_CREATE','procurement/purchase-order.controller.ts','Post','projects/:projectId/purchase-orders','procurement.po.create'],
 ['BEN_PO_APPROVE','procurement/purchase-order.controller.ts','Post','purchase-orders/:orderId/approve','procurement.po.approve'],
 ['STORE_GR_CREATE','inventory/goods-receipt.controller.ts','Post','goods-receipts','inventory.receipt.create'],
 ['PM_GR_APPROVE','inventory/goods-receipt.controller.ts','Post','goods-receipts/:id/approve','inventory.receipt.approve'],
 ['STORE_ISSUE_CREATE','inventory/material-movement.controller.ts','Post','material-issues','inventory.issue.create'],
 ['FOREMAN_DAILY_VIEW','site-execution/site-execution.controller.ts','Get','reports','site.daily_report.view'],
 ['FOREMAN_DAILY_SUBMIT','site-execution/site-execution.controller.ts','Post','reports/:id/submit','site.daily_report.submit'],
 ['FOREMAN_WEEKLY_VIEW','site-execution/site-execution.controller.ts','Get','reports/weekly','site.daily_report.view'],
 ['STORE_COUNT_CREATE','inventory/stock-count.controller.ts','Post','stock-counts','inventory.stock_count.create'],
 ['PM_COUNT_APPROVE','inventory/stock-count.controller.ts','Post','stock-counts/:id/approve','inventory.stock_count.approve'],
 ['KOH_EMPLOYMENT_VIEW','hr/hr.controller.ts','Get','companies/:companyId/employees','hr.employment.view'],
 ['KOH_DOCUMENT_VIEW','hr/hr.controller.ts','Get','companies/:companyId/employees/:employeeId/documents','hr.documents.view'],
 ['HR_ACCESS_ADMIN','hr/hr.controller.ts','Post','companies/:companyId/access','hr.access.manage'],
 ['NANCY_CUSTOMER_BOQ_APPROVE','budget/customer-boq.controller.ts','Post','projects/:projectId/versions/:id/decision','budget.customer.approve'],
];
export function parseRoleCensus(markdown){
 const rows=[],seen=new Set();
 for(const line of markdown.split(/\r?\n/)){
  if(!line.startsWith('|'))continue;
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());
  if(cells.length!==6||!/^[A-Z][A-Z0-9-]*$/.test(cells[0])||!Object.hasOwn(ROLE_COUNTS,cells[1]))continue;
  if(seen.has(cells[0]))throw Error('DUPLICATE_STABLE_ID:'+cells[0]);
  seen.add(cells[0]);
  if(!Object.hasOwn(SOURCE_STATES,cells[4]))throw Error('UNKNOWN_SOURCE_STATUS:'+cells[0]);
  rows.push({id:cells[0],role:cells[1],status:cells[4]});
 }
 const roles=Object.fromEntries(Object.keys(ROLE_COUNTS).map(k=>[k,rows.filter(r=>r.role===k).length]));
 const states=Object.fromEntries(Object.keys(SOURCE_STATES).map(k=>[k,rows.filter(r=>r.status===k).length]));
 if(rows.length!==112||Object.entries(ROLE_COUNTS).some(([k,v])=>roles[k]!==v)||
    Object.entries(SOURCE_STATES).some(([k,v])=>states[k]!==v))throw Error('ROLE_BASELINE_CHANGED_RECONCILE_FIRST');
 return {count:rows.length,roles,states};
}
export function inspectRoute(source,[id,file,verb,path,permission]){
 const endpoints=[...source.matchAll(/@(Get|Post|Patch|Put|Delete)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];
 const matches=endpoints.filter(m=>m[1]===verb&&m[2]===path);
 if(matches.length!==1)return {id,result:matches.length?'AMBIGUOUS_ROUTE':'ROUTE_NOT_FOUND'};
 const index=matches[0].index,next=endpoints.find(m=>m.index>index);
 const window=source.slice(index,next?next.index:source.length);
 const method=window.search(/\basync\s+[A-Za-z_$][\w$]*\s*\(/);
 if(method<0)return {id,result:'HANDLER_NOT_FOUND'};
 const decorators=window.slice(0,method);
 const perms=[...decorators.matchAll(/@RequirePermissions\s*\(([^)]*)\)/g)]
   .flatMap(m=>[...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(v=>v[1]));
 if(!perms.includes(permission))return {id,result:'PERMISSION_DECORATOR_MISSING'};
 const classStart=source.indexOf('export class ');
 const classDecorators=classStart<0?'':source.slice(Math.max(0,source.lastIndexOf('@Controller(',classStart)),classStart);
 if(!/@UseGuards\s*\([^)]*\bAuthGuard\b[^)]*\bPermissionGuard\b[^)]*\)/.test(decorators+' '+classDecorators))
    return {id,result:'AUTH_PERMISSION_GUARDS_MISSING'};
 return {id,file:'apps/api/src/'+file,route:verb.toUpperCase()+' '+path,permission,result:'SOURCE_DECORATORS_FOUND'};
}
export function inspectWorkflow(source){
 const missing=[];
 if(!/^\s*pull_request\s*:/m.test(source))missing.push('PR_TRIGGER_MISSING');
 if(!/^\s*push\s*:/m.test(source))missing.push('PUSH_TRIGGER_MISSING');
 if(!/^\s*validate\s*:/m.test(source))missing.push('VALIDATE_JOB_MISSING');
 if(!/^\s*contents:\s*read\s*$/m.test(source))missing.push('CONTENTS_READ_MISSING');
 return {expectedCheckContext:'validate',sourceWorkflowChecks:missing.length?'FAILED':'PASS',
  missing,mainProtected:'UNVERIFIED_FROM_SOURCE',enforcedRulesets:'UNVERIFIED_FROM_SOURCE'};
}
export async function auditSource(root,{read=readFile}={}){
 const src=async rel=>read(resolve(root,rel),'utf8');
 const census=parseRoleCensus(await src('docs/ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md'));
 const workflow=inspectWorkflow(await src('.github/workflows/validate.yml'));
 const files=new Map(),probes=[];
 for(const route of ROUTES){
  const path='apps/api/src/'+route[1];
  if(!files.has(path))files.set(path,await src(path));
  probes.push(inspectRoute(files.get(path),route));
 }
 const anomalies=probes.filter(p=>p.result!=='SOURCE_DECORATORS_FOUND').length+workflow.missing.length;
 return {purpose:'GL04_GL07_OFFLINE_SOURCE_CHECK',status:anomalies?'SOURCE_CHECK_FAILED':'SOURCE_CHECKS_PASS_RUNTIME_UNVERIFIED',
  sourceOnly:true,networkRequests:0,retainedDataReads:0,businessWrites:0,grantsApplied:false,
  productionAuthorized:false,ownerBusinessAcceptance:false,goLiveGatesClosed:0,
  census,gl04:{probes,actorReadbacks:ACTORS.map(([role,verify])=>({role,verify,retainedConfiguration:'NOT_RUN'})),
    trackedPRs:[297,298,299,300,302],integrationStatus:'VERIFY_LIVE_GITHUB_NOT_INFERRED_FROM_SOURCE'},gl07:workflow,anomalyCount:anomalies};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3||!['--check','--plan'].includes(process.argv[2])){
  process.stderr.write('Usage: node deploy/uat/gl04-gl07-source-assurance.mjs --check|--plan\n');process.exitCode=2;
 }else if(process.argv[2]==='--plan'){
  process.stdout.write(JSON.stringify({actors:ACTORS,routes:ROUTES,runtime:'NOT_RUN',productionAuthorized:false},null,2)+'\n');
 }else{
  try{
   const out=await auditSource(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
   process.stdout.write(JSON.stringify(out,null,2)+'\n');
   if(out.anomalyCount)process.exitCode=1;
  }catch(e){process.stderr.write('GL04_GL07_SOURCE_CHECK_BLOCKED: '+String(e.message||e)+'\n');process.exitCode=1;}
 }
}
