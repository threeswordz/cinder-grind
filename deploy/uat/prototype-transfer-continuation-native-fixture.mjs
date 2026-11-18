// CI-only fixture of the partial commit shape. Never runs on the Mac.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {httpClient} from './prototype-actors.mjs';
import {transferTables} from '../release-candidate/transfer-schema-contract.mjs';
import {transferCatalog} from '../release-candidate/transfer-catalog-contract.mjs';
import {TRANSFER_MIGRATIONS,verifyTransferMigration} from './prototype-transfer-state.mjs';
export function beforeTransferSchema(snapshot){
 const before=structuredClone(snapshot);
 for(const table of transferTables){assert.deepEqual(before[table],[]);delete before[table];}
 before.permissions=before.permissions.filter(p=>!transferCatalog.some(c=>c.id===p.id));
 before._prisma_migrations=before._prisma_migrations.filter(m=>!TRANSFER_MIGRATIONS.includes(m.migration_name));
 before.stock_transactions=before.stock_transactions.map(row=>{
  assert.equal(row.transfer_receipt_line_id,null);
  const {transfer_receipt_line_id,__fm03_exact_row_json,...rest}=row;
  return {...rest,__fm03_exact_row_json:__fm03_exact_row_json.replace(/,\s*"transfer_receipt_line_id"\s*:\s*null(?=\s*[,}])/,'')};
 });
 verifyTransferMigration(before,snapshot);return before;
}
export async function createFailedTransferCheckpoint(binding,c,origins){
 assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(origins.api,'http://127.0.0.1:31319/api/v1');assert.equal(origins.web,'http://127.0.0.1:44319');
 const b=structuredClone(binding),f=b.fixture,client=httpClient(origins.api,origins.web),sessions={};let primary;
 try{
  for(const key of ['STORE_SITE','KHAIMOOK'])sessions[key]=await client.login(key,b.actors[key],f.companyId);
  await client.call(sessions.KHAIMOOK,'TR_FAILED_FIXTURE_ENABLE','/inventory/transfer-custody/projects/'+f.projectId+'/enable',201,
   {requestKey:randomUUID(),reason:'Explicit synthetic dispatch/actual-receipt policy'});
  // Real canonical API allocates one number, then rejects an unknown UOM in
  // the header/item transaction. This deliberately exercises the same partial
  // commit shape, not a claim that the Mac's original predicate was reproduced.
  await client.call(sessions.STORE_SITE,'TR_FAILED_FIXTURE_CREATE','/inventory/stock-transfers',422,{
   sourceWarehouseId:f.warehouseId,destinationWarehouseId:c.warehouse.id,transferDate:new Date().toISOString().slice(0,10),
   lines:[{materialId:f.materialId,quantity:'5.0000',uomId:randomUUID(),sourceProjectId:f.projectId,destinationProjectId:f.unassignedProjectId}]});
 }catch(e){primary=e;}
 finally{for(const [key,s]of Object.entries(sessions))try{await client.logout(key,s);await client.call(s,'TR_FAILED_FIXTURE_'+key+'_REVOKED','/auth/me',401);}catch(e){primary??=e;}}
 if(primary)throw primary;
}
