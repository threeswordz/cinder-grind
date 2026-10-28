import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { quantityRecord, assertCostReportDisclosure } from './budget-disclosure';
import { BudgetDisclosureInterceptor } from './budget-disclosure.interceptor';
import { canonicalUuid, customerDraft } from './customer-boq-validation';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor=(permissions:string[])=>({permissions} as AuthenticatedUserContext);

test('quantity projection excludes nested financial values, notes, approval comments and unknown future fields',()=>{
  const input={id,boqName:'Work',currencyCode:'THB',totalAmount:'900.00',revisionNote:'SECRET',futureProfit:'888',
    project:{id,projectCode:'P',projectName:'Project',contractValue:'777'},
    approvalInstance:{id,approvalState:'APPROVED',actions:[{comment:'SECRET'}]},
    sections:[{id,sectionCode:'A',description:'SECRET SECTION NOTE'}],
    lines:[{id,description:'Work',quantity:'1.2345',uomCode:'M',rate:'123.4567',amount:'152.00',notes:'SECRET',
      uom:{id,uomCode:'M',decimalPlaces:4,price:'999'},costCode:{id,costCode:'C',costName:'Code',margin:'100'}}]};
  const output=quantityRecord(input) as typeof input;
  assert.deepEqual(output.lines[0],{id,description:'Work',quantity:'1.2345',uomCode:'M',uom:{id,uomCode:'M',decimalPlaces:4},costCode:{id,costCode:'C',costName:'Code'}});
  assert.deepEqual(output.project,{id,projectCode:'P',projectName:'Project'});
  assert.deepEqual(output.approvalInstance,{id,approvalState:'APPROVED'});
  // Item descriptions are canonical work labels; section free text is never a quantity label.
  assert.doesNotMatch(JSON.stringify(output),/900|888|777|SECRET|123\.4567|152\.00|999|margin|currency/);
  assert.equal(quantityRecord(null),null);
});

test('quantity plus report authority cannot reveal protected Budget costs; explicit full revision authority and legacy report roles are preserved',()=>{
  for(const extra of [[],['cost.control.view'],['management.dashboard.view'],['budget.customer.view'],['budget.boq.manage'],['budget.boq.view']])
    assert.throws(()=>assertCostReportDisclosure(actor(['budget.quantity.view',...extra])),ForbiddenException);
  assert.doesNotThrow(()=>assertCostReportDisclosure(actor(['cost.control.view'])));
  assert.doesNotThrow(()=>assertCostReportDisclosure(actor(['budget.quantity.view','budget.revision.view'])));
});

test('action-only Budget mutation responses are minimal while explicit full reads retain their existing contract',async()=>{
  const value={data:{id,projectId:id,revisionNo:2,revisionNumber:'R2',lifecycleState:'DRAFT',totalAmount:'123',rate:'456',revisionNote:'SECRET',lines:[{amount:'789'}]}};
  const run=(url:string,method:string,permissions:string[])=>firstValueFrom(new BudgetDisclosureInterceptor().intercept({switchToHttp:()=>({getRequest:()=>({url,method,auth:actor(permissions)})})} as ExecutionContext,{handle:()=>of(value)}));
  for(const url of ['/api/v1/budget/revisions/'+id+'/approve','/api/v1/budget/projects/'+id+'/revisions']) {
    const result=await run(url,'POST',['budget.quantity.view','budget.revision.approve','budget.boq.view']);
    assert.doesNotMatch(JSON.stringify(result),/123|456|789|SECRET|totalAmount|lines/);
    assert.equal((result.data as {id:string}).id,id);
    assert.deepEqual(await run(url,'POST',['budget.revision.view']),value);
  }
  assert.doesNotMatch(JSON.stringify(await run('/budget/items/'+id,'PATCH',['budget.boq.manage','budget.revision.view'])),/123|456|789|SECRET/);
  assert.deepEqual(await run('/budget/items/'+id,'PATCH',['budget.boq.view']),value);
  assert.deepEqual(await run('/budget/projects','GET',[]),value,'read guard remains responsible for GET authorization');
});

test('Customer BOQ transport accepts exact decimal strings and rejects caller-owned precision, prior rate, numeric money and unknown mapping fields',()=>{
  const draft=()=>({sourceRevisionId:id,reason:'Offer',lines:[{lineId:id,description:'Work',quantity:'1',uomId:id,method:'MANUAL',manualRate:'0',zeroPriceReason:'Included',mappings:[{sourceLineId:id,sharePercent:'100'}]}]});
  assert.equal(customerDraft(draft()).lines[0]!.manualRate,'0');
  assert.equal(canonicalUuid(id.toUpperCase(),'id'),id);
  for(const [field,value] of [['previousRate','1'],['uomDecimalPlaces',4],['quantity',1],['manualRate',1],['method','GROSS_MARGIN']] as const){
    const bad=draft();Object.assign(bad.lines[0]!,{[field]:value});assert.throws(()=>customerDraft(bad),UnprocessableEntityException);
  }
  const bad=draft();Object.assign(bad.lines[0]!.mappings[0]!,{allocatedCost:'1'});assert.throws(()=>customerDraft(bad),UnprocessableEntityException);
  assert.throws(()=>customerDraft({...draft(),totalAmount:'1'}),UnprocessableEntityException);
});
