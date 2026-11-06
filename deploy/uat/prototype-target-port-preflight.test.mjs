import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { assessPrototypePorts, reserveLoopbackPort } from './prototype-target-port-preflight.mjs';

const SHA = 'a'.repeat(40);
const manifest = () => ({runtime: {
  apiOrigin: 'http://127.0.0.1:33071', webOrigin: 'http://127.0.0.1:44171',
  postgresHost: '127.0.0.1', postgresPort: 55471,
}});
const allowed = async () => ({status:'LOCAL_SAFETY_PREREQUISITES_OBSERVED',gaps:[]});
const denied = async () => ({status:'ISOLATED_TARGET_PREFLIGHT_BLOCKED',gaps:['EXACT_CLEAN_CHECKOUT_MISSING']});

test('existing target validation must pass before ANY socket is bound', async () => {
  let bindCalled = false;
  const result = await assessPrototypePorts(manifest(), SHA, {
    assess: denied, reserve: async () => { bindCalled = true; throw Error('unexpected'); },
  });
  assert.equal(result.status, 'PORT_PREFLIGHT_BLOCKED');
  assert.deepEqual(result.gaps, ['TARGET_PREFLIGHT_REQUIRED']);
  assert.equal(result.checkedPorts, 0);
  assert.equal(bindCalled, false);
});

test('successful bind of all three ports closes ALL handles, never claims reserve or deployment', async () => {
  const seen = [], closed = [];
  const res = await assessPrototypePorts(manifest(), SHA, { assess: allowed,
    reserve: async port => { seen.push(port); return { close: async () => {closed.push(port);} }; },
  });
  assert.deepEqual(seen, [33071,44171,55471]);
  assert.deepEqual(closed, [55471,44171,33071]);
  assert.equal(res.status, 'PORTS_TEMPORARILY_BINDABLE');
  assert.equal(res.checkedPorts, 3);
  for (const key of ['productionAuthorized','runtimeRunningVerified','prototypeFreezeCertified','portsReservedForStartup','humanUatCompleted'])
    assert.equal(res[key], false);
  assert.equal(res.databasesOpened, 0);
  assert.equal(res.servicesContacted, 0);
});

test('busy port denies and always releases earlier listeners', async () => {
  const closed = [],seen = [];
  const result = await assessPrototypePorts(manifest(), SHA, {assess: allowed,
    reserve: async port => {
      seen.push(port);
      if(port===44171) throw Object.assign(new Error('not for output'),{code:'EADDRINUSE'});
      return {close:async()=>{closed.push(port);}};
    },
  });
  assert.equal(result.status,'PORT_PREFLIGHT_BLOCKED');
  assert.deepEqual(result.gaps,['PORT_WEB_UNAVAILABLE']);
  assert.deepEqual(seen,[33071,44171]);
  assert.deepEqual(closed,[33071]);
  assert.equal(result.checkedPorts,2);
});

test('unknown bind errors and close failures fail closed, no secret error strings', async () => {
  const res = await assessPrototypePorts(manifest(), SHA, {assess: allowed,
    reserve: async port => port===44171
      ? Promise.reject(new Error('private unreleased details'))
      : {close:async()=>{throw new Error('private cleanup details');}},
  });
  assert.deepEqual(res.gaps,['PORT_WEB_PROBE_FAILED','PORT_RELEASE_UNVERIFIED']);
  assert.doesNotMatch(JSON.stringify(res),/private/);
});

test('manifest with non-loopback, URL credentials, port collision or wrong expected SHA fails before binding', async () => {
  const cases=[
    p => p.runtime.apiOrigin='http://example.com:33071',
    p => p.runtime.webOrigin='http://user:secret@127.0.0.1:44171',
    p => p.runtime.postgresHost='0.0.0.0',
    p => p.runtime.postgresPort=33071,
  ];
  for (const mutate of cases) {
    const p=manifest(); mutate(p);
    let attempted=0;
    const result=await assessPrototypePorts(p,SHA,{assess:allowed,reserve:async()=>{attempted++;throw Error('unexpected');}});
    assert.equal(result.status,'PORT_PREFLIGHT_BLOCKED');
    assert.equal(attempted,0);
  }
  await assert.rejects(()=>assessPrototypePorts(manifest(),'wrong',{assess:allowed}),/EXPECTED_MAIN_SHA_INVALID/);
});

test('real loopback binding refuses a busy local port and releases a free port', async () => {
  const socket = createServer();
  await new Promise((resolve,reject) => socket.once('error',reject).listen({host:'127.0.0.1',port:0},resolve));
  try {
    const port=socket.address().port;
    await assert.rejects(()=>reserveLoopbackPort(port), error => error.code==='EADDRINUSE');
  } finally { await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve())); }
  const socket2=createServer();
  await new Promise((resolve,reject)=>socket2.once('error',reject).listen({host:'127.0.0.1',port:0},resolve));
  const availablePort=socket2.address().port;
  await new Promise((resolve,reject)=>socket2.close(error=>error?reject(error):resolve()));
  const held=await reserveLoopbackPort(availablePort);
  await held.close();
  assert.ok(true);
});
