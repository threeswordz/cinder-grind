// Read-only preparation of the exact Event239 baseline; no session or fixture write.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_OPERATIONAL_'+c),{safeCode:'M6_OPERATIONAL_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=x=>createHash('sha256').update(x).digest('hex');
export function verifyCommittedBaseline(committed,retained,current){
 const old=Object.keys(retained).sort(),next=Object.keys(current).sort();
 need(old.length===173&&next.length===174&&same(next,[...old,'movement_correction_requests'].sort())&&old.includes('_prisma_migrations'),'TABLES');
 need(same(Object.keys(committed.before).sort(),next)&&same(Object.keys(committed.after).sort(),next),'RECEIPT_TABLES');
 need(same(committed.before.movement_correction_requests,[]),'NEW_TABLE');
 for(const t of old.filter(t=>t!=='_prisma_migrations'))need(same(retained[t],committed.before[t]),'RETAINED_BASELINE');
 for(const t of next)need(same(current[t],committed.after[t]),'COMMITTED_BASELINE');
 return true;
}
export function verifyRateBucketAdmission(before){
 const local=hash('login:127.0.0.1');
 need(Array.isArray(before?.buckets)&&/^\d+$/.test(before.clock??''),'RATE_STATE');
 // A pre-existing live local bucket might reject the first legitimate login.
 // Do not clear it or change the configured limit; stop before any session.
 need(!before.buckets.some(b=>b.key===local&&(!/^\d+$/.test(b.reset??'')||BigInt(b.reset)>BigInt(before.clock))),'LIVE_LOCAL_BUCKET');
 return true;
}
export function verifyOperationalAuthority(args){
 need(Array.isArray(args)&&args.length===4&&args[0]==='--run-authorized-operational-batch'&&/^[a-f0-9]{40}$/.test(args[1])&&typeof args[2]==='string'&&args[2].startsWith('/')&&args[3]==='--allow-bounded-login-rate-buckets','EXPLICIT_SCOPE');
 return {operatorSha:args[1],application:args[2],ownerAuthorizedSessions:true,allowBoundedRehearsalRateBucketChanges:true};
}
