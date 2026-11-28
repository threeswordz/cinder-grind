// M7 preparation only. No cluster creation, source commands, or CLI entrypoint.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import {isAbsolute,resolve,join} from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const need=(ok,code)=>{if(!ok)throw Error('M7_TRANSPORT_'+code);};
const hex=(v,n)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const ident=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{0,62}$/.test(v);
const stable=(a,b)=>['dev','ino','mode','uid','nlink','size','mtimeMs','ctimeMs'].every(k=>a[k]===b[k]);
const safePath=p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p&&p!=='/';
// Use a bounded child, no shell, no inherited PG*, container or Node overrides,
// and do not retain stderr or expose command output in thrown errors.
export async function runM7Podman({executable,args,cwd,input,timeout,env}){
  const child=spawn(executable,args,{cwd,env,stdio:['pipe','pipe','ignore'],shell:false});
  let timedOut=false,overflow=false,forceTimer;const chunks=[];let size=0;
  const stop=()=>{child.kill('SIGTERM');if(!forceTimer)forceTimer=setTimeout(()=>child.kill('SIGKILL'),3000);};
  const ended=new Promise((ok,no)=>{child.once('error',no);child.once('close',code=>code===0?ok():no(Error('M7_TRANSPORT_CHILD')));});
  const timer=setTimeout(()=>{timedOut=true;stop();},timeout);
  const output=(async()=>{for await(const chunk of child.stdout){size+=chunk.length;if(size>1048576){overflow=true;stop();throw Error('M7_TRANSPORT_OUTPUT_LIMIT');}chunks.push(chunk);}})();
  try{await Promise.all([ended,output,pipeline(input,child.stdin)]);need(!timedOut&&!overflow,'CHILD');return Buffer.concat(chunks).toString('utf8').trim();}
  catch{stop();await Promise.allSettled([ended,output]);throw Error(timedOut?'M7_TRANSPORT_TIMEOUT':overflow?'M7_TRANSPORT_OUTPUT_LIMIT':'M7_TRANSPORT_CHILD');}
  finally{clearTimeout(timer);clearTimeout(forceTimer);for(const c of chunks)c.fill(0);}
}
async function readArchive(path){
  need(await realpath(path)===path,'ARCHIVE_PATH');const before=await lstat(path);
  need(before.isFile()&&!before.isSymbolicLink()&&before.uid===process.getuid()&&before.nlink===1&&!(before.mode&0o077)&&before.size>1024,'ARCHIVE_CUSTODY');
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{need(stable(before,await file.stat()),'ARCHIVE_DRIFT');const magic=Buffer.alloc(5);const r=await file.read(magic,0,5,0);need(r.bytesRead===5&&magic.toString()==='PGDMP','ARCHIVE_FORMAT');
    const hash=createHash('sha256');for await(const c of file.createReadStream({start:0,autoClose:false}))hash.update(c);
    need(stable(before,await file.stat())&&stable(before,await lstat(path)),'ARCHIVE_DRIFT');return {file,before,sha:hash.digest('hex')};
  }catch(e){await file.close();throw e;}
}
// The caller supplies a verified target container/credential witness. The target
// role uses its own independent password; the private PGPASSFILE inside the
// container must be installed and checked by the separately owned cluster operator.
export function createM7PodmanTransport({containerId,sourceContainerId,executable,cwd,plan,adminDatabase='postgres',adminRole,captureRoot,rolePassword,verifyContainer,reverifyCapture,run=runM7Podman}){
  need(hex(containerId,64)&&hex(sourceContainerId,64)&&containerId!==sourceContainerId&&safePath(executable)&&safePath(cwd)&&safePath(captureRoot),'PIN');
  need(/^m7_restore_[a-f0-9]{12}$/.test(plan?.database??'')&&plan.role===plan.database.replace('m7_restore_','m7_restore_role_')&&ident(adminDatabase)&&ident(adminRole)&&adminDatabase!==plan.database&&adminRole!==plan.role&&hex(rolePassword,64),'ROLE');
  need([verifyContainer,reverifyCapture,run].every(f=>typeof f==='function'),'CONTEXT');
  const target=structuredClone(plan),dump=join(captureRoot,'postgresql.custom');
  const env=Object.freeze(Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','XDG_RUNTIME_DIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]])));
  let roleAttempt=false,dbAttempt=false,restoreAttempt=false;
  const verify=async()=>{const proof=await verifyContainer();need(proof?.containerId===containerId&&proof.sourceContainerId===sourceContainerId&&proof.separatelyOwned===true&&proof.socketOnly===true&&proof.privateCredentialFile===true,'CONTAINER');};
  const pair=(database,role)=>database===adminDatabase&&role===adminRole||database===target.database&&role===target.role;
  const pod=async(args,input,timeout)=>{await verify();return run({executable,cwd,env,args:['exec','-i','--env','PGPASSFILE=/run/m7-private/pgpass',containerId,...args],input,timeout});};
  const psql=async(database,role,sql)=>{need(pair(database,role),'CONNECTION');return pod(['psql','-X','-qAt','-w','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U',role,'-d',database,'-f','-'],Readable.from([sql+';\n']),30000);};
  return Object.freeze({
    async query({database,role,sql}){need(typeof sql==='string'&&sql.startsWith('SELECT ')&&!/[;\n\r]/.test(sql),'QUERY');return psql(database,role,sql);},
    async execute({database,role,sql,newRole}){need(database===adminDatabase&&role===adminRole,'ADMIN');const createRole='CREATE ROLE '+target.role+' LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',createDb='CREATE DATABASE '+target.database+' OWNER '+target.role+' TEMPLATE template0';
      if(sql===createRole&&newRole===target.role){need(!roleAttempt&&!dbAttempt&&!restoreAttempt,'ORDER');roleAttempt=true;await psql(database,role,sql+" PASSWORD '"+rolePassword+"'");}
      else if(sql===createDb&&newRole===undefined){need(roleAttempt&&!dbAttempt&&!restoreAttempt,'ORDER');dbAttempt=true;await psql(database,role,sql);}
      else need(false,'MUTATION');
    },
    async restore({args,dumpSha256}){need(roleAttempt&&dbAttempt&&!restoreAttempt,'ORDER');restoreAttempt=true;
      const expected=['pg_restore','--exit-on-error','--single-transaction','--no-owner','--no-privileges','-U',target.role,'-d',target.database];
      need(JSON.stringify(args)===JSON.stringify(expected)&&hex(dumpSha256,64),'RESTORE_ARGS');await reverifyCapture();await verify();
      const a=await readArchive(dump);try{need(a.sha===dumpSha256,'ARCHIVE_HASH');const h=createHash('sha256');let bytes=0;
        const stream=Readable.from((async function*(){for(;;){const buf=Buffer.alloc(65536),r=await a.file.read(buf,0,buf.length,bytes);if(!r.bytesRead)break;const chunk=buf.subarray(0,r.bytesRead);bytes+=chunk.length;need(bytes<=a.before.size,'ARCHIVE_DRIFT');h.update(chunk);yield chunk;}})());
        try{await pod([...expected,'-h','/var/run/postgresql','-w'],stream,300000);}finally{stream.destroy();}
        need(bytes===a.before.size&&h.digest('hex')===dumpSha256&&stable(a.before,await a.file.stat())&&stable(a.before,await lstat(dump)),'ARCHIVE_DRIFT');
        await reverifyCapture();await verify();
      }finally{await a.file.close();}
    }
  });
}
