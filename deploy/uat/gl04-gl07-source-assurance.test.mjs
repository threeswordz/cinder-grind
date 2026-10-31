import assert from 'node:assert/strict';
import test from 'node:test';
import {ROLE_COUNTS,SOURCE_STATES,ROUTES,parseRoleCensus,inspectRoute,inspectWorkflow,auditSource} from './gl04-gl07-source-assurance.mjs';

const markdown=()=>{
 const ids=Object.entries(ROLE_COUNTS).flatMap(([role,n])=>Array.from({length:n},(_,i)=>[role.toUpperCase()+'-'+String(i).padStart(2,'0'),role]));
 const states=Object.entries(SOURCE_STATES).flatMap(([status,n])=>Array(n).fill(status));
 return ids.map(([id,role],i)=>'| '+id+' | '+role+' | Synthetic | L0 | '+states[i]+' | OPERATIONAL_REVIEW_ONLY |').join('\n');
};
const route=ROUTES[0];
const decorated=(perm=route[4],guards='@UseGuards(AuthGuard, PermissionGuard)')=>
 "@Controller('test')\nexport class Mock {\n@Post('"+route[3]+"')\n"+guards+"\n@RequirePermissions('"+perm+"')\nasync action(){}\n@Get('other')\n@RequirePermissions('"+route[4]+"')\nasync other(){}\n}";
const ci='on:\n  pull_request:\n  push:\npermissions:\n  contents: read\njobs:\n  validate:\n';

test('baseline must preserve all 112 distinct IDs and source classifications',()=>{
 const c=parseRoleCensus(markdown());
 assert.equal(c.count,112);assert.equal(c.roles.store,21);assert.equal(c.states['partially implemented'],67);
 assert.throws(()=>parseRoleCensus(markdown().replace('BEN-00','BEN-01')),/DUPLICATE_STABLE_ID/);
 assert.throws(()=>parseRoleCensus(markdown().replace('partially implemented','implemented')),/ROLE_BASELINE_CHANGED/);
});
test('route permission must belong to the same guarded handler',()=>{
 assert.equal(inspectRoute(decorated(),route).result,'SOURCE_DECORATORS_FOUND');
 assert.equal(inspectRoute(decorated('wrong.view'),route).result,'PERMISSION_DECORATOR_MISSING');
 assert.equal(inspectRoute(decorated(route[4],'@UseGuards(AuthGuard)'),route).result,'AUTH_PERMISSION_GUARDS_MISSING');
 assert.equal(inspectRoute(decorated().replace("@Post('"+route[3]+"')","@Post('different')"),route).result,'ROUTE_NOT_FOUND');
});
test('green CI workflow source never implies branch protection is enforced',()=>{
 assert.equal(inspectWorkflow(ci).sourceWorkflowChecks,'PASS');
 assert.equal(inspectWorkflow(ci).mainProtected,'UNVERIFIED_FROM_SOURCE');
 assert.equal(inspectWorkflow(ci.replace('  validate:','  wrong:')).sourceWorkflowChecks,'FAILED');
});
test('source PASS cannot certify retained permissions, human acceptance or go-live',async()=>{
 const fixtures=new Map([
  ['docs/ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md',markdown()],
  ['.github/workflows/validate.yml',ci],
 ]);
 for(const r of ROUTES){
  const file='apps/api/src/'+r[1];
  fixtures.set(file,(fixtures.get(file)||"@Controller('x')\nexport class Mock {\n")+
   '@'+r[2]+"('"+r[3]+"')\n@UseGuards(AuthGuard, PermissionGuard)\n@RequirePermissions('"+r[4]+"')\nasync action"+r[0]+"(){}\n");
 }
 let reads=0;
 const read=async path=>{reads++;const value=fixtures.get(path.replace(/^\/fake\//,''));if(typeof value!=='string')throw Error('UNEXPECTED_INPUT');return value;};
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
