// M7 create-only isolated PostgreSQL cluster. No source mutation or deployment.
import {randomBytes} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,mkdir,open,realpath,readdir} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {createServer} from 'node:net';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
const need=(ok,c)=>{if(!ok)throw Error('M7_CLUSTER_'+c);};
const hex=(s,n)=>typeof s==='string'&&s.length===n&&/^[a-f0-9]+$/.test(s);
const path=p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p&&p!=='/'&&!/[,\n\r\0]/.test(p);
const env=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','XDG_RUNTIME_DIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
const exec=promisify(execFile);
async function command(executable,args,cwd,timeout=30000){try{return (await exec(executable,args,{cwd,env:env(),timeout,maxBuffer:1048576})).stdout.trim();}catch{throw Error('M7_CLUSTER_COMMAND');}}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function directory(p){need(path(p)&&await realpath(p)===p,'PATH');const s=await lstat(p);need(s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077),'DIRECTORY');return [s.dev,s.ino,s.uid,s.mode];}
async function writePrivate(p,value){const f=await open(p,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(value);await f.sync();}finally{await f.close();}}
async function verifyPrivate(p,value){const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size===Buffer.byteLength(value)&&await realpath(p)===p,'CREDENTIAL_FILE');const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const t=await f.stat();need(s.dev===t.dev&&s.ino===t.ino&&s.ctimeMs===t.ctimeMs&&await f.readFile('utf8')===value,'CREDENTIAL_FILE');}finally{await f.close();}}
// No published container ports. A host-loopback relay forwards PostgreSQL's
// byte stream through an owned podman exec process to the target's loopback.
export async function createM7LoopbackRelay({port,openChild,maxConnections=12}){
 need(Number.isInteger(port)&&port>=55472&&port<=55479&&typeof openChild==='function'&&Number.isInteger(maxConnections)&&maxConnections>0&&maxConnections<=32,'RELAY_CONTEXT');
 const active=new Set();let closed=false;let accepting=false;
 const server=createServer({allowHalfOpen:true},socket=>{
   if(!accepting||closed||socket.remoteAddress!=='127.0.0.1'||active.size>=maxConnections){socket.destroy();return;}
   socket.pause();const state={socket,child:null,done:null};active.add(state);
   const release=()=>{socket.destroy();if(state.child&&state.child.exitCode===null&&state.child.signalCode===null)state.child.kill('SIGTERM');};
   socket.once('error',release);socket.once('close',release);
   state.done=(async()=>{try{const child=await openChild();state.child=child;const ended=new Promise(ok=>{child.once('error',ok);child.once('close',ok);});if(socket.destroyed||closed)release();else{child.stdin.on('error',release);child.stdout.on('error',release);socket.pipe(child.stdin);child.stdout.pipe(socket);socket.resume();}await ended;}catch{}finally{socket.destroy();active.delete(state);}})();
 });
 await new Promise((ok,no)=>{server.once('error',no);server.listen({host:'127.0.0.1',port,exclusive:true},()=>{server.removeListener('error',no);ok();});});
 server.on('error',()=>{accepting=false;for(const x of active)x.socket.destroy();});
 return Object.freeze({enable(){need(!closed&&server.listening,'RELAY_CLOSED');accepting=true;},inspect(){return {listening:server.listening,address:server.address()?.address,port:server.address()?.port,connections:active.size};},async close(){if(closed)return;closed=true;accepting=false;for(const x of active){x.socket.destroy();if(x.child?.exitCode===null&&x.child?.signalCode===null)x.child.kill('SIGTERM');}const ended=new Promise((ok,no)=>server.close(e=>e?no(e):ok()));let timer;try{await Promise.race([Promise.all([ended,...[...active].map(x=>x.done)]),new Promise((_,no)=>{timer=setTimeout(()=>{for(const x of active)if(x.child?.exitCode===null&&x.child?.signalCode===null)x.child.kill('SIGKILL');no(Error('M7_CLUSTER_RELAY_CLEANUP'));},5000);})]);}finally{clearTimeout(timer);}need(active.size===0&&!server.listening,'RELAY_CLEANUP');}});
}
// Podman may represent --network=none as one empty named endpoint. It is
// not an attached network; never admit any populated address or endpoint.
export function m7NoNetworkAttachment(networks){
 if(networks==null)return true;
 if(typeof networks!=='object'||Array.isArray(networks))return false;
 const names=Object.keys(networks);if(names.length===0)return true;
 if(names.length!==1||names[0]!=='none')return false;
 const n=networks.none;if(!n||typeof n!=='object'||Array.isArray(n))return false;
 const fields=new Set(['EndpointID','Gateway','IPAddress','IPPrefixLen','IPv6Gateway','GlobalIPv6Address','GlobalIPv6PrefixLen','MacAddress','NetworkID','DriverOpts','IPAMConfig','Links','Aliases','DNSNames']);
 return Object.entries(n).every(([k,v])=>fields.has(k)&&(v==null||v===''||v===0||Array.isArray(v)&&v.length===0||typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===0||k==='NetworkID'&&v==='none'));
}
// Inspect actual Podman state, not a provisioner's boolean success flag.
export function verifyM7TargetContainer(c,p,{running=true}={}){
 need(c?.Id===p.id&&c.Id!==p.sourceId&&c.Name?.replace(/^\//,'')===p.name&&c.Image?.replace(/^sha256:/,'')===p.image&&c.Config?.User==='70:70'&&c.Config?.Labels?.['erp.m7.run']===p.runId&&c.Config?.Labels?.['erp.m7.scope']==='synthetic-recovery-only','CONTAINER_IDENTITY');
 need(c.State?.Running===running&&c.HostConfig?.NetworkMode==='none'&&c.HostConfig?.Privileged===false&&['','no'].includes(c.HostConfig?.RestartPolicy?.Name)&&Object.keys(c.HostConfig?.PortBindings??{}).length===0&&m7NoNetworkAttachment(c.NetworkSettings?.Networks)&&Object.keys(c.NetworkSettings?.Ports??{}).every(k=>c.NetworkSettings.Ports[k]===null),'NETWORK');
 need(Array.isArray(c.Mounts)&&c.Mounts.length===2&&c.Mounts.every(m=>m.Type==='bind'),'MOUNTS');
 const data=c.Mounts.find(m=>m.Destination==='/var/lib/postgresql/data'),credentials=c.Mounts.find(m=>m.Destination==='/run/m7-private');
 need(data?.Source===p.data&&data.RW===true&&credentials?.Source===p.credentials&&credentials.RW===false,'MOUNTS');
 const variables=c.Config?.Env;need(same(c.Config?.Cmd,['postgres','-c','listen_addresses=127.0.0.1'])&&Array.isArray(variables)&&['POSTGRES_DB=postgres','POSTGRES_USER='+p.adminRole,'POSTGRES_PASSWORD_FILE=/run/m7-private/admin-password','POSTGRES_INITDB_ARGS=--auth-local=scram-sha-256 --auth-host=scram-sha-256','PGDATA=/var/lib/postgresql/data/pgdata'].every(x=>variables.includes(x))&&!variables.some(x=>x.startsWith('POSTGRES_PASSWORD=')),'CONFIG');
 if(running)need(typeof c.State.StartedAt==='string'&&c.State.StartedAt.length>0,'START_IDENTITY');return true;
}
export function createM7TargetCluster({claim,sourceContainerId,sourceImageId,sourceCluster,dbPort,executable,cwd,verifySource,run=command,relayFactory=createM7LoopbackRelay,spawnChild,wait=delay}){
 const plan=structuredClone(claim?.plan),runId=plan?.database?.slice('m7_restore_'.length);
 need(/^[a-f0-9]{12}$/.test(runId??'')&&plan.database==='m7_restore_'+runId&&plan.role==='m7_restore_role_'+runId&&path(plan.root)&&Number.isInteger(dbPort)&&dbPort>=55472&&dbPort<=55479&&dbPort!==plan.port&&hex(sourceContainerId,64)&&hex(sourceImageId,64)&&/^\d+$/.test(sourceCluster??'')&&path(executable)&&path(cwd)&&[claim.verifyPaths,verifySource,run,relayFactory,wait].every(f=>typeof f==='function'),'CONTEXT');
 const adminRole='m7_admin_'+runId,name='erp-m7-'+runId,data=join(plan.root,'pgdata'),credentials=join(plan.root,'pg-private');
 const adminPassword=randomBytes(32).toString('hex'),rolePassword=randomBytes(32).toString('hex');need(adminPassword!==rolePassword,'CREDENTIALS');
 const passFile='*:5432:postgres:'+adminRole+':'+adminPassword+'\n*:5432:'+plan.database+':'+plan.role+':'+rolePassword+'\n';
 let attempted=false,id,startedAt,cluster,relay,ids,stopAttempted=false;
 const call=(args,timeout)=>run(executable,args,cwd,timeout);
 const pin=()=>({id,sourceId:sourceContainerId,image:sourceImageId,name,runId,data,credentials,adminRole});
 const inspect=async running=>{const rows=JSON.parse(await call(['inspect',id]));need(Array.isArray(rows)&&rows.length===1,'INSPECT');const c=rows[0];verifyM7TargetContainer(c,pin(),{running});if(running){need(!startedAt||startedAt===c.State.StartedAt,'RESTART');startedAt=c.State.StartedAt;}return c;};
 const files=async()=>{await claim.verifyPaths();need(same(ids,[await directory(plan.root),await directory(data),await directory(credentials)]),'PATH_DRIFT');need(same((await readdir(credentials)).sort(),['admin-password','pgpass']),'CREDENTIAL_FILES');await verifyPrivate(join(credentials,'admin-password'),adminPassword);await verifyPrivate(join(credentials,'pgpass'),passFile);};
 const pod=(args,timeout)=>call(['exec',id,...args],timeout);
 const inspectNetwork=async()=>{need(await pod(['/bin/busybox','ls','/sys/class/net'])==='lo','NETWORK_INTERFACES');const route=await pod(['/bin/busybox','cat','/proc/net/route']);need(route.split('\n').slice(1).every(l=>!l.trim()||l.split(/\s+/)[0]==='lo'),'NETWORK_ROUTES');};
 const verifyContainer=async()=>{await files();await inspect(true);await inspectNetwork();return {containerId:id,sourceContainerId,separatelyOwned:true,socketOnly:true,privateCredentialFile:true};};
 const identity=async()=>{const r=JSON.parse(await pod(['env','PGPASSFILE=/run/m7-private/pgpass','psql','-X','-qAt','-w','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U',adminRole,'-d','postgres','-c',"SELECT json_build_object('cluster',system_identifier::text,'version',current_setting('server_version_num'),'database',current_database(),'role',current_user)::text FROM pg_control_system()"]));need(/^\d+$/.test(r?.cluster??'')&&r.cluster!==sourceCluster&&r.version==='170011'&&r.database==='postgres'&&r.role===adminRole,'CLUSTER_IDENTITY');return r.cluster;};
 const verifyIsolation=async()=>{await verifyContainer();need(await identity()===cluster,'CLUSTER_DRIFT');return {targetCluster:cluster,sourceCluster,separatelyOwned:true,sourceNetworkDenied:true,credentialsIndependent:true};};
 const stop=async()=>{if(stopAttempted)return;stopAttempted=true;let first;try{await relay?.close();}catch(e){first=e;}if(id){try{await files();await inspect(true);await call(['stop','--time','10',id],20000);await inspect(false);}catch(e){first??=e;}}if(first)throw first;};
 return async function provisionOnce(){
   need(!attempted,'ALREADY_ATTEMPTED');attempted=true;await claim.verifyPaths();need(await verifySource()===true,'SOURCE');
   // Claim relay port before any target creation; no listener is enabled yet.
   relay=await relayFactory({port:dbPort,openChild:async()=>{await verifyContainer();const args=['exec','-i',id,'/bin/busybox','nc','127.0.0.1','5432'];return spawnChild?spawnChild(executable,args,cwd):spawn(executable,args,{cwd,env:env(),stdio:['pipe','pipe','ignore'],shell:false});}});
   try{await mkdir(data,{mode:0o700});await mkdir(credentials,{mode:0o700});ids=[await directory(plan.root),await directory(data),await directory(credentials)];await writePrivate(join(credentials,'admin-password'),adminPassword);await writePrivate(join(credentials,'pgpass'),passFile);await files();
     id=await call(['create','--name',name,'--pull=never','--label','erp.m7.run='+runId,'--label','erp.m7.scope=synthetic-recovery-only','--restart=no','--network=none','--userns=keep-id:uid=70,gid=70','--user=70:70','--cap-drop=ALL','--security-opt=no-new-privileges','--mount','type=bind,source='+data+',target=/var/lib/postgresql/data','--mount','type=bind,source='+credentials+',target=/run/m7-private,readonly','--env','POSTGRES_DB=postgres','--env','POSTGRES_USER='+adminRole,'--env','POSTGRES_PASSWORD_FILE=/run/m7-private/admin-password','--env','POSTGRES_INITDB_ARGS=--auth-local=scram-sha-256 --auth-host=scram-sha-256','--env','PGDATA=/var/lib/postgresql/data/pgdata',sourceImageId,'postgres','-c','listen_addresses=127.0.0.1']);
     need(hex(id,64)&&id!==sourceContainerId,'NEW_CONTAINER');await inspect(false);await call(['start',id]);
     let ready=false;for(let i=0;i<60;i++){await inspect(true);try{await pod(['pg_isready','-h','127.0.0.1','-U',adminRole,'-d','postgres'],3000);ready=true;break;}catch{await wait(1000);}}need(ready,'NOT_READY');await verifyContainer();cluster=await identity();await verifyIsolation();need(await verifySource()===true,'SOURCE');relay.enable();
     return Object.freeze({containerId:id,sourceContainerId,cluster,adminRole,rolePassword,dbPort,verifyContainer,verifyIsolation,inspectRelay:()=>relay.inspect(),close:stop});
   }catch(e){let cleanup=false;try{await relay?.close();}catch{cleanup=true;}try{if(hex(id,64)&&id!==sourceContainerId){const rows=JSON.parse(await call(['inspect',id]));need(Array.isArray(rows)&&rows.length===1&&rows[0].Id===id&&rows[0].Name?.replace(/^\//,'')===name&&rows[0].Config?.Labels?.['erp.m7.run']===runId&&rows[0].Config?.Labels?.['erp.m7.scope']==='synthetic-recovery-only'&&typeof rows[0].State?.Running==='boolean','INSPECT');if(rows[0].State.Running){verifyM7TargetContainer(rows[0],pin(),{running:true});await call(['stop','--time','10',id],20000);await inspect(false);}}}catch{cleanup=true;}if(cleanup)throw Object.assign(Error(/^M7_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'M7_CLUSTER_PRIVATE_FAILURE'),{cleanupCode:'M7_CLUSTER_PARTIAL_CLEANUP'});throw e;}
 };
}
