import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SHA,CONTAINER,childEnvironment,manifestMatches,localConnection,ownedContainer,toolingOnly,gitBlobSha,operator}
  from '../uat/prototype-runtime-operator.mjs';

const home='/Users/synthetic';
const root=home+'/Construction-ERP-Prototype-Runtime';
const fixture=()=>({expectedMainSha:SHA,mode:'isolated-synthetic',productionConnected:false,
  retainedDataUsed:false,realCompanyGrantsModified:false,runtime:{
    checkoutRoot:home+'/Construction-ERP-Prototype-Checkout',isolationRoot:root,
    databaseRoot:root+'/db',documentsRoot:root+'/documents',hrKeysRoot:root+'/hrkeys',
    apiOrigin:'http://127.0.0.1:33071',webOrigin:'http://127.0.0.1:44171',
    postgresHost:'127.0.0.1',postgresPort:55471,postgresDbName:'proto_a_01'}});
const connection=()=>[{Name:'podman-machine-default',Default:true,
  URI:'ssh://core@127.0.0.1:49853/run/user/501/podman/podman.sock'}];
const id='a'.repeat(64),image='sha256:'+'b'.repeat(64);
const container=()=>({Id:id,Image:image,Name:CONTAINER,
  Config:{User:'70:70',Labels:{'erp.prototype.source':SHA,'erp.prototype.scope':'synthetic-only'}},
  HostConfig:{RestartPolicy:{Name:'no'},PortBindings:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'55471'}]}},
  Mounts:[{Type:'bind',Source:root+'/db',Destination:'/var/lib/postgresql/data',RW:true}]});
const expected={id,image,dbRoot:root+'/db'};

test('fresh runtime children never inherit retained DB/key/container/Git/preload credentials',()=>{
  const env=childEnvironment({PATH:'/trusted/bin',HOME:'/Users/synthetic',USER:'synthetic',
    DATABASE_URL:'retained',PGHOST:'remote',PGPASSWORD:'private',HR_PRIVATE_KEYS:'private',
    BOOTSTRAP_ADMIN_PASSWORD:'private',NODE_OPTIONS:'--require /untrusted.js',
    CONTAINER_HOST:'ssh://remote',CONTAINER_CONNECTION:'old',DOCKER_HOST:'tcp://remote',
    GIT_DIR:'/old/.git',GIT_WORK_TREE:'/old',NPM_TOKEN:'private'});
  assert.deepEqual(Object.keys(env).sort(),['CI','HOME','NO_COLOR','PATH','USER']);
  assert.equal(JSON.stringify(env).includes('private'),false);
});
test('only the prepared synthetic source, storage and exact endpoints are accepted',()=>{
  assert.equal(manifestMatches(fixture(),home),true);
  for(const change of [x=>x.expectedMainSha='f'.repeat(40),x=>x.productionConnected=true,
    x=>x.retainedDataUsed=true,x=>x.realCompanyGrantsModified=true,x=>x.mode='production',
    x=>x.runtime.postgresPort=55432,x=>x.runtime.postgresDbName='construction_erp_uat',
    x=>x.runtime.apiOrigin='http://0.0.0.0:33071',x=>x.runtime.webOrigin='http://127.0.0.1:4173',
    x=>x.runtime.databaseRoot='/Users/synthetic/retained',x=>x.runtime.hrKeysRoot=root+'/documents',
    x=>x.runtime.checkoutRoot='/Users/synthetic/construction-erp']){
    const m=fixture();change(m);assert.equal(manifestMatches(m,home),false);
  }
});
test('machine selection must be unambiguous and rootless on the local Mac VM',()=>{
  assert.equal(localConnection(connection()),true);
  for(const value of [[],[...connection(),...connection()],
    [{...connection()[0],Default:false}],[{...connection()[0],Name:'production'}],
    [{...connection()[0],URI:'ssh://root@127.0.0.1:49853/run/podman/podman.sock'}],
    [{...connection()[0],URI:'ssh://core@example.com:49853/run/user/501/podman/podman.sock'}],
    [{...connection()[0],URI:'ssh://core:secret@127.0.0.1:49853/run/user/501/podman/podman.sock'}],
    [{...connection()[0],URI:connection()[0].URI+'?connection=old'}]])
    assert.equal(localConnection(value),false);
});
test('new container identity binds ID, image, scope, nonroot UID, restart and exact isolated mount',()=>{
  assert.equal(ownedContainer(container(),expected),true);
  for(const change of [x=>x.Id='c'.repeat(64),x=>x.Image='sha256:'+'d'.repeat(64),
    x=>x.Name='construction-erp-uat-postgres',x=>x.Config.User='0',
    x=>x.Config.Labels['erp.prototype.source']='e'.repeat(40),
    x=>x.Config.Labels['erp.prototype.scope']='retained',x=>x.HostConfig.RestartPolicy.Name='always',
    x=>x.Mounts[0].Type='volume',x=>x.Mounts[0].Source='/retained',
    x=>x.Mounts[0].RW=false,x=>x.Mounts.push({...x.Mounts[0],Source:home,Destination:'/home'})]){
    const c=container();change(c);assert.equal(ownedContainer(c,expected),false);
  }
});
test('database binding rejects public exposure, retained ports and additional services',()=>{
  for(const change of [x=>x.HostConfig.PortBindings['5432/tcp'][0].HostIp='0.0.0.0',
    x=>x.HostConfig.PortBindings['5432/tcp'][0].HostPort='55432',
    x=>x.HostConfig.PortBindings['5432/tcp'].push({HostIp:'::',HostPort:'5432'}),
    x=>x.HostConfig.PortBindings['80/tcp']=[{HostIp:'127.0.0.1',HostPort:'8080'}]]){
    const c=container();change(c);assert.equal(ownedContainer(c,expected),false);
  }
});
test('new green main can only add the operator package; app/schema/workflow changes block the pinned target',()=>{
  const valid={status:'ahead',files:[{filename:'deploy/uat/prototype-runtime-operator.mjs',status:'added'},
    {filename:'docs/CURRENT-STATE.md',status:'modified'}]};
  assert.equal(toolingOnly(valid),true);
  for(const value of [{status:'behind',files:valid.files},{status:'ahead',files:[]},
    {status:'ahead',files:[{filename:'apps/api/prisma/schema.prisma',status:'modified'}]},
    {status:'ahead',files:[{filename:'.github/workflows/validate.yml',status:'modified'}]},
    {status:'ahead',files:[{filename:'docs/DECISION-LOG.md',status:'modified'}]},
    {status:'ahead',files:[{filename:valid.files[0].filename,status:'removed'}]},
    {status:'ahead',files:[{...valid.files[0],previous_filename:'apps/api/src/auth/auth.service.ts'}]}])
    assert.equal(toolingOnly(value),false);
});
test('downloaded operator bytes use the canonical Git blob hash, including exact length and line endings',()=>{
  const bytes=Buffer.from('hello\n');
  assert.equal(gitBlobSha(bytes),createHash('sha1').update(Buffer.concat([Buffer.from('blob 6\0'),bytes])).digest('hex'));
  assert.notEqual(gitBlobSha(bytes),gitBlobSha(Buffer.from('hello\r\n')));
});
test('bad mode is blocked before workstation I/O; cloud hosts cannot provision the Mac',async()=>{
  await assert.rejects(operator('--reset'),e=>e.safeCode==='USE_PLAN_OR_START');
  if(process.platform!=='darwin')await assert.rejects(operator('--start'),e=>e.safeCode==='MAC_OPERATOR_REQUIRED');
});
