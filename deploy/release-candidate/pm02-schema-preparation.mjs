// PM02 exact additive review metadata. Standalone preparation guard only:
// global rehearsal admission remains fail-closed until all consumers are wired.
export const pm02Fields=Object.freeze([
  "reviewDecision String? @map(\"review_decision\") @db.VarChar(20)",
  "reviewReason String? @map(\"review_reason\") @db.Text",
  "reviewedByUserId String? @map(\"reviewed_by_user_id\") @db.Uuid",
  "reviewedAt DateTime? @map(\"reviewed_at\") @db.Timestamptz(6)",
  "correctionSourceLineId String? @unique @map(\"correction_source_line_id\") @db.Uuid"
]);
const comments=["// PM02: NULL means legacy all-lines-approved behavior when the parent is approved.","// New mixed reviews explicitly set APPROVED or RETURNED on *every* source line."];
export const pm02Migrations=Object.freeze({
  "20261123143000_pm02_partial_pr_line_review": "c7e904fea47fab743cb6af684fc55cb0363a4c85",
  "20261123163500_pm02_review_trigger_scope": "160d8c0debca75269b4a0f0497c8fdfc74378773"
});
export const pm02Columns=Object.freeze(['review_decision','review_reason','reviewed_by_user_id','reviewed_at','correction_source_line_id']);
export const normalizeSchema=s=>s.split(/\r?\n/).map(x=>x.trim().replace(/\s+/g,' ')).filter(Boolean).join('\n');
export function stripPm02Schema(schema){
 const seen=new Set();let models=0;
 const text=schema.replace(/^model PurchaseRequestLine \{[\s\S]*?^\}/gm,block=>{
  models++;
  return block.split('\n').filter(line=>{
   const value=line.trim().replace(/\s+/g,' ');
   if(!pm02Fields.includes(value)&&!comments.includes(value))return true;
   if(seen.has(value))throw Error('Duplicate PM02 schema declaration: '+value);
   seen.add(value);return false;
  }).join('\n');
 });
 if(models!==1)throw Error('Exactly one PurchaseRequestLine model required');
 if(seen.size!==0&&seen.size!==pm02Fields.length+comments.length)throw Error('Partial or modified PM02 metadata');
 return {text,present:seen.size!==0};
}
export function assertExactPm02Increment(previous,candidate){
 const a=stripPm02Schema(previous),b=stripPm02Schema(candidate);
 if(a.present||!b.present||normalizeSchema(a.text)!==normalizeSchema(b.text))
   throw Error('Not the exact forward-only PM02 schema increment');
 return true;
}

// Explicit outer layer; no generic exemption for unknown successor modes.
export function pm02Mode(mode){
 const prefix='migration-aware-pm02-';
 if(typeof mode!=='string'||!mode.startsWith(prefix))return {present:false,prior:mode};
 return {present:true,prior:mode===prefix+'schema'?'migration-aware-sql-only':'migration-aware-'+mode.slice(prefix.length)};
}
