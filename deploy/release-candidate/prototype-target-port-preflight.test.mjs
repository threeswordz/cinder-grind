import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:net';
import { assessPrototypePorts, reserveLoopbackPort } from '../uat/prototype-target-port-preflight.mjs';

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
  assert.equal(res.portsHeldAfterCheck,'UNKNOWN');
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
test('real clean target and sockets compose safely; busy database and dirty checkout deny', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'erp-proto-port-integration-'));
  const checkout = join(root, 'checkout'), isolation = join(root, 'target');
  const listeners = [];
  const close = socket => new Promise((resolve, reject) =>
    socket.close(error => error ? reject(error) : resolve()));
  try {
    await mkdir(checkout, { mode: 0o700 });
    await mkdir(isolation, { mode: 0o700 });
    for (const name of ['db', 'documents', 'hrkeys'])
      await mkdir(join(isolation, name), { mode: 0o700 });
    execFileSync('git', ['init', '-q', checkout], { stdio: 'ignore' });
    await writeFile(join(checkout, 'fixture.txt'), 'synthetic target only');
    execFileSync('git', ['-C', checkout, 'add', 'fixture.txt'], { stdio: 'ignore' });
    execFileSync('git', ['-C', checkout, '-c', 'user.name=CI Test',
      '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'synthetic target'],
      { stdio: 'ignore' });
    const sha = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'],
      { encoding: 'utf8' }).trim();
    // Keep three distinct OS-assigned loopback ports until all are selected.
    for (let i = 0; i < 3; i++) {
      const socket = createServer();
      await new Promise((resolve, reject) =>
        socket.once('error', reject).listen({ host: '127.0.0.1', port: 0 }, resolve));
      // A kernel-selected ephemeral port can coincide with a historical port
      // deliberately refused by the real target assessor.
      if ([3000, 3001, 3002, 4173, 4174, 4175, 5432, 55434].includes(socket.address().port)) {
        await close(socket); i--; continue;
      }
      listeners.push(socket);
    }
    const ports = listeners.map(socket => socket.address().port);
    for (const socket of listeners) await close(socket);
    listeners.length = 0;
    const input = {
      schemaVersion: 1, purpose: 'ISOLATED_PROTOTYPE_TARGET_PREFLIGHT',
      mode: 'isolated-synthetic', expectedMainSha: sha,
      companyCodes: ['PROTO_A', 'PROTO_B'], projectCount: 2,
      personas: ['Ben', 'Nancy', 'Khaimook', 'Jai', 'Store Site', 'Foreman', 'Koh', 'Porn'],
      productionConnected: false, retainedDataUsed: false, realCompanyGrantsModified: false,
      runtime: {
        checkoutRoot: checkout, isolationRoot: isolation,
        databaseRoot: join(isolation, 'db'), documentsRoot: join(isolation, 'documents'),
        hrKeysRoot: join(isolation, 'hrkeys'),
        apiOrigin: 'http://127.0.0.1:' + ports[0],
        webOrigin: 'http://127.0.0.1:' + ports[1],
        postgresHost: '127.0.0.1', postgresPort: ports[2], postgresDbName: 'proto_port_test',
      },
    };
    const passed = await assessPrototypePorts(input, sha);
    assert.equal(passed.status, 'PORTS_TEMPORARILY_BINDABLE');
    assert.equal(passed.checkedPorts, 3);
    assert.equal(passed.portsHeldAfterCheck, 0);
    for (const port of ports) {
      const released = await reserveLoopbackPort(port);
      await released.close();
    }
    const busy = createServer();
    await new Promise((resolve, reject) =>
      busy.once('error', reject).listen({ host: '127.0.0.1', port: ports[2] }, resolve));
    listeners.push(busy);
    const blocked = await assessPrototypePorts(input, sha);
    assert.deepEqual(blocked.gaps, ['PORT_DATABASE_UNAVAILABLE']);
    assert.equal(blocked.checkedPorts, 3);
    for (const port of ports.slice(0, 2)) {
      const released = await reserveLoopbackPort(port);
      await released.close();
    }
    await writeFile(join(checkout, 'fixture.txt'), 'dirty target checkout');
    let attempted = 0;
    const dirty = await assessPrototypePorts(input, sha, {
      reserve: async () => { attempted++; throw Error('must not bind'); },
    });
    assert.deepEqual(dirty.gaps, ['TARGET_PREFLIGHT_REQUIRED']);
    assert.equal(attempted, 0);
  } finally {
    for (const socket of listeners) if (socket.listening) await close(socket);
    await rm(root, { recursive: true, force: true });
  }
});
