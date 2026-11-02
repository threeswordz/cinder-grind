import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {ROLE_COUNTS,SOURCE_STATES,ROUTES,parseRoleCensus,inspectRoute,inspectWorkflow,auditSource} from './gl04-gl07-source-assurance.mjs';

const baseline=JSON.parse(readFileSync(new URL('../../docs/ROLE-REQUIREMENTS-2026-10-30/data/requirements-execution.json',import.meta.url),'utf8')).records;
const markdown=(records=baseline)=>records.map(row=>'| '+row.id+' | '+row.role+' | Synthetic | L0 | '+row.implementation_observation+' | OPERATIONAL_REVIEW_ONLY |').join('\n');
const route=ROUTES[0];
const decorated=(perm=route[4],guards='@UseGuards(AuthGuard, PermissionGuard)')=>
 "@Controller('test')\nexport class Mock {\n@Post('"+route[3]+"')\n"+guards+"\n@RequirePermissions('"+perm+"')\nasync action(){}\n@Get('other')\n@RequirePermissions('"+route[4]+"')\nasync other(){}\n}";
const ci='on:\n  pull_request:\n  push:\npermissions:\n  contents: read\njobs:\n  validate:\n';

test('baseline must preserve all 112 distinct IDs and source classifications',()=>{
 const c=parseRoleCensus(markdown());
 assert.equal(c.count,112);assert.equal(c.roles.store,21);assert.equal(c.states['partially implemented'],67);
 assert.throws(()=>parseRoleCensus(markdown().replace('| BEN01 |','| BEN02 |')),/DUPLICATE_STABLE_ID/);
 assert.throws(()=>parseRoleCensus(markdown().replace('partially implemented','implemented')),/ROLE_BASELINE_CHANGED/);
});
test('count-preserving ID substitution, status swaps and role swaps cannot alter the approved frozen tuple set',()=>{
 assert.throws(()=>parseRoleCensus(markdown().replace('| BEN01 |','| INVENTED99 |')),/ROLE_BASELINE_CHANGED/);
 const swap=(first,second,field)=>{
  const records=structuredClone(baseline),a=records.find(x=>x.id===first),b=records.find(x=>x.id===second);
  [a[field],b[field]]=[b[field],a[field]];return markdown(records);
 };
 assert.throws(()=>parseRoleCensus(swap('BEN01','BEN-BASE-04','implementation_observation')),/ROLE_BASELINE_CHANGED/);
 assert.throws(()=>parseRoleCensus(swap('BEN01','NANCY-01','role')),/ROLE_BASELINE_CHANGED/);
 assert.throws(()=>parseRoleCensus(markdown([{id:'UNAPPROVED99',role:'unknown',implementation_observation:'implemented'},...baseline])),/UNKNOWN_SOURCE_ROLE/);
 assert.equal(parseRoleCensus(markdown([...baseline].reverse())).count,112,'Row ordering is not an approved requirement attribute');
});
test('route permission must belong to the same guarded handler',()=>{
 assert.equal(inspectRoute(decorated(),route).result,'SOURCE_DECORATORS_FOUND');
 assert.equal(inspectRoute(decorated('wrong.view'),route).result,'PERMISSION_DECORATOR_MISSING');
 assert.equal(inspectRoute(decorated(route[4],'@UseGuards(AuthGuard)'),route).result,'AUTH_PERMISSION_GUARDS_MISSING');
 assert.equal(inspectRoute(decorated().replace("@Post('"+route[3]+"')","@Post('different')"),route).result,'ROUTE_NOT_FOUND');
});
test('commented method/class decorators cannot count as active source protection',()=>{
 const guards='@UseGuards(AuthGuard, PermissionGuard)';
 assert.equal(inspectRoute(decorated().replace(guards,'// '+guards),route).result,'AUTH_PERMISSION_GUARDS_MISSING');
 const perm="@RequirePermissions('"+route[4]+"')";
 assert.equal(inspectRoute(decorated().replace(perm,'/* '+perm+' */'),route).result,'PERMISSION_DECORATOR_MISSING');
 const scoped="@Controller('x')\n// "+guards+"\nexport class Mock {\n@Post('"+route[3]+"')\n"+perm+"\nasync action(){}\n}";
 assert.equal(inspectRoute(scoped,route).result,'AUTH_PERMISSION_GUARDS_MISSING');
 const block=scoped.replace('// '+guards,'/* '+guards+' */');
 assert.equal(inspectRoute(block,route).result,'AUTH_PERMISSION_GUARDS_MISSING');
});
test('AST inspection uses each actual owning class and ignores comments/strings/malformed source',()=>{
 const perm="@RequirePermissions('"+route[4]+"')",path="@Post('"+route[3]+"')";
 const protectedClass="@Controller('a')\n@UseGuards(AuthGuard,PermissionGuard)\nexport class First { @Get('unrelated') async other(){} }\n";
 const target="@Controller('b')\nexport class Second { "+path+"\n"+perm+"\nasync action(){} }";
 assert.equal(inspectRoute(protectedClass+target,route).result,'AUTH_PERMISSION_GUARDS_MISSING');
 assert.equal(inspectRoute(decorated().replace("@Controller('test')","/* @Controller('test') */"),route).result,'CONTROLLER_DECORATOR_MISSING');
 assert.equal(inspectRoute(decorated().replace(path,'// '+path),route).result,'ROUTE_NOT_FOUND');
 assert.equal(inspectRoute(decorated().replace(path,'const fake="'+path+'";'),route).result,'ROUTE_NOT_FOUND');
 assert.equal(inspectRoute("@Controller('x')\n@UseGuards(AuthGuard,PermissionGuard)\nexport class Mock { "+path+"\n"+perm+"\nasync action(){} }",route).result,'SOURCE_DECORATORS_FOUND');
 assert.equal(inspectRoute(decorated().slice(0,-1),route).result,'SOURCE_PARSE_ERROR');
});
test('conflicting active route/permission decorators cannot hide the effective handler metadata',()=>{
 const path="@Post('"+route[3]+"')",perm="@RequirePermissions('"+route[4]+"')";
 assert.equal(inspectRoute(decorated().replace(path,path+"\n@Get('different')"),route).result,'AMBIGUOUS_ROUTE');
 assert.equal(inspectRoute(decorated().replace(perm,perm+"\n@RequirePermissions('wrong.view')"),route).result,'AMBIGUOUS_PERMISSION_DECORATORS');
});
test('green CI workflow source never implies branch protection is enforced',()=>{
 assert.equal(inspectWorkflow(ci).sourceWorkflowChecks,'PASS');
 assert.equal(inspectWorkflow(ci).mainProtected,'UNVERIFIED_FROM_SOURCE');
 assert.equal(inspectWorkflow(ci.replace('  validate:','  wrong:')).sourceWorkflowChecks,'FAILED');
});
test('workflow checks require the actual top-level mappings, not similarly named nested values',()=>{
 const decoy=ci.replace('  validate:','  replacement:')+'env:\n  validate: \"decoy\"\n';
 assert.equal(inspectWorkflow(decoy).sourceWorkflowChecks,'FAILED');
 const write=ci.replace('  contents: read','  contents: write')+'env:\n  contents: read\n';
 assert.equal(inspectWorkflow(write).sourceWorkflowChecks,'FAILED');
 const triggers=ci.replace('on:','env:');
 assert.equal(inspectWorkflow(triggers).sourceWorkflowChecks,'FAILED');
});
test('source PASS cannot certify retained permissions, human acceptance or go-live',async()=>{
 const fixtures=new Map([
  ['docs/ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md',markdown()],
  ['.github/workflows/validate.yml',ci],
 ]);
 for(const r of ROUTES){
  const file='apps/api/src/'+r[1];
  const options=r[5]||{},controller=options.controller||'x';
  const method=r[3]===''?'@'+r[2]+'()':'@'+r[2]+"('"+r[3]+"')";
  const guards=['AuthGuard',...(options.csrf?['CsrfGuard']:[]),'PermissionGuard'];
  const permissions=[r[4],...(options.extraPermissions||[])];
  fixtures.set(file,(fixtures.get(file)||"@Controller('"+controller+"')\nexport class Mock {\n")+
   method+'\n@UseGuards('+guards.join(', ')+')\n@RequirePermissions('+permissions.map(p=>"'"+p+"'").join(', ')+')\nasync action'+r[0]+'(){}\n');
 }
 let reads=0;
 const read=async path=>{reads++;const value=fixtures.get(path.replace(/^\/fake\//,''));if(typeof value!=='string')throw Error('UNEXPECTED_INPUT');return path.includes('/apps/api/')?value+'\n}':value;};
 const out=await auditSource('/fake',{read});
 assert.equal(out.status,'SOURCE_CHECKS_PASS_RUNTIME_UNVERIFIED');
 assert.equal(out.census.count,112);assert.equal(out.gl04.probes.length,ROUTES.length);
 assert.ok(out.gl04.actorReadbacks.every(a=>a.retainedConfiguration==='NOT_RUN'));
 assert.equal(out.productionAuthorized,false);assert.equal(out.goLiveGatesClosed,0);
 assert.equal(out.networkRequests,0);assert.ok(reads<=ROUTES.length+2);
 const file='apps/api/src/'+route[1];
 fixtures.set(file,fixtures.get(file).replace("@RequirePermissions('"+route[4]+"')","@RequirePermissions('wrong.view')"));
 const bad=await auditSource('/fake',{read});
 assert.equal(bad.status,'SOURCE_CHECK_FAILED');assert.ok(bad.anomalyCount>0);
});

const materialFixture=(r,{controller,permissions,guards,path}={})=>{
 const opts=r[5]||{},root=controller??opts.controller??'x';
 const rights=permissions??[r[4],...(opts.extraPermissions||[])];
 const checks=guards??['AuthGuard',...(opts.csrf?['CsrfGuard']:[]),'PermissionGuard'];
 const endpoint=path??r[3],method='@'+r[2]+(endpoint===''?'()':"('"+endpoint+"')");
 return "@Controller('"+root+"')\nexport class Mock {\n"+method+
  '\n@UseGuards('+checks.join(', ')+')\n@RequirePermissions('+
  rights.map(p=>"'"+p+"'").join(', ')+')\nasync action(){}\n}';
};
test('all nine material-request source routes retain required permissions, controller path and write CSRF',()=>{
 const routes=ROUTES.filter(r=>r[5]?.controller==='inventory/material-requests');
 assert.equal(routes.length,9);
 for(const r of routes){
  const source=materialFixture(r),rights=[r[4],...(r[5].extraPermissions||[])];
  assert.equal(inspectRoute(source,r).result,'SOURCE_DECORATORS_FOUND',r[0]);
  assert.equal(inspectRoute(materialFixture(r,{controller:'wrong-root'}),r).result,'CONTROLLER_PATH_MISMATCH',r[0]);
  assert.equal(inspectRoute(materialFixture(r,{path:'wrong-path'}),r).result,'ROUTE_NOT_FOUND',r[0]);
  for(const removed of rights)
   assert.equal(inspectRoute(materialFixture(r,{permissions:rights.filter(p=>p!==removed)}),r).result,'PERMISSION_DECORATOR_MISSING',r[0]+':'+removed);
  if(r[5].csrf){
   assert.equal(inspectRoute(materialFixture(r,{guards:['AuthGuard','PermissionGuard']}),r).result,'CSRF_GUARD_MISSING',r[0]);
   assert.equal(inspectRoute(materialFixture(r,{guards:['PermissionGuard','CsrfGuard']}),r).result,'AUTH_PERMISSION_GUARDS_MISSING',r[0]);
  }
 }
});
test('receipt check must not borrow evidence permission from another method',()=>{
 const r=ROUTES.find(r=>r[0]==='STORE_MR_RECEIPT'),source=materialFixture(r);
 const tampered=source.replace("'documents.document.view'","'unrelated.document.view'");
 assert.equal(inspectRoute(tampered,r).result,'PERMISSION_DECORATOR_MISSING');
 const decoy="\n@Get('decoy')\n@UseGuards(AuthGuard, CsrfGuard, PermissionGuard)\n@RequirePermissions('documents.document.view')\nasync other(){}\n";
 assert.equal(inspectRoute(tampered.replace('async action(){}','async action(){}'+decoy),r).result,'PERMISSION_DECORATOR_MISSING');
 assert.equal(inspectRoute(source.replace('CsrfGuard','/* CsrfGuard */'),r).result,'CSRF_GUARD_MISSING');
 assert.equal(inspectRoute(source.replace('@UseGuards(AuthGuard, CsrfGuard, PermissionGuard)','// @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)'),r).result,'AUTH_PERMISSION_GUARDS_MISSING');
});
