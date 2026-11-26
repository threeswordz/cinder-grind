// Two independent historical receipts; never rewrite the capture receipt.
const SOURCE='5535dd890fd84489d76b611929e70e3422c746e8';
const TARGET='9417f07c609dbc091b5bbe2e09071c5e2c316459';
const TREE='bfcab1977ef80b8d7becf00d0056e892250052aa';
const sha=/^[a-f0-9]{64}$/;
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export function verifyBackupReceipts(backup,rehearsal){
  need(backup?.status==='M4_BACKUP_CAPTURE_AND_INTEGRITY_PASS'&&backup.source===SOURCE&&backup.target===TARGET&&backup.databaseTables===168&&backup.historicalMigrations===166&&backup.sourceUnchanged===true&&backup.protectedFilesVerified===true&&backup.isolatedRestoreVerified===false&&backup.productionAuthorized===false&&sha.test(backup.databaseArchiveSha256??''),'M6_HISTORICAL_BACKUP_RECEIPT_INVALID');
  need(rehearsal?.status==='M4_ISOLATED_RESTORE_AND_MIGRATION_PASS'&&rehearsal.source===SOURCE&&rehearsal.target===TARGET&&rehearsal.tree===TREE&&rehearsal.originalTables===168&&rehearsal.oldMigrations===166&&rehearsal.newMigrations===11&&rehearsal.totalMigrations===177&&rehearsal.isolatedRestoreVerified===true&&rehearsal.historicalRowsPreserved===true&&rehearsal.sourceUnchanged===true&&rehearsal.protectedFilesVerified===true&&rehearsal.productionAuthorized===false&&rehearsal.cutoverPerformed===false,'M6_HISTORICAL_REHEARSAL_RECEIPT_INVALID');
  return true;
}
// Normalize the historical [path,"file",size,hash] encoding to the current
// [path,size,hash] encoding. An omitted root marker is implicit in an inventory.
export function normalizeInventory(rows,historical){
  need(Array.isArray(rows),'M6_HISTORICAL_INVENTORY_INVALID');
  const seen=new Map();
  for(const row of rows){
    const p=row?.[0];
    need(Array.isArray(row)&&typeof p==='string'&&!p.includes('\\')&&!p.includes('\0')&&(p===''||p.split('/').every(x=>x!==''&&x!=='.'&&x!=='..'))&&!seen.has(p),'M6_HISTORICAL_INVENTORY_INVALID');
    if(row.length===2&&row[1]==='directory')seen.set(p,[p,'directory']);
    else{
      const size=historical?row[2]:row[1],hash=historical?row[3]:row[2];
      need(p!==''&&(historical?row.length===4&&row[1]==='file':row.length===3)&&Number.isSafeInteger(size)&&size>=0&&typeof hash==='string'&&sha.test(hash),'M6_HISTORICAL_INVENTORY_INVALID');
      seen.set(p,[p,size,hash]);
    }
  }
  if(!seen.has('')&&historical)seen.set('',['','directory']);
  need(seen.get('')?.[1]==='directory','M6_HISTORICAL_INVENTORY_INVALID');
  for(const p of seen.keys())if(p!=='')need(seen.get(p.includes('/')?p.slice(0,p.lastIndexOf('/')):'')?.[1]==='directory','M6_HISTORICAL_INVENTORY_INVALID');
  return [...seen.values()].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}
export function verifyProtectedInventories(historical,retained,current){
  const expected=normalizeInventory(historical,true);
  const same=rows=>JSON.stringify(normalizeInventory(rows,false))===JSON.stringify(expected);
  need(same(retained)&&same(current),'M6_HISTORICAL_PROTECTED_COPY_DRIFT');
  return true;
}
