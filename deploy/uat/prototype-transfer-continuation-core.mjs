// Continue only the precisely classified failed creation boundary. No setup,
// policy-enable replay, sequence reset, migration or stock injection.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {httpClient} from './prototype-actors.mjs';
import {verifyFailedTransferState} from './prototype-transfer-failure-state.mjs';
import {transferSnapshot,digest,verifyTransferMigration} from './prototype-transfer-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export function continuationBaseline(before,current,c,b){
 verifyFailedTransferState(before,current,c,b);
 const migrated=structuredClone(current);
 // The verifier has proved every original SQL row. Reconstruct the exact
 // source-migration baseline without changing any live row or spent number.
 for(const table of Object.keys(migrated))if(!['permissions','_prisma_migrations','stock_transactions'].includes(table))
  migrated[table]=structuredClone(before[table]??[]);
 verifyTransferMigration(before,migrated);
 return migrated;
}
export async function prepareTransferContinuationSource(db,binding,configuration,checkpoint,origins){
 const b=structuredClone(binding),c=structuredClone(configuration),f=b.fixture,{api,web}=structuredClone(origins);
 demand(process.platform==='darwin'&&api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171'||
  process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319',
  'TR_CONTINUATION_ORIGINS_REFUSED');
 const current=await db.$transaction(tx=>transferSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
 demand(digest(current)===checkpoint?.stateSha256,'TR_CONTINUATION_FAILED_STATE_DRIFT');
 const baseline=continuationBaseline(checkpoint.before,current,c,b);
 const period=new Date().toISOString().slice(0,7).replace('-','');
 demand(current.number_sequences.find(r=>r.id===c.sequence.id)?.last_period_key===period,'TR_CONTINUATION_MONTH_ROLLOVER_REQUIRES_DIAGNOSIS');
 let id;
 const base='/inventory/transfer-custody',destination=base+'/projects/'+f.unassignedProjectId;
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length),auth=['/auth/login','/auth/logout','/auth/me'].includes(path);
  const allowed=auth||options.method==='POST'&&[
   '/inventory/stock-transfers',id&&'/inventory/stock-transfers/'+id+'/submit',
   id&&'/inventory/stock-transfers/'+id+'/approve',id&&destination+'/transfers/'+id+'/assign'].includes(path)||
   options.method==='GET'&&id&&[destination+'/transfers/'+id,'/inventory/stock-transfers/'+id].includes(path);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&allowed,'TR_CONTINUATION_UNDECLARED_REQUEST');
  return fetch(url,options);
 });
 const sessions={},call=async(key,label,path,body)=>(await client.call(sessions[key],label,path,body===undefined?200:201,body)).value.data;
 const priorStock=await db.stockTransaction.findMany({orderBy:{id:'asc'}});
 let primary,result;
 try{
  for(const key of ['STORE_SITE','KHAIMOOK'])sessions[key]=await client.login(key,b.actors[key],f.companyId);
  // The already-committed ENABLE is intentionally not sent again.
  const transfer=await call('STORE_SITE','TR_CONTINUATION_CREATE','/inventory/stock-transfers',{
   sourceWarehouseId:f.warehouseId,destinationWarehouseId:c.warehouse.id,transferDate:new Date().toISOString().slice(0,10),
   remarks:'Synthetic transfer; no financial effect',lines:[{materialId:f.materialId,quantity:'5.0000',uomId:f.uomId,
    sourceProjectId:f.projectId,destinationProjectId:f.unassignedProjectId,remarks:'Synthetic origin work'}]});
  id=transfer.id;
  demand(transfer.transferNumber==='ST'+period.slice(2)+'-002','TR_CONTINUATION_SPENT_NUMBER_NOT_PRESERVED');
  await call('STORE_SITE','TR_CONTINUATION_SUBMIT','/inventory/stock-transfers/'+id+'/submit',{workflowCode:c.workflow.workflowCode});
  await call('KHAIMOOK','TR_CONTINUATION_APPROVE','/inventory/stock-transfers/'+id+'/approve',{postKey:randomUUID(),comment:'Independent approval; no stock until actual dispatch'});
  assert.deepEqual(await db.stockTransaction.findMany({orderBy:{id:'asc'}}),priorStock,'Continuation approval moved stock');
  const receiving=await call('KHAIMOOK','TR_CONTINUATION_DEST_READ',destination+'/transfers/'+id);
  await call('KHAIMOOK','TR_CONTINUATION_EXPLICIT_ASSIGN',destination+'/transfers/'+id+'/assign',{
   requestKey:randomUUID(),expectedVersion:receiving.version,employeeId:b.actors.PORN.employeeId,
   reason:'Khaimook explicitly assigns this active synthetic destination Employee while Store is absent'});
  const source=await call('STORE_SITE','TR_CONTINUATION_SOURCE_READ','/inventory/stock-transfers/'+id);
  demand(source.id===id&&source.items.length===1&&Number(source.items[0].quantity)===5,'TR_CONTINUATION_SOURCE_BINDING_REQUIRED');
  const sequence=await db.numberSequence.findUniqueOrThrow({where:{id:c.sequence.id}});
  demand(sequence.nextValue===3&&sequence.lastPeriodKey===period,'TR_CONTINUATION_SEQUENCE_DELTA_INVALID');
  result={id,number:source.transferNumber,observations:client.observations,baseline,spentNumberPreserved:true,policyReplayed:false};
 }catch(e){primary=e;}
 finally{for(const [key,session]of Object.entries(sessions))try{await client.logout(key,session);await client.call(session,'TR_CONTINUATION_'+key+'_REVOKED','/auth/me',401);}catch(e){primary??=e;}}
 if(primary)throw primary;return result;
}
