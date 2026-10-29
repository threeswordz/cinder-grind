import assert from 'node:assert/strict';
import test from 'node:test';
import {Prisma} from '@prisma/client';
import {ProjectSummaryService,PROJECT_SUMMARY_VIEW} from './project-summary.service';

test('Project summary preserves canonical variation reversals and exact large totals without exposing a source graph',async()=>{
  const tx={user:{findFirst:async()=>({userRoles:[{role:{companyId:'c',isActive:true,roleCode:'FINANCE',rolePermissions:[{permission:{permissionCode:PROJECT_SUMMARY_VIEW}}]}}]})},
    project:{findFirst:async()=>({id:'p',projectCode:'P',projectName:'Project',contractValue:new Prisma.Decimal('9999999999999999.99'),contractCurrencyCode:'THB'})},
    company:{findUniqueOrThrow:async()=>({baseCurrencyCode:'THB'})},
    projectVariation:{findMany:async()=>[{id:'active',valueDelta:new Prisma.Decimal('.01'),reversesVariationId:null,currencyCode:'THB'},{id:'old',valueDelta:new Prisma.Decimal('500'),reversesVariationId:null,currencyCode:'THB'},{id:'reverse',valueDelta:new Prisma.Decimal('-500'),reversesVariationId:'old',currencyCode:'THB'}]},
    clientInvoice:{findMany:async()=>[{totalAmount:new Prisma.Decimal('9999999999999999.99'),currencyCode:'THB'},{totalAmount:new Prisma.Decimal('.01'),currencyCode:'THB'}]},
    payment:{findMany:async()=>[{amount:new Prisma.Decimal('0.10'),currencyCode:'THB'},{amount:new Prisma.Decimal('0.20'),currencyCode:'THB'}]},
  };
  const db={$transaction:async(fn:any,options:any)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx);}};
  const service=new ProjectSummaryService(db as never,{assertAccess:async()=>{}} as never);
  const auth={userId:'u',companyId:'c',permissions:[]} as never;
  const summary=await service.summary(auth,'p');
  assert.deepEqual(summary,{project:{id:'p',projectCode:'P',projectName:'Project'},currencyCode:'THB',contractAmount:'10000000000000000.00',billedAmount:'10000000000000000.00',receivedAmount:'0.30'});
  tx.company.findUniqueOrThrow=async()=>({baseCurrencyCode:'SGD'});
  await assert.rejects(service.summary(auth,'p'),(e:any)=>e.getResponse().code==='PROJECT_SUMMARY_CURRENCY_UNVERIFIED');
  tx.company.findUniqueOrThrow=async()=>({baseCurrencyCode:'THB'});
  tx.payment.findMany=async()=>[{amount:new Prisma.Decimal('1'),currencyCode:'SGD'}];
  await assert.rejects(service.summary(auth,'p'),(e:any)=>e.getResponse().code==='PROJECT_SUMMARY_CURRENCY_UNVERIFIED');
  tx.user.findFirst=async()=>({userRoles:[]});
  await assert.rejects(service.summary({...auth as any,permissions:[PROJECT_SUMMARY_VIEW]} as never,'p'),(e:any)=>e.getResponse().code==='PROJECT_SUMMARY_PERMISSION_DENIED');
});


test('zero Project totals remain distinct from missing currency provenance',async()=>{
  for(const currency of ['THB',null]){
    const tx={user:{findFirst:async()=>({userRoles:[{role:{companyId:'c',isActive:true,roleCode:'SUMMARY',rolePermissions:[{permission:{permissionCode:PROJECT_SUMMARY_VIEW}}]}}]})},
      project:{findFirst:async()=>({id:'p',projectCode:'P',projectName:'Project',contractValue:new Prisma.Decimal(0),contractCurrencyCode:currency})},company:{findUniqueOrThrow:async()=>({baseCurrencyCode:'THB'})},projectVariation:{findMany:async()=>[]},clientInvoice:{findMany:async()=>[]},payment:{findMany:async()=>[]}};
    const service=new ProjectSummaryService({$transaction:async(fn:any)=>fn(tx)} as never,{assertAccess:async()=>{}} as never);
    if(currency===null)await assert.rejects(service.summary({userId:'u',companyId:'c'} as never,'p'),(e:any)=>e.getResponse().code==='PROJECT_SUMMARY_CURRENCY_UNVERIFIED');
    else{const result=await service.summary({userId:'u',companyId:'c'} as never,'p');assert.equal(result.contractAmount,'0.00');assert.equal(result.billedAmount,'0.00');assert.equal(result.receivedAmount,'0.00');}
  }
});
