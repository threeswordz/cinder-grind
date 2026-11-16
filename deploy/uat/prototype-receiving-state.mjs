// Controlled receiving upgrade over the already completed populated FM03 target.
// No CLI, bootstrap, reset, retained grants or parallel stock ledger.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES,httpClient} from './prototype-actors.mjs';
import {FM03_GRANTS,fm03Snapshot,digest} from './prototype-fm03-state.mjs';
import {receivingTables} from '../release-candidate/receiving-schema-contract.mjs';
import {receivingCatalog,verifyReceivingCatalog} from '../release-candidate/receiving-catalog-contract.mjs';
export {fm03Snapshot as receivingSnapshot,digest};
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const RECEIVING_GRANTS=Object.freeze({
 STORE_SITE:['inventory.receiving.view','inventory.receiving.capture','inventory.receiving.edit','inventory.receiving.link_po',
  'inventory.receipt.view','inventory.receipt.create','inventory.receipt.edit','inventory.receipt.submit'],
 JAI:['inventory.receiving.view','inventory.receiving.check','documents.document.view',
  'procurement.rfq.view','procurement.rfq.manage','procurement.quotation.view','procurement.quotation.manage','procurement.award.select'],
 KHAIMOOK:['inventory.receiving.view','documents.document.view'],
 BEN:['inventory.receiving.view','inventory.receiving.configure'],
});
export function verifyReceivingMigration(before,after){
 const normalized=structuredClone(after),baseline=structuredClone(before);
 verifyReceivingCatalog(after.permissions.filter(p=>receivingCatalog.some(c=>c.id===p.id)).map(({__fm03_exact_row_json,...r})=>r),true);
 normalized.permissions=normalized.permissions.filter(p=>!receivingCatalog.some(c=>c.id===p.id));
 for(const t of receivingTables){demand(!Object.hasOwn(before,t)&&normalized[t]?.length===0,'RC_UPGRADE_NONEMPTY_OR_PRIOR_RECEIVING_TABLE');delete normalized[t];}
 const old=before._prisma_migrations,added=after._prisma_migrations.filter(n=>!old.some(m=>m.id===n.id));
 demand(after._prisma_migrations.length===old.length+1&&old.every(m=>after._prisma_migrations.some(n=>canonical(n)===canonical(m)))&&
  added.length===1&&added[0].migration_name==='20261115130000_receiving_custody'&&added[0].finished_at&&!added[0].rolled_back_at,'RC_UPGRADE_WRONG_ADDITIVE_MIGRATION');
 normalized._prisma_migrations=old;
 // The only historical row shape change is an explicitly NULL optional GR link.
 normalized.goods_receipts=normalized.goods_receipts.map(row=>{demand(row.delivery_id===null,'RC_UPGRADE_HISTORICAL_GR_LINK_BACKFILLED');const {delivery_id,__fm03_exact_row_json,...r}=row;return r;});
 baseline.goods_receipts=baseline.goods_receipts.map(({__fm03_exact_row_json,...r})=>r);
 assert.deepEqual(normalized,baseline,'Receiving migration changed historical rows, grants or source history');
}
export async function configureReceiving(db,binding,expected){
 const b=structuredClone(binding),f=b.fixture;
 demand(b.sourceSha===SOURCE&&/^[a-f0-9]{64}$/.test(expected??''),'RC_CONFIGURATION_BINDING_INVALID');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-receiving-configuration-v1'))");
  demand(digest(await fm03Snapshot(tx))===expected,'RC_CONFIGURATION_STATE_DRIFT');
  const companies=await tx.company.findMany();
  demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
   companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),'RC_SYNTHETIC_COMPANIES_REQUIRED');
  demand(await tx.project.count({where:{id:f.projectId,companyId:f.companyId,projectCode:'SITE_A',isActive:true}})===1,'RC_PROJECT_BINDING_DRIFT');
  demand(await tx.siteIssue.count()===1&&await tx.siteIssue.count({where:{companyId:f.companyId,projectId:f.projectId,status:'CLOSED',version:6}})===1,'RC_COMPLETED_FM03_REQUIRED');
  for(const model of ['receivingProjectPolicy','receivingDelivery','purchaseRequest','rfq','purchaseOrder','goodsReceipt'])
   demand(await tx[model].count()===0,'RC_SOURCE_OR_RECEIVING_ALREADY_EXISTS');
  const allKeys=Object.keys(ROLES),members=await tx.userRole.findMany({where:{roleId:{in:allKeys.map(k=>b.actors[k].roleId)}}});
  demand(members.length===allKeys.length&&members.every(m=>m.companyId===f.companyId&&allKeys.some(k=>m.userId===b.actors[k].userId&&m.roleId===b.actors[k].roleId)),'RC_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');
  const added=[];
  for(const key of allKeys){
   const a=b.actors[key],user=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
   demand(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
    user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&user.userRoles[0].role.companyId===f.companyId&&
    user.userRoles[0].role.roleCode==='PROTO_'+key&&user.userRoles[0].role.isActive&&
    await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
    await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,'RC_ACTOR_SCOPE_DRIFT');
   const delta=b.configuration?.changes?.find(c=>c.roleCode==='PROTO_'+key)?.addedCapabilities??[];
   const wanted=[...new Set([...ROLES[key].permissions,...delta,...(FM03_GRANTS[key]??[])])].sort();
   demand(canonical(user.userRoles[0].role.rolePermissions.map(r=>r.permission.permissionCode).sort())===canonical(wanted),'RC_EXISTING_GRANT_MATRIX_CHANGED');
   const missing=(RECEIVING_GRANTS[key]??[]).filter(code=>!wanted.includes(code));
   const catalog=await tx.permission.findMany({where:{permissionCode:{in:missing}}});
   demand(catalog.length===missing.length,'RC_MIGRATED_CAPABILITY_CATALOG_REQUIRED');
   for(const permission of catalog)added.push(await tx.rolePermission.create({data:{roleId:a.roleId,permissionId:permission.id}}));
  }
  const resources={};
  for(const [model,where]of [['supplier',{companyId:f.companyId,supplierCode:'PROTO_RC_SUPPLIER'}],['costCode',{companyId:f.companyId,costCode:'PROTO_RC_MATERIAL'}],['wbsElement',{projectId:f.projectId,wbsCode:'PROTO_RC'}]])
   demand(await tx[model].count({where})===0,'RC_SOURCE_MASTER_ALREADY_EXISTS');
  resources.supplier=await tx.supplier.create({data:{companyId:f.companyId,supplierCode:'PROTO_RC_SUPPLIER',supplierName:'Synthetic receiving supplier'}});
  resources.costCode=await tx.costCode.create({data:{companyId:f.companyId,costCode:'PROTO_RC_MATERIAL',costName:'Synthetic receiving material'}});
  resources.wbs=await tx.wbsElement.create({data:{projectId:f.projectId,wbsCode:'PROTO_RC',wbsName:'Synthetic receiving work'}});
  const workflows={};
  for(const [entityType,key]of [['PURCHASE_REQUEST','KHAIMOOK'],['PURCHASE_ORDER','BEN'],['GOODS_RECEIPT','KHAIMOOK']]){
   demand(await tx.approvalWorkflow.count({where:{companyId:f.companyId,entityType}})===0,'RC_EXISTING_APPROVAL_RECONCILIATION_REQUIRED');
   workflows[entityType]=await tx.approvalWorkflow.create({data:{companyId:f.companyId,entityType,workflowCode:'PROTO_RC_'+entityType,
    workflowName:'Synthetic receiving '+entityType,steps:{create:[{stepNo:1,stepName:'Independent synthetic checker',requiredApprovals:1,stepRoles:{create:[{roleId:b.actors[key].roleId}]}}]}}});
  }
  const sequences=[];
  for(const [entityType,prefix]of [['PURCHASE_REQUEST','PR'],['RFQ','RFQ'],['PURCHASE_ORDER','PO'],['GOODS_RECEIPT','GRN']]){
   demand(await tx.numberSequence.count({where:{companyId:f.companyId,sequenceCode:entityType}})===0,'RC_EXISTING_SEQUENCE_RECONCILIATION_REQUIRED');
   sequences.push(await tx.numberSequence.create({data:{companyId:f.companyId,entityType,sequenceCode:entityType,formatTemplate:prefix+'YYMM-###',resetRule:'MONTHLY'}}));
  }
  const type=await tx.documentType.findFirst({where:{id:b.configuration.documentTypeId,companyId:f.companyId,isActive:true}});
  demand(type&&!type.documentTypeCode.startsWith('HR_')&&await tx.hrDocumentAttachment.count({where:{document:{documentTypeId:type.id}}})===0,'RC_ORDINARY_DOCUMENT_TYPE_REQUIRED');
  await tx.auditLog.create({data:{companyId:f.companyId,entityType:'PROTOTYPE_RECEIVING_CONFIGURATION',entityId:f.projectId,action:'CONFIGURE',actorUserId:f.adminUserId,
   newValues:{syntheticOnly:true,grantMatrix:RECEIVING_GRANTS,workflowCodes:Object.fromEntries(Object.entries(workflows).map(([k,v])=>[k,v.workflowCode]))}}});
  return {status:'RECEIVING_SYNTHETIC_CONFIGURATION_APPLIED',addedRolePermissionIds:added.map(r=>r.id),
   ...resources,workflows,sequenceIds:sequences.map(r=>r.id),documentTypeId:type.id,productionAuthorized:false};
 },{isolationLevel:'Serializable',timeout:30000});
}
// Source demand and approval remain the canonical authenticated HTTP workflow.
export async function prepareReceivingSource(db,binding,configuration,origins){
 const {api,web}=structuredClone(origins),b=structuredClone(binding),f=b.fixture,c=structuredClone(configuration);
 demand(api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171'||
  process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&api==='http://127.0.0.1:31319/api/v1'&&web==='http://127.0.0.1:44319','RC_SOURCE_ORIGINS_REFUSED');
 const ids={};
 const client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length),method=options.method;
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web,'RC_SOURCE_TRANSPORT_REFUSED');
  const auth=['/auth/login','/auth/logout','/auth/me'].includes(path);
  const allowed=auth||method==='POST'&&[ '/procurement/projects/'+f.projectId+'/purchase-requests',
   ids.pr&&'/procurement/purchase-requests/'+ids.pr+'/lines',ids.pr&&'/procurement/purchase-requests/'+ids.pr+'/submit',ids.pr&&'/procurement/purchase-requests/'+ids.pr+'/approve',
   '/procurement/projects/'+f.projectId+'/rfqs',ids.rfq&&'/procurement/rfqs/'+ids.rfq+'/suppliers',ids.rfq&&'/procurement/rfqs/'+ids.rfq+'/quotations',
   ids.rfqLine&&'/procurement/rfq-lines/'+ids.rfqLine+'/award','/procurement/projects/'+f.projectId+'/purchase-orders',
   ids.po&&'/procurement/purchase-orders/'+ids.po+'/submit',ids.po&&'/procurement/purchase-orders/'+ids.po+'/approve',
   '/inventory/receiving/projects/'+f.projectId+'/enable'].includes(path)||
   method==='PUT'&&ids.quote&&ids.rfqLine&&path==='/procurement/quotations/'+ids.quote+'/lines/'+ids.rfqLine||
   method==='GET'&&ids.po&&path==='/procurement/purchase-orders/'+ids.po;
  demand(allowed,'RC_SOURCE_UNDECLARED_REQUEST');return fetch(url,options);
 });
 const sessions={},call=async(key,label,path,body,method)=> (await client.call(sessions[key],label,path,method==='PUT'?200:body===undefined?200:201,body,method)).value.data;
 let primary,result;
 try{
  for(const key of ['STORE_SITE','KHAIMOOK','JAI','BEN'])sessions[key]=await client.login(key,b.actors[key],f.companyId);
  const today=new Date().toISOString().slice(0,10),later=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  const pr=await call('STORE_SITE','RC_PR_CREATE','/procurement/projects/'+f.projectId+'/purchase-requests',{remarks:'Synthetic receiving canonical demand'});ids.pr=pr.id;
  const prLine=await call('STORE_SITE','RC_PR_LINE','/procurement/purchase-requests/'+pr.id+'/lines',{lineType:'MATERIAL',materialId:f.materialId,quantity:'10.0000',uomId:f.uomId,wbsId:c.wbs.id,costCodeId:c.costCode.id,requiredOnSite:later});
  await call('STORE_SITE','RC_PR_SUBMIT','/procurement/purchase-requests/'+pr.id+'/submit',{workflowCode:c.workflows.PURCHASE_REQUEST.workflowCode});
  await call('KHAIMOOK','RC_PR_APPROVE','/procurement/purchase-requests/'+pr.id+'/approve',{comment:'Independent synthetic receiving demand approval'});
  const rfq=await call('JAI','RC_RFQ_CREATE','/procurement/projects/'+f.projectId+'/rfqs',{closingDate:later,remarks:'Synthetic receiving sourcing',lines:[{purchaseRequestLineId:prLine.id,quantity:'10.0000'}]});ids.rfq=rfq.id;ids.rfqLine=rfq.lines[0].id;
  await call('JAI','RC_RFQ_INVITE','/procurement/rfqs/'+rfq.id+'/suppliers',{supplierId:c.supplier.id});
  const quote=await call('JAI','RC_QUOTE_CREATE','/procurement/rfqs/'+rfq.id+'/quotations',{supplierId:c.supplier.id,supplierReference:'PROTO_RC_QUOTE',quotationDate:today});ids.quote=quote.id;
  const quoted=await call('JAI','RC_QUOTE_LINE','/procurement/quotations/'+quote.id+'/lines/'+ids.rfqLine,{quantity:'10.0000',unitPrice:'12.0000'},'PUT');
  const award=await call('JAI','RC_AWARD','/procurement/rfq-lines/'+ids.rfqLine+'/award',{supplierQuotationLineId:quoted.id,decisionReason:'Synthetic receiving source selection'});
  const po=await call('JAI','RC_PO_CREATE','/procurement/projects/'+f.projectId+'/purchase-orders',{awardIds:[award.id],remarks:'Synthetic receiving approved PO'});ids.po=po.id;
  await call('JAI','RC_PO_SUBMIT','/procurement/purchase-orders/'+po.id+'/submit',{workflowCode:c.workflows.PURCHASE_ORDER.workflowCode});
  await call('BEN','RC_PO_APPROVE','/procurement/purchase-orders/'+po.id+'/approve',{comment:'Independent synthetic receiving PO approval'});
  const approved=await call('JAI','RC_PO_READ','/procurement/purchase-orders/'+po.id);
  demand(approved.lifecycleState==='APPROVED'&&approved.projectId===f.projectId&&approved.supplierId===c.supplier.id&&approved.lines.length===1,'RC_APPROVED_SOURCE_READBACK_REQUIRED');
  await call('BEN','RC_POLICY_ENABLE','/inventory/receiving/projects/'+f.projectId+'/enable',{requestKey:randomUUID(),reason:'Explicit synthetic receiving custody enforcement'});
  result={po:approved,prId:pr.id,rfqId:rfq.id,quoteId:quote.id,awardId:award.id,observations:client.observations};
 }catch(e){primary=e;}
 finally{
  for(const [key,session]of Object.entries(sessions))try{
   await client.logout(key,session);await client.call(session,'RC_'+key+'_REVOKED','/auth/me',401);
  }catch(e){primary??=e;}
 }
 if(primary)throw primary;return result;
}
export async function receivingBrowserBinding(db,b,c,source,origins){
 const f=b.fixture;
 return {...origins,fixture:{company:{id:f.companyId},project:{id:f.projectId},warehouse:{id:f.warehouseId},
  material:await db.material.findUniqueOrThrow({where:{id:f.materialId}}),uom:{id:f.uomId},supplier:c.supplier,
  documentType:{id:c.documentTypeId},receiptWorkflow:c.workflows.GOODS_RECEIPT,po:source.po,
  actors:Object.fromEntries(Object.entries({store:'STORE_SITE',jai:'JAI',pm:'KHAIMOOK',outsider:'FOREMAN'}).map(([k,v])=>[k,b.actors[v]]))}};
}
export function verifyReceivingJourneyPreservation(before,after,c,b,source,result){
 const f=b.fixture,loginIds=['STORE_SITE','JAI','KHAIMOOK','BEN','FOREMAN'].map(k=>b.actors[k].userId),normalized=structuredClone(after),baseline=structuredClone(before);
 // All old rows stay exact, including the completed FM03 events, signed receipt,
 // grants, encrypted HR records and old sessions. Only User login timestamps vary.
 for(const data of [baseline,normalized])data.users=data.users.map(row=>{if(!loginIds.includes(row.id))return row;const {last_login_at,updated_at,__fm03_exact_row_json,...r}=row;return r;});
 for(const [table,rows]of Object.entries(baseline)){
  const current=normalized[table];demand(Array.isArray(current),'RC_HISTORY_TABLE_MISSING');
  for(const row of rows)assert.deepEqual(current.find(r=>r.id===row.id),row,'Receiving changed historical '+table);
 }
 const added=t=>normalized[t].filter(r=>!baseline[t].some(p=>p.id===r.id));
 const counts={role_permissions:c.addedRolePermissionIds.length,suppliers:1,cost_codes:1,wbs_elements:1,
  approval_workflows:3,approval_steps:3,approval_step_roles:3,number_sequences:4,purchase_requests:1,purchase_request_lines:1,
  rfqs:1,rfq_lines:1,rfq_suppliers:1,supplier_quotations:1,supplier_quotation_lines:1,quotation_awards:1,purchase_orders:1,purchase_order_lines:1,
  goods_receipts:1,goods_receipt_items:1,stock_transactions:1,documents:3,document_links:6,approval_instances:3,approval_actions:3,
  receiving_project_policies:1,receiving_deliveries:1,receiving_delivery_lines:1,receiving_delivery_evidence:3,receiving_delivery_events:6,receiving_operations:8};
 for(const table of Object.keys(baseline)){
  const fresh=added(table);
  if(table==='users'){demand(fresh.length===0,'RC_UNEXPECTED_USERS');continue;}
  if(table==='user_sessions'){demand(fresh.length>0&&fresh.every(r=>r.revoked_at&&loginIds.includes(r.user_id)),'RC_FRESH_SESSION_NOT_REVOKED');continue;}
  if(table==='audit_logs'){
   const entities=new Set(['PROTOTYPE_RECEIVING_CONFIGURATION','PURCHASE_REQUEST','PURCHASE_REQUEST_LINE','RFQ','RFQ_SUPPLIER','SUPPLIER_QUOTATION','SUPPLIER_QUOTATION_LINE','QUOTATION_AWARD','PURCHASE_ORDER','GOODS_RECEIPT','RECEIVING_DELIVERY','RECEIVING_PROJECT_POLICY','DOCUMENT','DOCUMENT_LINK']);
   demand(fresh.length>0&&fresh.every(r=>r.company_id===f.companyId&&[f.adminUserId,...loginIds].includes(r.actor_user_id)&&entities.has(r.entity_type)),'RC_UNEXPECTED_AUDIT_ADDITION');continue;
  }
  demand(fresh.length===(counts[table]??0),'RC_UNEXPECTED_ADDITIONS_'+table.toUpperCase());
  for(const row of fresh)if(Object.hasOwn(row,'company_id'))demand(row.company_id===f.companyId,'RC_NEW_ROW_WRONG_COMPANY');
 }
 demand(canonical(added('role_permissions').map(r=>r.id).sort())===canonical([...c.addedRolePermissionIds].sort()),'RC_GRANT_DELTA_CHANGED');
 demand(added('purchase_orders')[0].id===source.po.id&&added('purchase_requests')[0].id===source.prId,'RC_SOURCE_IDS_CHANGED');
 demand(canonical(added('receiving_operations').map(r=>r.action).sort())===canonical(['ENABLE','CAPTURE','ATTACH','ATTACH','ATTACH','LINK_PO','CHECK','CREATE_GR'].sort()),'RC_OPERATION_HISTORY_INVALID');
 const delivery=added('receiving_deliveries')[0],gr=added('goods_receipts')[0],stock=added('stock_transactions')[0];
 demand(delivery.id===result.deliveryId&&delivery.project_id===f.projectId&&delivery.created_by_user_id===b.actors.STORE_SITE.userId&&delivery.checked_by_user_id===b.actors.JAI.userId&&
  gr.id===result.goodsReceiptId&&gr.delivery_id===delivery.id&&gr.posted_at&&gr.created_by_user_id===b.actors.STORE_SITE.userId&&
  stock.goods_receipt_id===gr.id&&stock.quantity===3&&stock.posted_by_user_id===b.actors.KHAIMOOK.userId,'RC_FINAL_STOCK_ACTORS_OR_SOURCE_INVALID');
 for(const d of added('documents'))demand(result.documentIds.includes(d.id)&&d.uploaded_by_user_id===b.actors.STORE_SITE.userId&&d.document_type_id===c.documentTypeId,'RC_FINAL_DOCUMENT_SCOPE_INVALID');
}

export function verifyReceivingDocumentFiles(before,after,documents){
 const index=new Map(after.map(r=>[r[0],r]));
 for(const row of before)assert.deepEqual(index.get(row[0]),row,'Receiving changed existing Document bytes or directory custody');
 const old=new Set(before.map(r=>r[0])),fresh=after.filter(r=>!old.has(r[0]));
 demand(fresh.length===documents.length,'RC_UNEXPECTED_DOCUMENT_FILES');
 for(const d of documents){const row=index.get(d.storage_key);demand(!old.has(d.storage_key)&&row?.[1]===d.file_size_bytes&&row?.[2]===d.checksum,'RC_RECEIVING_DOCUMENT_FILE_BYTES_INVALID');}
}
