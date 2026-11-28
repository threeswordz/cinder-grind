import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {satangText,trialBalance,type JournalLine} from './ledger-contract';

test('ACC01 synthetic native journal persistence; exact atomic amounts, Company and reversal boundaries',async t=>{
 const db=new PrismaService();await db.$connect();
 try{
  const suffix=randomUUID().slice(0,8);
  const a=await db.company.create({data:{companyCode:'GL-A-'+suffix,companyName:'Synthetic ledger A'}});
  const b=await db.company.create({data:{companyCode:'GL-B-'+suffix,companyName:'Synthetic ledger B'}});
  const actor=await db.user.create({data:{companyId:a.id,email:'gl-'+suffix+'@example.invalid',displayName:'Synthetic ledger actor',passwordHash:'not-a-login'}});
  const account=async(companyId:string,code:string,accountType:string)=>db.glAccount.create({data:{companyId,code,name:'Synthetic '+code,accountType}});
  const debit=await account(a.id,'A1','ASSET'),credit=await account(a.id,'E1','EQUITY'),foreign=await account(b.id,'A1','ASSET');
  const period=await db.glPeriod.create({data:{companyId:a.id,startDate:new Date('2026-11-01'),endDate:new Date('2026-11-30')}});
  const foreignPeriod=await db.glPeriod.create({data:{companyId:b.id,startDate:new Date('2026-11-01'),endDate:new Date('2026-11-30')}});
  const rule=await db.glRuleRevision.create({data:{companyId:a.id,ruleCode:'SYNTHETIC',version:1,sourceType:'SYNTHETIC_GENERAL',evidenceReference:'DISPOSABLE_NATIVE_TEST_ONLY'}});
  const before=await Promise.all([db.payment.count(),db.supplierInvoice.count(),db.clientInvoice.count(),db.directCostPosting.count(),db.stockTransaction.count()]);
  type Line={accountId:string;side:string;amountSatang:bigint;projectId?:string};
  const lines:Line[]=[{accountId:debit.id,side:'DEBIT',amountSatang:10n},{accountId:debit.id,side:'DEBIT',amountSatang:20n},{accountId:credit.id,side:'CREDIT',amountSatang:30n}];
  const entryKey='SYNTHETIC:'+randomUUID();
  function append(sourceEventKey:string,items:Line[],overrides:Partial<Prisma.GlJournalUncheckedCreateInput>={},seal=true){
    return db.$transaction(async tx=>{
     const j=await tx.glJournal.create({data:{companyId:a.id,periodId:period.id,ruleRevisionId:rule.id,sourceEventKey,sourceType:'SYNTHETIC_GENERAL',postingDate:new Date('2026-11-20'),actorUserId:actor.id,...overrides}});
     if(items.length)await tx.glJournalLine.createMany({data:items.map((l,i)=>({...l,companyId:a.id,journalId:j.id,lineNo:i+1}))});
     if(seal)return tx.glJournal.update({where:{id:j.id},data:{sealedAt:new Date()}});
     return j;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
  let original:Awaited<ReturnType<typeof append>>;
  await t.test('atomic sealed balanced journal, no unsealed or unbalanced partial rows',async()=>{
    await assert.rejects(append('UNSEALED',lines,{},false));
    await assert.rejects(append('EMPTY',[]));
    await assert.rejects(append('UNBALANCED',[lines[0]!,lines[2]!]));
    await assert.rejects(append('NEGATIVE',[{...lines[0]!,amountSatang:-10n},lines[2]!]));
    await assert.rejects(append('FOREIGN_ACCOUNT',[{...lines[0]!,accountId:foreign.id},lines[1]!,lines[2]!]));
    await assert.rejects(append('FOREIGN_PERIOD',lines,{periodId:foreignPeriod.id}));
    await assert.rejects(append('WRONG_RULE',lines,{sourceType:'WRONG'}));
    await assert.rejects(append('WRONG_CURRENCY',lines,{currencyCode:'USD'}));
    assert.equal(await db.glJournal.count({where:{companyId:a.id}}),0);
    original=await append(entryKey,lines);
    assert.ok(original.sealedAt);
    assert.equal(await db.glJournalLine.count({where:{journalId:original.id}}),3);
    await assert.rejects(append(entryKey,lines));
    await assert.rejects(db.glJournal.update({where:{id:original.id},data:{sourceEventKey:'overwrite'}}));
    const first=await db.glJournalLine.findFirstOrThrow({where:{journalId:original.id}});
    await assert.rejects(db.glJournalLine.update({where:{id:first.id},data:{amountSatang:99n}}));
    await assert.rejects(db.glJournalLine.create({data:{companyId:a.id,journalId:original.id,lineNo:4,accountId:credit.id,side:'CREDIT',amountSatang:1n}}));
    await assert.rejects(db.glJournal.delete({where:{id:original.id}}));
    await assert.rejects(db.glRuleRevision.update({where:{id:rule.id},data:{evidenceReference:'overwrite'}}));
  });
  await t.test('exact linked reversal, duplicate rejection, tie-out, and closed periods',async()=>{
    await assert.rejects(append('BAD_REVERSAL',lines,{reversesJournalId:original.id}));
    const inverse=lines.map(l=>({...l,side:l.side==='DEBIT'?'CREDIT':'DEBIT'}));
    const reversed=await append('REVERSAL',inverse,{reversesJournalId:original.id});
    assert.equal(reversed.reversesJournalId,original.id);
    await assert.rejects(append('DUP_REVERSAL',inverse,{reversesJournalId:original.id}));
    const posted=await db.glJournal.findMany({where:{companyId:a.id,sealedAt:{not:null}},include:{lines:true}});
    const projected:JournalLine[][]=posted.map(j=>j.lines.map(l=>({companyId:l.companyId,accountId:l.accountId,side:l.side as JournalLine['side'],amount:satangText(l.amountSatang)})));
    assert.equal(posted.length,2);
    assert.ok(trialBalance(a.id,projected).every(x=>x.net==='0.00'));
    await assert.rejects(db.glPeriod.create({data:{companyId:a.id,startDate:new Date('2026-11-15'),endDate:new Date('2026-12-15')}}));
    await db.glPeriod.update({where:{id:period.id},data:{closedAt:new Date()}});
    await assert.rejects(append('CLOSED_PERIOD',lines));
    await assert.rejects(db.glPeriod.update({where:{id:period.id},data:{closedAt:null}}));
    assert.deepEqual(await Promise.all([db.payment.count(),db.supplierInvoice.count(),db.clientInvoice.count(),db.directCostPosting.count(),db.stockTransaction.count()]),before);
  });
 }finally{await db.$disconnect();}
});
