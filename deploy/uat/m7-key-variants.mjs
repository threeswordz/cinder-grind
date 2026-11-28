import {m7RestorePortAllowed} from './m7-source-process.mjs';
// Preparation only: orchestrate two independently restored negative-key targets.
// Never edit the source or correct-key target; no native launcher or stage admission.
import {isAbsolute,relative,resolve} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Error('M7_VARIANTS_'+c);};
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const path=v=>typeof v==='string'&&isAbsolute(v)&&resolve(v)===v&&v!=='/';
const inside=(a,b)=>{const r=relative(a,b);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'));};
const disjoint=(a,b)=>!inside(a,b)&&!inside(b,a);
const fields=['appSha','tree','manifestSha','schemaSha','rowsSha','documentsSha','uploadsSha','ciphertextSha'];
const valid=p=>p&&/^[a-f0-9]{40}$/.test(p.appSha)&&/^[a-f0-9]{40}$/.test(p.tree)&&fields.slice(2).every(k=>digest(p[k]))&&digest(p.keyInventorySha)&&typeof p.cluster==='string'&&/^\d+$/.test(p.cluster)&&Number.isSafeInteger(p.oid)&&p.oid>0&&typeof p.database==='string'&&typeof p.role==='string'&&path(p.root)&&path(p.keyRoot)&&inside(p.root,p.keyRoot)&&m7RestorePortAllowed(p.port);
const matches=(p,o)=>valid(o)&&[...fields,'keyInventorySha','cluster','oid','database','role','root','keyRoot','port','mode'].every(k=>p[k]===o[k])&&o.isolated===true;
const safe=e=>/^M7_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'M7_VARIANTS_UNEXPECTED';
export function createM7KeyVariantSequence({correct,variants,protectedRoots,verifyCorrectAndSource,adapter}){
  need(valid(correct)&&correct.mode==='correct'&&Array.isArray(variants)&&variants.length===2&&variants[0]?.mode==='missing'&&variants[1]?.mode==='wrong'&&variants.every(valid),'PLAN');
  need(Array.isArray(protectedRoots)&&protectedRoots.length>0&&protectedRoots.every(path)&&['inspect','launch','verifyHttp','verifyStartupDenial','verifyPersisted','stopOwned','portFree'].every(k=>typeof adapter?.[k]==='function')&&typeof verifyCorrectAndSource==='function','CONTEXT');
  const c=structuredClone(correct),plans=structuredClone(variants),roots=[...protectedRoots];
  const all=[c,...plans];
  need(plans.every(p=>fields.every(k=>p[k]===c[k])&&p.keyInventorySha!==c.keyInventorySha&&roots.every(r=>disjoint(r,p.root)))&&new Set(all.map(p=>p.keyInventorySha)).size===3,'CAPTURE_BINDING');
  need(all.every((p,i)=>all.every((q,j)=>i===j||(p.port!==q.port&&p.database!==q.database&&p.role!==q.role&&(p.cluster!==q.cluster||p.oid!==q.oid)&&disjoint(p.root,q.root)))),'TARGET_ALIAS');
  let attempted=false;
  return async function runOnce(){
    need(!attempted,'ALREADY_ATTEMPTED');attempted=true;const results=[];
    for(const p of plans){let handle,started=false,primary=null,cleanup=null,denial=null;
      try{
        need(await verifyCorrectAndSource()===true,'SOURCE_DRIFT');
        const before=await adapter.inspect(p);need(matches(p,before)&&before.activeSessions===0&&before.portFree===true,'TARGET_BEFORE');
        started=true;handle=await adapter.launch(p);
        if(handle?.status==='STARTUP_DENIED'){
          // A generic crash is not a key denial. Independent native inspector must
          // confirm the reviewed key-specific failure, absence of listener/mutation.
          need(await adapter.verifyStartupDenial(p,handle)===true,'STARTUP_DENIAL');denial='startup';
        }else{
          const running=await adapter.inspect(p);need(matches(p,running)&&Number.isSafeInteger(handle?.pid)&&handle.pid>1&&running.pid===handle.pid&&running.listener==='127.0.0.1:'+p.port&&running.healthy===true,'RUNNING_IDENTITY');
          const h=await adapter.verifyHttp(p,handle);need(h?.status==='M7_VERIFICATION_PREPARATION_CHECK_PASS'&&h.keyMode===p.mode&&h.keyDenialVerified===true&&h.hrPlaintextVerified===false&&h.sessionsRevoked===true&&h.preservationMatched===true,'HTTP_DENIAL');denial='http';
        }
        need(await adapter.verifyPersisted(p,denial)===true,'PERSISTED');
      }catch(e){primary=safe(e);}
      finally{
        if(started){try{need(await adapter.stopOwned(p,handle)===true&&await adapter.portFree(p.port)===true,'CLEANUP');}catch(e){cleanup=safe(e);}}
        try{need(await verifyCorrectAndSource()===true,'SOURCE_DRIFT');const after=await adapter.inspect(p);need(matches(p,after)&&after.activeSessions===0&&after.portFree===true,'TARGET_AFTER');}catch(e){cleanup??=safe(e);}
      }
      results.push(Object.freeze({mode:p.mode,denial,primary,cleanup}));
      if(primary||cleanup)break; // no automatic retry or next mode after a failure
    }
    return Object.freeze({status:results.length===2&&results.every(r=>!r.primary&&!r.cleanup)?'M7_KEY_VARIANT_PREPARATION_PASS':'M7_KEY_VARIANT_PREPARATION_BLOCKED',results:Object.freeze(results),nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
  };
}
