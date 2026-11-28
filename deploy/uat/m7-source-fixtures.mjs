// Bind existing M6 terminal documents and actors without new grants or logins.
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Error('M7_FIXTURE_'+c);};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[0-9a-f]{12}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const one=(r,c)=>{need(Array.isArray(r)&&r.length===1,c);return r[0];};
const h=x=>createHash('sha256').update(x).digest('hex');
// Exact previously verified synthetic M6 plaintext (m6-hr-download-proof.mjs).
const hrText='CONSTRUCTION_ERP_SYNTHETIC_M6_ENCRYPTED_HR_FILE_PROOF_20261122\n';
const required=['JAI','STORE_SITE','KOH','FOREMAN'];
export async function bindM7SourceFixtures({db,sourceDatabase,fixture,privateActors,inventory,verifyActorReceipts}){
 need(typeof db?.$transaction==='function'&&sourceDatabase?.database==='m6_successor_rehearsal'&&sourceDatabase.role==='proto_runtime'&&Number.isSafeInteger(sourceDatabase.oid)&&typeof verifyActorReceipts==='function'&&verifyActorReceipts()===true,'CONTEXT');
 const f=fixture;need([f?.companyId,f?.foreignCompanyId,f?.projectId,f?.unassignedProjectId,f?.foreignProjectId,f?.adminUserId].every(uuid)&&f.companyId!==f.foreignCompanyId&&new Set([f.projectId,f.unassignedProjectId,f.foreignProjectId]).size===3&&Array.isArray(inventory),'FIXTURE');
 const files=new Map(inventory.map(r=>[r[0],r]));need(files.size===inventory.length,'INVENTORY');
 return db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const d=one(await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,(SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid"),'DATABASE');
   need(d.db===sourceDatabase.database&&d.role===sourceDatabase.role&&d.oid===String(sourceDatabase.oid)&&d.ro==='on'&&d.isolation==='repeatable read','DATABASE');
   const active=one(await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP'),'SESSIONS');need(active.n==='0','ACTIVE_SESSIONS');
   const companies=await tx.company.findMany({select:{id:true,companyCode:true,isActive:true,baseCurrencyCode:true}});need(companies.length===2&&[[f.companyId,'PROTO_A'],[f.foreignCompanyId,'PROTO_B']].every(([id,code])=>companies.some(c=>c.id===id&&c.companyCode===code&&c.isActive===true&&c.baseCurrencyCode==='THB')),'COMPANIES');
   const projects=await tx.project.findMany({include:{members:true}});need(projects.length===3&&[[f.projectId,f.companyId,'SITE_A'],[f.unassignedProjectId,f.companyId,'SITE_B'],[f.foreignProjectId,f.foreignCompanyId,'SITE_FOREIGN']].every(([id,companyId,code])=>projects.some(p=>p.id===id&&p.companyId===companyId&&p.projectCode===code&&p.isActive===true)),'PROJECTS');
   const roster={};for(const k of required){const a=privateActors?.actors?.[k];need(uuid(a?.userId)&&uuid(a.employeeId)&&uuid(a.roleId)&&a.userId!==f.adminUserId&&a.email==='proto-'+k.toLowerCase()+'@example.invalid'&&hex(a.password),'ACTOR_RECEIPT');
     const u=await tx.user.findUnique({where:{id:a.userId},include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
     need(u?.id===a.userId&&u.isActive===true&&u.companyId===f.companyId&&u.company?.isActive===true&&u.employeeId===a.employeeId&&u.employee?.id===a.employeeId&&u.employee.companyId===f.companyId&&u.employee.isActive===true&&u.email===a.email&&u.userRoles.every(r=>r.companyId===f.companyId&&r.role.companyId===f.companyId&&r.role.isActive===true)&&u.userRoles.some(r=>r.roleId===a.roleId&&r.role.roleCode==='PROTO_'+k),'ACTOR');
     const roles=u.userRoles.map(r=>r.role.roleCode).sort(),permissions=[...new Set(u.userRoles.flatMap(r=>r.role.rolePermissions.map(p=>p.permission.permissionCode)))].sort();need(roles.length>0&&!roles.includes('SYS_ADMIN'),'ADMIN');roster[k]={id:u.id,companyId:u.companyId,email:u.email,password:a.password,roles,permissions,employeeId:a.employeeId};}
   need(new Set(required.map(k=>roster[k].id)).size===4&&new Set(required.map(k=>roster[k].employeeId)).size===4,'ACTOR_ALIAS');
   const has=(a,...p)=>p.every(x=>a.permissions.includes(x));const assigned=(a,id)=>projects.find(p=>p.id===id).members.some(m=>m.employeeId===a.employeeId&&m.isActive===true);
   const jai=roster.JAI,store=roster.STORE_SITE,koh=roster.KOH,foreman=roster.FOREMAN;
   need(has(jai,'documents.document.view','procurement.po.view')&&(has(jai,'projects.access_all')||assigned(jai,f.projectId))&&!has(jai,'hr.documents.view')&&has(store,'documents.document.view','inventory.material_request.view')&&assigned(store,f.projectId)&&has(koh,'hr.documents.view')&&has(foreman,'projects.project.view')&&assigned(foreman,f.projectId)&&!assigned(foreman,f.unassignedProjectId)&&!has(foreman,'projects.access_all')&&!has(foreman,'hr.documents.view'),'ROLE_SCOPE');
   const grants=await tx.hrCompanyAccess.findMany({where:{userId:koh.id,isActive:true}});need(grants.some(g=>g.companyId===f.companyId&&g.category==='documents')&&grants.every(g=>g.companyId===f.companyId)&&await tx.hrCompanyAccess.count({where:{userId:foreman.id,isActive:true}})===0,'HR_GRANTS');
   const bytes=(doc)=>{need(uuid(doc?.id)&&doc.companyId===f.companyId&&doc.isActive===true&&doc.storageProvider==='LOCAL'&&uuid(doc.storageKey)&&hex(doc.checksum)&&Number.isSafeInteger(doc.fileSizeBytes)&&doc.fileSizeBytes>0&&JSON.stringify(files.get(doc.storageKey))===JSON.stringify([doc.storageKey,doc.fileSizeBytes,doc.checksum]),'DOCUMENT_BYTES');return {id:doc.id,sha256:doc.checksum,size:doc.fileSizeBytes};};
   const dispatch=one(await tx.poDispatchEvent.findMany({where:{companyId:f.companyId,projectId:f.projectId,kind:'DISPATCH'},take:2}),'ORDINARY_DISPATCH');need(uuid(dispatch.purchaseOrderId)&&uuid(dispatch.evidenceDocumentId)&&dispatch.recordedByUserId===jai.id,'ORDINARY_SCOPE');
   const doc=await tx.document.findUnique({where:{id:dispatch.evidenceDocumentId},include:{links:true,hrDocumentAttachment:true}});const ordinary={...bytes(doc),entityId:dispatch.purchaseOrderId};need(!doc.hrDocumentAttachment&&doc.uploadedByUserId===jai.id&&doc.links.some(l=>l.entityType==='PROJECT'&&l.entityId===f.projectId)&&doc.links.some(l=>l.entityType==='PURCHASE_ORDER'&&l.entityId===ordinary.entityId),'ORDINARY_LINK');
   const receipt=one(await tx.materialRequestReceipt.findMany({where:{recordedByUserId:store.id,signedEvidenceConfirmed:true,reason:'Synthetic signed receipt only',request:{companyId:f.companyId,projectId:f.projectId}},include:{document:{include:{links:true,hrDocumentAttachment:true}},request:true},take:2}),'SIGNED_RECEIPT');
   const signed={...bytes(receipt.document),entityId:receipt.requestId};need(uuid(receipt.id)&&uuid(signed.entityId)&&receipt.evidenceChecksum===signed.sha256&&receipt.request.id===signed.entityId&&receipt.request.companyId===f.companyId&&receipt.request.projectId===f.projectId&&receipt.request.version===3&&receipt.supersedesReceiptId===null&&!receipt.document.hrDocumentAttachment&&receipt.document.uploadedByUserId===store.id&&receipt.document.links.some(l=>l.entityType==='PROJECT'&&l.entityId===f.projectId)&&receipt.document.links.some(l=>l.entityType==='MATERIAL_REQUEST'&&l.entityId===signed.entityId),'SIGNED_LINK');
   const a=one(await tx.hrDocumentAttachment.findMany({where:{companyId:f.companyId,employeeId:koh.employeeId},include:{document:true},orderBy:{version:'asc'},take:2}),'HR_ATTACHMENT');
   const cipher=bytes(a.document);need(uuid(a.id)&&a.version===1&&a.actorUserId===koh.id&&a.document.fileName==='hr-private.enc'&&typeof a.encryptedMetadata==='string'&&a.encryptedMetadata.length>0&&a.createdAt instanceof Date&&!Number.isNaN(a.createdAt.valueOf())&&new Set([ordinary.id,signed.id,cipher.id]).size===3,'HR_CIPHERTEXT');
   const hr={id:a.id,documentId:cipher.id,sha256:h(hrText),size:Buffer.byteLength(hrText),history:[{id:a.id,version:1,createdAt:a.createdAt.toISOString()}]};
   const clean=a=>{const {employeeId,...actor}=a;return actor;};const actors={reader:clean(jai),signedReader:clean(store),hrReader:clean(koh),restricted:clean(foreman)};
   const expectedAudits=[{companyId:f.companyId,entityType:'HR',entityId:koh.employeeId,action:'DOCUMENT_DOWNLOAD',actorUserId:koh.id,oldValues:null,newValues:{attachmentId:a.id,targetCompanyId:f.companyId,version:1},correlationId:null}];
   return {fixture:{company:f.companyId,foreignCompany:f.foreignCompanyId,project:f.projectId,foreignProject:f.foreignProjectId,unassignedProject:f.unassignedProjectId,employee:koh.employeeId,otherEmployee:foreman.employeeId,ordinary,signed,hr},actors,expectedAudits,ciphertextSha:cipher.sha256};
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
export async function readM7NativeSourceFixtures({source,binding}){
 const [{readM7PrivateTerminalReceipt},{validPrivateActors,validActorReceipt}]=await Promise.all([import('./m7-terminal-source.mjs'),import('./prototype-browser-operator.mjs')]);
 const [fixture,privateActors,actorReceipt]=await Promise.all(['actors-fixture-private.json','actors-private.json','actors-ready.json'].map(p=>readM7PrivateTerminalReceipt(join(source.root,p))));
 await binding.reverify();const witness=await source.observe();const c=binding.capture();need(witness.rowsSha===c.rowsSha&&witness.applicationSha===c.sha,'SOURCE');
 const result=await bindM7SourceFixtures({db:source.db,sourceDatabase:c.sourceDatabase,fixture,privateActors,inventory:witness.expectedInventories.documents,verifyActorReceipts:()=>validPrivateActors(privateActors)&&validActorReceipt(actorReceipt)});
 await binding.reverify();need((await source.observe()).rowsSha===c.rowsSha,'SOURCE_DRIFT');return result;
}
