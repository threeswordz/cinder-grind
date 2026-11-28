// Preparation contract only: no native capture, restore, or milestone admission.
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw new Error('M7_CONTRACT_'+code);};
const hex=(v,n)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const kinds=['documents','uploads','hrkeys'];
const fields=['schemaSha','rowsSha','documentsSha','uploadsSha','hrkeysSha'];
function inventoryHash(rows){
  need(Array.isArray(rows)&&rows.length>0,'INVENTORY');
  const seen=new Map();
  for(const row of rows){
    const p=row?.[0];
    need(Array.isArray(row)&&typeof p==='string'&&!p.includes('\\')&&!p.includes('\0')&&(p===''||p.split('/').every(x=>x&&x!=='.'&&x!=='..'))&&!seen.has(p),'INVENTORY');
    need((row.length===2&&row[1]==='directory')||(p!==''&&row.length===3&&Number.isSafeInteger(row[1])&&row[1]>=0&&hex(row[2],64)),'INVENTORY');
    seen.set(p,row);
  }
  need(seen.get('')?.[1]==='directory','INVENTORY');
  for(const p of seen.keys())if(p!=='')need(seen.get(p.includes('/')?p.slice(0,p.lastIndexOf('/')):'')?.[1]==='directory','INVENTORY');
  return hash([...seen.values()].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0));
}
function dbTuple(d){
  need(typeof d?.cluster==='string'&&/^\d+$/.test(d.cluster)&&Number.isSafeInteger(d.oid)&&d.oid>0&&typeof d.database==='string'&&d.database.length>0&&typeof d.role==='string'&&d.role.length>0,'DATABASE');
  return [d.cluster,d.oid,d.database,d.role];
}
// The external witness digest must come from independently collected native evidence.
// The caller must use Lane01's verifyM7PairedManifest, not a self-issued success flag.
export async function bindM7Capture({manifestArgs,witness,witnessSha256,verifyManifest}){
  need(typeof verifyManifest==='function'&&hex(witnessSha256,64),'WITNESS');
  const m=structuredClone(manifestArgs), w=structuredClone(witness), e=m?.evidence;
  need(hex(m?.manifestSha256,64)&&hex(e?.applicationSha,40)&&hex(e?.dumpSha256,64)&&hex(e?.databaseIdentitySha256,64)&&hex(e?.storageIdentitySha256,64)&&hex(e?.quiescenceReceiptSha256,64)&&hex(e?.beforeStateSha256,64)&&e.beforeStateSha256===e.afterStateSha256,'MANIFEST');
  need(w?.applicationSha===e.applicationSha&&hex(w.tree,40)&&w.manifestSha256===m.manifestSha256&&w.dumpSha===e.dumpSha256&&w.databaseIdentitySha256===e.databaseIdentitySha256&&w.storageIdentitySha256===e.storageIdentitySha256&&w.quiescenceReceiptSha256===e.quiescenceReceiptSha256&&w.stateSha256===e.beforeStateSha256&&hex(w.schemaSha,64)&&hex(w.rowsSha,64)&&Number.isSafeInteger(w.sourceProcess?.pid)&&w.sourceProcess.pid>1,'WITNESS_BINDING');
  const db=dbTuple(w.sourceDatabase);
  const inventories=Object.fromEntries(kinds.map(k=>[k+'Sha',inventoryHash(m.expectedInventories?.[k])]));
  need(kinds.every(k=>w[k+'Sha']===inventories[k+'Sha']),'INVENTORY_BINDING');
  const witnessTuple=[w.applicationSha,w.tree,w.manifestSha256,w.dumpSha,w.databaseIdentitySha256,w.storageIdentitySha256,w.quiescenceReceiptSha256,w.stateSha256,w.schemaSha,w.rowsSha,...kinds.map(k=>inventories[k+'Sha']),db,w.sourceProcess.pid];
  need(hash(witnessTuple)===witnessSha256,'WITNESS_DIGEST');
  const reverify=async()=>{need(await verifyManifest(structuredClone(m))===true,'MANIFEST_RECHECK');};
  await reverify();
  const capture={sha:w.applicationSha,tree:w.tree,dumpSha:w.dumpSha,schemaSha:w.schemaSha,rowsSha:w.rowsSha,...inventories,sourceDatabase:{cluster:db[0],oid:db[1],database:db[2],role:db[3]},sourceProcess:{pid:w.sourceProcess.pid}};
  // Keep immutable expected state private. Restore's adapter must collect observations anew.
  return Object.freeze({capture:()=>structuredClone(capture),manifestSha:m.manifestSha256,reverify,
    assertObservation(observed){
      need(observed?.sha===capture.sha&&observed.tree===capture.tree&&observed.dumpSha===capture.dumpSha&&observed.manifestSha===m.manifestSha256&&observed.sourceProcess?.pid===capture.sourceProcess.pid&&fields.every(k=>observed[k]===capture[k])&&JSON.stringify(dbTuple(observed.sourceDatabase))===JSON.stringify(db),'OBSERVATION_DRIFT');
      return true;
    },
    verificationTarget(plan,keyMode){
      need(plan?.sha===capture.sha&&plan.tree===capture.tree&&Number.isInteger(plan.port)&&plan.port>1023&&plan.port<=65535&&plan.port!==33071&&['correct','missing','wrong'].includes(keyMode),'TARGET');
      return Object.freeze({api:'http://127.0.0.1:'+plan.port+'/api/v1',manifestSha:m.manifestSha256,appSha:capture.sha,keyMode});
    }
  });
}
