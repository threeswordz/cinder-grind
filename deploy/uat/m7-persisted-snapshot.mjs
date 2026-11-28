// Preparation: read-only exact-target snapshot. No credentials, writes or CLI.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Error('M7_SNAPSHOT_'+c);};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const ident=v=>typeof v==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(v);
const governed=new Set(['public.users','public.user_sessions','public.audit_logs','public.login_rate_limit_buckets']);
const ts=c=>`to_char(${c} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const full="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
const stable="encode(sha256(convert_to((to_jsonb(t)-ARRAY['last_login_at','updated_at']::text[])::text,'UTF8')),'hex')";
const sql={identity:`SELECT ${ts('CURRENT_TIMESTAMP')} AS clock,current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation`,catalog:"SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%' ORDER BY n.nspname,c.relname",sessions:`SELECT id::text AS id,user_id::text AS "userId",token_hash AS "tokenHash",csrf_token_hash AS "csrfTokenHash",${ts('expires_at')} AS "expiresAt",${ts('revoked_at')} AS "revokedAt",${ts('last_seen_at')} AS "lastSeenAt",${ts('created_at')} AS "createdAt" FROM public.user_sessions ORDER BY id`,audits:`SELECT id::text AS id,company_id::text AS "companyId",entity_type AS "entityType",entity_id::text AS "entityId",action,actor_user_id::text AS "actorUserId",${ts('occurred_at')} AS "occurredAt",old_values AS "oldValues",new_values AS "newValues",correlation_id AS "correlationId" FROM public.audit_logs ORDER BY id`,users:`SELECT id::text AS id,${full} AS hash,${stable} AS stable,${ts('last_login_at')} AS login,${ts('updated_at')} AS updated FROM public.users t ORDER BY id`,buckets:`SELECT client_key AS key,${full} AS hash,${ts('reset_at')} AS reset FROM public.login_rate_limit_buckets t ORDER BY client_key`};
export function createM7PersistedSnapshotReader({db,target,expectedTables,verifyCustody,readGrantsDigest,readSourceStateDigest}){
  need(typeof db?.$transaction==='function'&&ident(target?.database)&&ident(target?.role)&&typeof target?.cluster==='string'&&/^\d+$/.test(target.cluster)&&Number.isSafeInteger(target.oid)&&target.oid>0,'CONTEXT');
  need([verifyCustody,readGrantsDigest,readSourceStateDigest].every(f=>typeof f==='function'),'ADAPTER');
  need(Array.isArray(expectedTables)&&expectedTables.every(t=>typeof t==='string'&&t.split('.').length===2&&t.split('.').every(ident))&&new Set(expectedTables).size===expectedTables.length&&[...governed].every(t=>expectedTables.includes(t)),'TABLES');
  const pin=structuredClone(target),tables=expectedTables.slice().sort();
  const custody=async()=>{const o=await verifyCustody();need(o?.cluster===pin.cluster&&o.oid===pin.oid&&o.database===pin.database&&o.role===pin.role&&o.readOnlyInspection===true,'CUSTODY');};
  return async function readSnapshot(){
    await custody();const sourceStateSha256=await readSourceStateDigest();need(hex(sourceStateSha256),'SOURCE');
    const result=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const rows=await tx.$queryRawUnsafe(sql.identity);need(rows.length===1&&rows[0].db===pin.database&&rows[0].role===pin.role&&rows[0].ro==='on'&&rows[0].isolation==='repeatable read'&&typeof rows[0].clock==='string'&&Number.isFinite(Date.parse(rows[0].clock)),'CONNECTION');
      const cat=await tx.$queryRawUnsafe(sql.catalog);need(cat.every(r=>ident(r.schema)&&ident(r.name)),'CATALOG');const actual=cat.map(r=>r.schema+'.'+r.name).sort();need(JSON.stringify(actual)===JSON.stringify(tables),'TABLE_DRIFT');
      const business=[];for(const table of tables.filter(t=>!governed.has(t))){const [schema,name]=table.split('.');const hashes=await tx.$queryRawUnsafe(`SELECT ${full} AS hash FROM ONLY "${schema}"."${name}" t ORDER BY hash`);need(hashes.every(r=>hex(r.hash)),'ROW_HASH');business.push([table,hashes.map(r=>r.hash)]);}
      const [sessions,audits,users,buckets]=await Promise.all([sql.sessions,sql.audits,sql.users,sql.buckets].map(q=>tx.$queryRawUnsafe(q)));
      const grantsSha256=await readGrantsDigest(tx);need(hex(grantsSha256),'GRANTS');
      return {clock:rows[0].clock,sessions,audits,users,buckets,businessRowsSha256:hash(business),grantsSha256,sourceStateSha256};
    },{isolationLevel:'RepeatableRead',timeout:120000});
    await custody();need(await readSourceStateDigest()===sourceStateSha256,'SOURCE_DRIFT');return result;
  };
}
