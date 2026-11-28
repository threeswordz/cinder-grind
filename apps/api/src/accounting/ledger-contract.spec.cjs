const {test}=require('node:test');
const assert=require('node:assert/strict');
const c=require('./ledger-contract.js');
const debit={accountId:'a',companyId:'A',side:'DEBIT',amount:'0.10'};
const credit={accountId:'b',companyId:'A',side:'CREDIT',amount:'0.30'};
const lines=[debit,{...debit,amount:'0.20'},credit];
test('exact decimal journal balances without floating point rounding',()=>{
 assert.deepEqual(c.validateJournal('A',lines),{debit:'0.30',credit:'0.30'});
 assert.equal(c.thbSatang('9999999999999999.99'),999999999999999999n);
 for(const v of ['0','-1','1.001','1e2','01.00','NaN',' 1','10000000000000000'])assert.throws(()=>c.thbSatang(v));
});
test('Company mismatch, unbalanced, empty and invalid side denied',()=>{
 assert.throws(()=>c.validateJournal('B',lines));
 assert.throws(()=>c.validateJournal('A',[debit,credit]));
 assert.throws(()=>c.validateJournal('A',[]));
 assert.throws(()=>c.validateJournal('A',[{...debit,side:'X'},credit]));
});
test('reversal is a separate balanced journal and trial balance ties',()=>{
 const reversal=c.reverseJournal('A',lines);
 assert.equal(lines[0].side,'DEBIT');
 assert.equal(reversal[0].side,'CREDIT');
 assert.deepEqual(c.trialBalance('A',[lines,reversal]),[{accountId:'a',debit:'0.30',credit:'0.30',net:'0.00'},{accountId:'b',debit:'0.30',credit:'0.30',net:'0.00'}]);
});
