// M7 preparation only. Requires an independently inspected, separately owned
// PostgreSQL cluster; never run against the retained or M6 source cluster.
const need=(ok,code)=>{if(!ok)throw Error('M7_PG_'+code);};
const hex=(v,n)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const ident=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{0,62}$/.test(v);
const cluster=v=>typeof v==='string'&&/^\d+$/.test(v);
const literal=v=>{need(ident(v),'IDENTIFIER');return "'"+v+"'";};
const samePlan=(a,b)=>['database','role','sha','tree','port'].every(k=>a?.[k]===b?.[k]);
const one=raw=>{try{return JSON.parse(raw);}catch{throw Error('M7_PG_QUERY_RESULT');}};
const boolean=v=>v===true||v===false;
// PostgreSQL OID is unsigned 32-bit; JSON conversion of the raw oid type is
// not a numeric wire contract. Cast through text to bigint, avoiding int4 wrap.
const validOid=v=>Number.isSafeInteger(v)&&v>0&&v<=4294967295;
export async function verifyM7NativeOidWire(db,pin){
  need(typeof db?.$transaction==='function'&&ident(pin?.database)&&ident(pin?.role)&&validOid(pin?.oid),'WIRE_CONTEXT');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const rows=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation,current_setting('server_version_num') AS version,json_build_object('oid',d.oid::text::bigint,'roleOid',r.oid::text::bigint,'maxOid','4294967295'::oid::text::bigint)::text AS wire FROM pg_database d CROSS JOIN pg_roles r WHERE d.datname=current_database() AND r.rolname=current_user");
    const r=rows[0],wire=one(r?.wire);need(rows.length===1&&r.db===pin.database&&r.role===pin.role&&r.ro==='on'&&r.isolation==='repeatable read'&&r.version==='170011'&&wire.oid===pin.oid&&validOid(wire.roleOid)&&wire.maxOid===4294967295,'WIRE_CONTRACT');return true;
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
const catalog=(p)=>`SELECT json_build_object('databaseOid',(SELECT oid::text::bigint FROM pg_database WHERE datname=${literal(p.database)}),'roleOid',(SELECT oid::text::bigint FROM pg_roles WHERE rolname=${literal(p.role)}))::text`;
const identitySql="SELECT json_build_object('cluster',system_identifier::text,'major',current_setting('server_version_num')::int/10000,'database',current_database(),'role',current_user)::text FROM pg_control_system()";
const sessionSql=p=>`SELECT COALESCE(json_agg(json_build_object('pid',pid,'role',usename,'application',application_name,'backendStart',backend_start::text,'clientAddr',host(client_addr),'type',backend_type) ORDER BY pid),'[]'::json)::text FROM pg_stat_activity WHERE datname=${literal(p.database)} AND pid<>pg_backend_pid()`;
const dbSql=(p,source)=>`SELECT json_build_object('oid',d.oid::text::bigint,'database',d.datname,'owner',pg_get_userbyid(d.datdba),'role',r.rolname,'roleOid',r.oid::text::bigint,'privileged',r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR NOT r.rolcanlogin OR EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid),'sourceNameAbsent',NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=${literal(source.database)}),'allowConnect',d.datallowconn)::text FROM pg_database d CROSS JOIN pg_roles r WHERE d.datname=${literal(p.database)} AND r.rolname=${literal(p.role)}`;
// Includes non-public schemas, functions, types, extensions, large objects,
// foreign servers and publications. A fresh template0 DB must match this baseline.
const emptySql=`SELECT json_build_object('empty',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('pg_catalog','information_schema','public') AND nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp_%') AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AND NOT EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') AND NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname<>'plpgsql') AND NOT EXISTS(SELECT 1 FROM pg_largeobject_metadata) AND NOT EXISTS(SELECT 1 FROM pg_foreign_server) AND NOT EXISTS(SELECT 1 FROM pg_publication))::text`;

export function createM7PostgresRestore({plan,sourceDatabase,targetCluster,adminRole,adminDatabase='postgres',dumpSha256,transport,verifyIsolation,reverifyCapture,verifyOwnedSessions}){
  need(/^m7_restore_[a-f0-9]{12}$/.test(plan?.database??'')&&plan.role===plan.database.replace('m7_restore_','m7_restore_role_')&&hex(plan.sha,40)&&hex(plan.tree,40),'PLAN');
  need(cluster(sourceDatabase?.cluster)&&cluster(targetCluster)&&sourceDatabase.cluster!==targetCluster&&ident(sourceDatabase.database)&&ident(sourceDatabase.role)&&plan.database!==sourceDatabase.database&&plan.role!==sourceDatabase.role&&ident(adminRole)&&ident(adminDatabase)&&![plan.role,sourceDatabase.role].includes(adminRole)&&![plan.database,sourceDatabase.database].includes(adminDatabase)&&hex(dumpSha256,64),'ISOLATION');
  need(['query','execute','restore'].every(k=>typeof transport?.[k]==='function')&&[verifyIsolation,reverifyCapture,verifyOwnedSessions].every(f=>typeof f==='function'),'TRANSPORT');
  const pin=structuredClone(plan),source=structuredClone(sourceDatabase);let state='new',owned=null;
  const check=p=>need(samePlan(p,pin),'PLAN_DRIFT');
  const query=async (database,role,sql)=>one(await transport.query({database,role,sql}));
  const guard=async()=>{
    const proof=await verifyIsolation();
    need(proof?.targetCluster===targetCluster&&proof.sourceCluster===source.cluster&&proof.separatelyOwned===true&&proof.sourceNetworkDenied===true&&proof.credentialsIndependent===true,'EXTERNAL_ISOLATION');
    const i=await query(adminDatabase,adminRole,identitySql);
    need(i?.cluster===targetCluster&&i.major===17&&i.database===adminDatabase&&i.role===adminRole,'CONNECTED_CLUSTER');
  };
  const absent=async()=>{const c=await query(adminDatabase,adminRole,catalog(pin));need(c&&Object.hasOwn(c,'databaseOid')&&Object.hasOwn(c,'roleOid')&&[c.databaseOid,c.roleOid].every(v=>v===null||validOid(v)),'CATALOG');return {databaseAbsent:c.databaseOid===null,roleAbsent:c.roleOid===null};};
  const inspect=async p=>{
    check(p);await guard();const d=await query(adminDatabase,adminRole,dbSql(pin,source));
    need(validOid(d?.oid)&&validOid(d.roleOid),'DATABASE_CUSTODY_OID');
    need(d.database===pin.database&&d.role===pin.role,'DATABASE_CUSTODY_NAME');
    need(d.owner===pin.role,'DATABASE_CUSTODY_OWNER');
    need(d.allowConnect===true,'DATABASE_CUSTODY_CONNECTION');
    need(d.privileged===false,'DATABASE_CUSTODY_PRIVILEGE');
    need(d.sourceNameAbsent===true,'DATABASE_CUSTODY_SOURCE_ALIAS');
    if(owned)need(owned.oid===d.oid&&owned.roleOid===d.roleOid,'TARGET_DRIFT');
    const identity=await query(pin.database,pin.role,"SELECT json_build_object('database',current_database(),'role',current_user)::text");
    need(identity?.database===pin.database&&identity.role===pin.role,'ROLE_CONNECTION');
    const sessions=await query(adminDatabase,adminRole,sessionSql(pin));
    need(Array.isArray(sessions)&&sessions.every(s=>Number.isSafeInteger(s.pid)&&s.pid>0&&typeof s.backendStart==='string'),'SESSIONS');
    const others=await verifyOwnedSessions(structuredClone(sessions));
    need(Number.isSafeInteger(others)&&others>=0&&others<=sessions.length,'SESSION_PROOF');
    const e=await query(pin.database,pin.role,emptySql);need(boolean(e?.empty),'EMPTY_PROOF');
    return {cluster:targetCluster,oid:d.oid,roleOid:d.roleOid,database:d.database,role:d.role,owner:d.owner,roleIsolated:true,canConnectSource:false,privileged:false,otherSessions:others,emptyAtDatabaseScope:e.empty};
  };
  return Object.freeze({
    async inspectAbsence(p){check(p);need(state==='new','STATE');await guard();return absent();},
    async provisionFreshTarget(p){check(p);need(state==='new','STATE');state='provisioning';await guard();const a=await absent();need(a.databaseAbsent&&a.roleAbsent,'PRIOR_TARGET');
      // No IF NOT EXISTS, DROP, ALTER source grants, or role reuse. Transport
      // provisions independent credentials privately; never via command arguments.
      await transport.execute({database:adminDatabase,role:adminRole,sql:`CREATE ROLE ${pin.role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`,newRole:pin.role});
      await guard();const intermediate=await absent();need(intermediate.databaseAbsent&&!intermediate.roleAbsent,'PROVISION_DRIFT');
      await transport.execute({database:adminDatabase,role:adminRole,sql:`CREATE DATABASE ${pin.database} OWNER ${pin.role} TEMPLATE template0`});
      const d=await inspect(pin);need(d.emptyAtDatabaseScope&&d.otherSessions===0,'NOT_EMPTY');owned={oid:d.oid,roleOid:d.roleOid};state='provisioned';
    },
    async inspectDatabase(p){need(['provisioned','restored'].includes(state),'STATE');return inspect(p);},
    async restoreDatabase(p,args,digest){check(p);need(state==='provisioned','STATE');state='restoring';const fixed=['pg_restore','--exit-on-error','--single-transaction','--no-owner','--no-privileges','-U',pin.role,'-d',pin.database];
      need(JSON.stringify(args)===JSON.stringify(fixed)&&digest===dumpSha256,'RESTORE_ARGUMENTS');await reverifyCapture();const before=await inspect(pin);need(before.emptyAtDatabaseScope&&before.otherSessions===0,'NOT_EMPTY');
      await transport.restore({args:fixed,dumpSha256});await reverifyCapture();const after=await inspect(pin);need(after.oid===before.oid&&after.roleOid===before.roleOid&&after.otherSessions===0,'RESTORE_DRIFT');state='restored';
    }
  });
}
