/**
 * Non-production GL-08 continuation: local bindability check AFTER the existing
 * exact-SHA, clean-checkout and isolated target manifest preflight passes.
 *
 * Uses only loopback server binds, never connects to any service, probes no
 * retained database and makes no persistent writes. All listeners are closed.
 * A free port at this instant is NOT a reservation for later startup.
 */
import { createServer } from 'node:net';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessPrototypeTarget } from './prototype-target-preflight.mjs';

const SHA = /^[a-f0-9]{40}$/;
const ERRORS = new Set(['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL']);

function outcome(gaps, inspected) {
  return {
    purpose: 'ISOLATED_PROTOTYPE_PORT_PREFLIGHT',
    status: gaps.length ? 'PORT_PREFLIGHT_BLOCKED' : 'PORTS_TEMPORARILY_BINDABLE',
    gaps, checkedPorts: inspected,
    portsHeldAfterCheck: gaps.includes('PORT_RELEASE_UNVERIFIED') ? 'UNKNOWN' : 0,
    persistentFilesChanged: 0, servicesContacted: 0, databasesOpened: 0,
    runtimeRunningVerified: false, portsReservedForStartup: false,
    effectiveGrantsVerified: false, prototypeFreezeCertified: false,
    humanUatCompleted: false, productionAuthorized: false,
  };
}

/** Returns an open, exclusively bound loopback listener with a safe closer. */
export function reserveLoopbackPort(port) {
  return new Promise((resolveReservation, reject) => {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      reject(new Error('UNSAFE_LOCAL_PORT'));
      return;
    }
    const server = createServer();
    // A race from a local client must not leave hanging sockets or touch data.
    server.on('connection', socket => socket.destroy());
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.removeListener('error', reject);
      resolveReservation({ close: () => new Promise((done, fail) => {
        server.close(error => error ? fail(error) : done());
      }) });
    });
  });
}

/**
 * 'assess' and 'reserve' are injectable for fail-closed no-I/O tests.
 * The real assessor must pass before even trying to open a local port.
 */
export async function assessPrototypePorts(manifest, expectedMainSha, {
  assess = assessPrototypeTarget,
  reserve = reserveLoopbackPort,
} = {}) {
  if (!SHA.test(expectedMainSha ?? '')) throw new Error('EXPECTED_MAIN_SHA_INVALID');
  const inspected = await assess(manifest, expectedMainSha);
  if (inspected?.status !== 'LOCAL_SAFETY_PREREQUISITES_OBSERVED' ||
      !Array.isArray(inspected?.gaps) || inspected.gaps.length > 0)
    return outcome(['TARGET_PREFLIGHT_REQUIRED'], 0);
  const runtime = manifest.runtime;
  // Defense in depth: do not trust an injected/erroneous successful assessor.
  const addresses = [
    ['API', runtime.apiOrigin], ['WEB', runtime.webOrigin],
  ];
  const ports = [];
  for (const [name, value] of addresses) {
    let parsed;
    try { parsed = new URL(value); } catch { return outcome(['NON_LOOPBACK_TARGET'], 0); }
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' ||
        parsed.username || parsed.password || parsed.search || parsed.hash ||
        parsed.pathname !== '/' || !parsed.port)
      return outcome(['NON_LOOPBACK_TARGET'], 0);
    ports.push([name, Number(parsed.port)]);
  }
  if (runtime.postgresHost !== '127.0.0.1') return outcome(['NON_LOOPBACK_TARGET'], 0);
  ports.push(['DATABASE', runtime.postgresPort]);
  if (new Set(ports.map(([, port]) => port)).size !== 3 ||
      ports.some(([,port]) => !Number.isInteger(port) || port < 1024 || port > 65535))
    return outcome(['INVALID_OR_OVERLAPPING_PORTS'], 0);

  const held = [];
  const gaps = [];
  let attempted = 0;
  try {
    for (const [name, port] of ports) {
      attempted++;
      try {
        held.push(await reserve(port));
      } catch (e) {
        // Error code only, never print host data, user secrets or full errors.
        gaps.push(ERRORS.has(e?.code) ? 'PORT_' + name + '_UNAVAILABLE' : 'PORT_' + name + '_PROBE_FAILED');
        break;
      }
    }
  } finally {
    for (const handle of held.reverse()) {
      try { await handle.close(); }
      catch { gaps.push('PORT_RELEASE_UNVERIFIED'); }
    }
  }
  return outcome(gaps, attempted);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [manifestPath, sha] = process.argv.slice(2);
  if (!manifestPath || !SHA.test(sha ?? '')) {
    console.error('Usage: node deploy/uat/prototype-target-port-preflight.mjs PRIVATE_MANIFEST.json EXACT_MAIN_SHA');
    process.exitCode = 2;
  } else {
    try {
      const stat = await lstat(manifestPath);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 ||
          (process.getuid && stat.uid !== process.getuid()))
        throw new Error('PRIVATE_MANIFEST_UNSAFE');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const result = await assessPrototypePorts(manifest, sha);
      console.log(JSON.stringify(result, null, 2));
      if (result.gaps.length) process.exitCode = 1;
    } catch {
      console.error('PROTOTYPE_PORT_PREFLIGHT_INPUT_OR_INSPECTION_ERROR');
      process.exitCode = 2;
    }
  }
}
