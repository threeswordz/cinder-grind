import test from 'node:test';
import assert from 'node:assert/strict';
import {successorPrivacyHeaders as check} from './m6-successor-privacy-headers.mjs';
const api='http://127.0.0.1:33072';
const response=(cache='no-store',status=200,extra={})=>new Response(null,{status,headers:{'Cache-Control':cache,'X-Content-Type-Options':'nosniff',...extra}});
test('pinned successful identity control accepts canonical no-store',()=>assert.equal(check(response(),'/auth/me',api),true));
test('data, denials and retained origin still require private no-store',()=>{for(const [r,p,o] of [[response(),'/hr/companies/x/employees/y/documents',api],[response('no-store',403),'/auth/me',api],[response(),'/auth/me','http://127.0.0.1:33071']])assert.equal(check(r,p,o),false);assert.equal(check(response('private, no-store'),'/hr/documents',api),true);});
test('public caching, attachment or missing nosniff rejected for identity as well',()=>{for(const r of [response('public, no-store'),response('private'),response('no-store',200,{'Content-Disposition':'attachment'}),response('no-store',200,{'X-Content-Type-Options':'none'})])assert.equal(check(r,'/auth/me',api),false);});
