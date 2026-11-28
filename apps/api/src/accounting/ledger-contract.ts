/** ACC01 synthetic ledger domain only. Exact THB satang arithmetic. No
 * operational posting, bank movement, tax rule or account mapping activated. */
export type Side='DEBIT'|'CREDIT';
export type JournalLine=Readonly<{accountId:string;companyId:string;side:Side;amount:string}>;
const max=999999999999999999n;
export function thbSatang(amount:string):bigint {
  if(typeof amount!=='string'||!/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$/.test(amount))throw new Error('GL_AMOUNT_INVALID');
  const [whole,fraction='']=amount.split('.');
  const result=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'));
  if(result<=0n||result>max)throw new Error('GL_AMOUNT_INVALID');
  return result;
}
export function satangText(value:bigint):string {
  const abs=value<0n?-value:value;
  return (value<0n?'-':'')+(abs/100n).toString()+'.'+(abs%100n).toString().padStart(2,'0');
}
export function validateJournal(companyId:string,lines:readonly JournalLine[]) {
  if(!companyId||!Array.isArray(lines)||lines.length<2||lines.length>1000)throw new Error('GL_JOURNAL_INVALID');
  let debit=0n,credit=0n;
  for(const l of lines){
    if(!l.accountId||l.companyId!==companyId||!['DEBIT','CREDIT'].includes(l.side))throw new Error('GL_LINE_SCOPE_INVALID');
    const value=thbSatang(l.amount);
    if(l.side==='DEBIT')debit+=value;else credit+=value;
  }
  if(debit!==credit||debit>max)throw new Error('GL_JOURNAL_UNBALANCED');
  return {debit:satangText(debit),credit:satangText(credit)};
}
export function reverseJournal(companyId:string,lines:readonly JournalLine[]):JournalLine[]{
  validateJournal(companyId,lines);
  return lines.map(l=>({...l,side:l.side==='DEBIT'?'CREDIT':'DEBIT'}));
}
/** Caller resolves posted immutable journals only and enforces Company view. */
export function trialBalance(companyId:string,journals:readonly (readonly JournalLine[])[]) {
  const totals=new Map<string,{debit:bigint;credit:bigint}>();
  for(const journal of journals){
    validateJournal(companyId,journal);
    for(const l of journal){
      const total=totals.get(l.accountId)??{debit:0n,credit:0n};
      if(l.side==='DEBIT')total.debit+=thbSatang(l.amount);else total.credit+=thbSatang(l.amount);
      totals.set(l.accountId,total);
    }
  }
  return [...totals.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([accountId,t])=>({accountId,debit:satangText(t.debit),credit:satangText(t.credit),net:satangText(t.debit-t.credit)}));
}
