// GL-04/GL-07 source-only preflight: no HTTP, credentials or Production attestation.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
// Reuse the API's already-pinned development compiler; never import/execute app controllers.
const ts=createRequire(new URL('../../apps/api/package.json',import.meta.url))('typescript');
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROLE_COUNTS={ben:12,nancy:12,khaimook:18,jai:15,store:21,foreman:6,porn:20,koh:8};
export const SOURCE_STATES={'implemented':4,'configuration-only':10,'partially implemented':67,'missing':29,'unverified':2};
export const ACTORS=[
 ['Ben','PO/subcontract approval and customer BOQ; no self/delegated approval'],
 ['Nancy','Customer BOQ/Finance permissions; narrow HR privacy, no write-off assumption'],
 ['Khaimook','PR/GR review; independent stock-count checker only with separately verified grants'],
 ['Jai','RFQ/PO maker; no PO self-approval or #245 multi-Project assumption'],
 ['Store Site','PR/GR/issue; #300 count maker and #315 Store-recorded request/receipt source; effective grants not verified'],
 ['Foreman','Project-scoped daily and read-only weekly reports; #315 Store-recorded Foreman request source does not grant Foreman PR/count authority'],
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
 ["MR_PROJECTS","inventory/material-request.controller.ts","Get","projects","inventory.material_request.view",{"controller":"inventory/material-requests"}],
 ["MR_CHOICES","inventory/material-request.controller.ts","Get","choices","inventory.material_request.view",{"controller":"inventory/material-requests"}],
 ["MR_LIST","inventory/material-request.controller.ts","Get","","inventory.material_request.view",{"controller":"inventory/material-requests"}],
 ["MR_DETAIL","inventory/material-request.controller.ts","Get",":id","inventory.material_request.view",{"controller":"inventory/material-requests"}],
 ["MR_ISSUE_CHOICES","inventory/material-request.controller.ts","Get",":id/issue-choices","inventory.material_request.view",{"controller":"inventory/material-requests","extraPermissions":["inventory.issue.view"]}],
 ["STORE_MR_CAPTURE","inventory/material-request.controller.ts","Post","","inventory.material_request.view",{"controller":"inventory/material-requests","extraPermissions":["inventory.material_request.create"],"csrf":true}],
 ["STORE_MR_EDIT","inventory/material-request.controller.ts","Post",":id/revisions","inventory.material_request.view",{"controller":"inventory/material-requests","extraPermissions":["inventory.material_request.edit"],"csrf":true}],
 ["STORE_MR_LINK","inventory/material-request.controller.ts","Post",":id/issue-links","inventory.material_request.view",{"controller":"inventory/material-requests","extraPermissions":["inventory.material_request.link","inventory.issue.view"],"csrf":true}],
 ["STORE_MR_RECEIPT","inventory/material-request.controller.ts","Post",":id/receipts","inventory.material_request.view",{"controller":"inventory/material-requests","extraPermissions":["inventory.material_request.acknowledge","inventory.issue.view","documents.document.view"],"csrf":true}],
 ["MP_PROJECTS", "inventory/material-plan.controller.ts", "Get", "projects", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_CHOICES", "inventory/material-plan.controller.ts", "Get", "choices", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_LIST", "inventory/material-plan.controller.ts", "Get", "", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_DETAIL", "inventory/material-plan.controller.ts", "Get", ":id", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_HISTORY", "inventory/material-plan.controller.ts", "Get", ":id/revisions", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_REVISION", "inventory/material-plan.controller.ts", "Get", ":id/revisions/:revisionId", "inventory.material_plan.view", {"controller": "inventory/material-plans"}],
 ["MP_CREATE", "inventory/material-plan.controller.ts", "Post", "", "inventory.material_plan.view", {"controller": "inventory/material-plans", "extraPermissions": ["inventory.material_plan.create"], "csrf": true}],
 ["MP_REVISE", "inventory/material-plan.controller.ts", "Post", ":id/revisions", "inventory.material_plan.view", {"controller": "inventory/material-plans", "extraPermissions": ["inventory.material_plan.revise"], "csrf": true}],
 ["MP_SUBMIT", "inventory/material-plan.controller.ts", "Post", ":id/submit", "inventory.material_plan.view", {"controller": "inventory/material-plans", "extraPermissions": ["inventory.material_plan.submit"], "csrf": true}],
 ["MP_DECIDE", "inventory/material-plan.controller.ts", "Post", ":id/decision", "inventory.material_plan.view", {"controller": "inventory/material-plans", "extraPermissions": ["inventory.material_plan.approve"], "csrf": true}],
];
export function parseRoleCensus(markdown){
 const rows=[],seen=new Set();
 for(const line of markdown.split(/\r?\n/)){
  if(!line.startsWith('|'))continue;
  const cells=line.split('|').slice(1,-1).map(s=>s.trim());
  if(cells.length!==6||!/^[A-Z][A-Z0-9-]*$/.test(cells[0]))continue;
  if(!Object.hasOwn(ROLE_COUNTS,cells[1]))throw Error('UNKNOWN_SOURCE_ROLE:'+cells[0]);
  if(seen.has(cells[0]))throw Error('DUPLICATE_STABLE_ID:'+cells[0]);
  seen.add(cells[0]);
  if(!Object.hasOwn(SOURCE_STATES,cells[4]))throw Error('UNKNOWN_SOURCE_STATUS:'+cells[0]);
  rows.push({id:cells[0],role:cells[1],status:cells[4]});
 }
 const roles=Object.fromEntries(Object.keys(ROLE_COUNTS).map(k=>[k,rows.filter(r=>r.role===k).length]));
 const states=Object.fromEntries(Object.keys(SOURCE_STATES).map(k=>[k,rows.filter(r=>r.status===k).length]));
 if(rows.length!==112||Object.entries(ROLE_COUNTS).some(([k,v])=>roles[k]!==v)||
    Object.entries(SOURCE_STATES).some(([k,v])=>states[k]!==v))throw Error('ROLE_BASELINE_CHANGED_RECONCILE_FIRST');
 // Exact sorted (stable ID, role, frozen assessment) tuples from approved
 // role-baseline commit 646b2877335097ee204d5ec0ccc043c2e1fce548.
 // A digest avoids duplicating 112 policy rows; count-preserving edits still deny.
 const tuples=rows.map(({id,role,status})=>[id,role,status])
  .sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
 if(createHash('sha256').update(JSON.stringify(tuples)).digest('hex')!=='301b0b292c5d55ca1de08b41b760d52185d9f349fa2763c75eea6bb5f5583e39')
  throw Error('ROLE_BASELINE_CHANGED_RECONCILE_FIRST');
 return {count:rows.length,roles,states};
}
const decoratorCalls=(node,name)=>(ts.canHaveDecorators(node)?ts.getDecorators(node)||[]:[])
 .map(decorator=>decorator.expression)
 .filter(expression=>ts.isCallExpression(expression)&&ts.isIdentifier(expression.expression)&&expression.expression.text===name);
const literal=(node,value)=>ts.isStringLiteral(node)&&node.text===value;
export function inspectRoute(source,[id,file,verb,path,permission,options={}]){
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 if(ast.parseDiagnostics.length)return {id,result:'SOURCE_PARSE_ERROR'};
 const matches=[];
 const visit=node=>{
  if(ts.isClassDeclaration(node))for(const method of node.members){
   if(!ts.isMethodDeclaration(method))continue;
   for(const call of decoratorCalls(method,verb)){
    if((path===''&&call.arguments.length===0)||(call.arguments.length===1&&literal(call.arguments[0],path)))matches.push({method,owner:node});
   }
  }
  ts.forEachChild(node,visit);
 };
 visit(ast);
 if(matches.length!==1)return {id,result:matches.length?'AMBIGUOUS_ROUTE':'ROUTE_NOT_FOUND'};
 const {method,owner}=matches[0];
 const httpDecorators=['Get','Post','Patch','Put','Delete','Options','Head','All']
  .flatMap(name=>decoratorCalls(method,name));
 if(httpDecorators.length!==1)return {id,result:'AMBIGUOUS_ROUTE'};
 const controllers=decoratorCalls(owner,'Controller');
 if(!controllers.length)return {id,result:'CONTROLLER_DECORATOR_MISSING'};
 if(options.controller&&(controllers.length!==1||controllers[0].arguments.length!==1||!literal(controllers[0].arguments[0],options.controller)))
  return {id,result:'CONTROLLER_PATH_MISMATCH'};
 const permissions=decoratorCalls(method,'RequirePermissions');
 if(permissions.length>1)return {id,result:'AMBIGUOUS_PERMISSION_DECORATORS'};
 const requiredPermissions=[permission,...(options.extraPermissions||[])];
 if(!permissions.some(call=>requiredPermissions.every(code=>call.arguments.some(arg=>literal(arg,code)))))
  return {id,result:'PERMISSION_DECORATOR_MISSING'};
 const guards=[...decoratorCalls(owner,'UseGuards'),...decoratorCalls(method,'UseGuards')]
  .flatMap(call=>[...call.arguments]).filter(ts.isIdentifier).map(node=>node.text);
 if(!['AuthGuard','PermissionGuard'].every(name=>guards.includes(name)))
  return {id,result:'AUTH_PERMISSION_GUARDS_MISSING'};
 if(options.csrf&&!guards.includes('CsrfGuard'))return {id,result:'CSRF_GUARD_MISSING'};
 return {id,file:'apps/api/src/'+file,route:verb.toUpperCase()+' '+path,permission,result:'SOURCE_DECORATORS_FOUND'};
}
// Conservative readback of the repository's fixed block-mapping layout.
// Unknown/inline/aliased layouts fail closed; this never evaluates YAML.
function mappingLines(source,name){
 const lines=source.split(/\r?\n/),matches=[];
 for(let i=0;i<lines.length;i++)if(new RegExp('^'+name+':\\s*(?:#.*)?$').test(lines[i]))matches.push(i);
 if(matches.length!==1)return [];
 const start=matches[0]+1;let end=start;
 while(end<lines.length&&(!/^[^\s#]/.test(lines[end])||!lines[end].trim()))end++;
 return lines.slice(start,end);
}
export function inspectWorkflow(source){
 const missing=[],on=mappingLines(source,'on'),jobs=mappingLines(source,'jobs'),permissions=mappingLines(source,'permissions');
 const one=(lines,pattern)=>lines.filter(line=>pattern.test(line)).length===1;
 if(!one(on,/^  pull_request:\s*(?:#.*)?$/))missing.push('PR_TRIGGER_MISSING');
 if(!one(on,/^  push:\s*(?:#.*)?$/))missing.push('PUSH_TRIGGER_MISSING');
 if(!one(jobs,/^  validate:\s*(?:#.*)?$/))missing.push('VALIDATE_JOB_MISSING');
 if(!one(permissions,/^  contents:\s*read\s*(?:#.*)?$/))missing.push('CONTENTS_READ_MISSING');
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
    trackedPRs:[297,298,299,300,302,315],integrationStatus:'VERIFY_LIVE_GITHUB_NOT_INFERRED_FROM_SOURCE'},gl07:workflow,anomalyCount:anomalies};
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
