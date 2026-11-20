// CI-only controlled two-lane rehearsal scheduler. Every historical release
// predecessor still runs the unmodified rehearsal and produces the same evidence.
// Different invocations own distinct databases, ports, worktrees and temp trees.
// The combined evidence verifier in validate.yml remains unchanged.
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const GROUPS = Object.freeze([
  Object.freeze([
    {name:'V1.0-E', previous:'65857a384005e1734028ffb6945b1077ed3449e5', file:'/tmp/v1-0-e-rehearsal.json'},
    {name:'Customer BOQ', previous:'fc52a867c96a8b3a369b480b9799bad1a5e9f399', file:'/tmp/v1-3-customer-boq-rehearsal.json'},
    {name:'HR1-A', previous:'e86ed846f30ac3feeb09f74ba9084571b9955520', file:'/tmp/hr1-a-employee-rehearsal.json'},
    {name:'Material request', previous:'3a5ae8a92083a2bd03f4159b1e84d0565e7e78ec', file:'/tmp/material-request-rehearsal.json'},
  ]),
  Object.freeze([
    {name:'Material plan entry', previous:'34e022d5807d3e16458437a02ebba669ba838c6a', file:'/tmp/material-plan-rehearsal.json'},
    {name:'Material plan B1', previous:'5209c30a1b7b282a603ba09d4a5bd82a700a183f', file:'/tmp/material-plan-issue-rehearsal.json'},
    {name:'Post-FM03 receiving', previous:'d2b790801119fb1b5b4176ad416086ee7363d091', file:'/tmp/receiving-rehearsal.json'},
    {name:'Material UOM approved entry', previous:'59d67d1f2e54e6bfde51e4c5be336ea97906bf52', file:'/tmp/material-uom-rehearsal.json'},
  ]),
]);

// Wait for BOTH groups so independent on-exit database/worktree cleanup finishes.
// An unsuccessful group can never yield a successful combined step.
export async function runGroups(groups, runOne) {
  const outcomes = await Promise.allSettled(groups.map(async group => {
    for (const entry of group) await runOne(entry);
  }));
  const failures = outcomes.filter(outcome => outcome.status === 'rejected');
  if (failures.length) throw new AggregateError(failures.map(f => f.reason), 'Historical rehearsal group failed; full release evidence is invalid');
}

export function verifyEvidence(groups, releaseCommit, read = readFileSync, githubRunId = null) {
  const seenPaths = new Set();
  const seenCommits = new Set();
  for (const entry of groups.flat()) {
    if (!/^[0-9a-f]{40}$/.test(entry.previous) || seenPaths.has(entry.file) || seenCommits.has(entry.previous)) {
      throw new Error('Duplicate or invalid historical predecessor: ' + entry.name);
    }
    seenPaths.add(entry.file);
    seenCommits.add(entry.previous);
    let evidence;
    try { evidence = JSON.parse(read(entry.file, 'utf8')); }
    catch { throw new Error('Missing or unreadable historical evidence: ' + entry.name); }
    if (evidence.releaseCommit !== releaseCommit ||
        evidence.previousReleaseCommit !== entry.previous ||
        evidence.exactCheckout !== 'PASS' ||
        evidence.cleanTree !== 'PASS' ||
        evidence.freshMigration !== 'PASS' ||
        evidence.verifiedRecoveryPoint !== 'PASS' ||
        evidence.productionPreparation !== 'PASS' ||
        evidence.rollbackReadiness !== 'PASS') {
      throw new Error('Missing exact predecessor PASS proof: ' + entry.name);
    }
    if (githubRunId && (evidence.ci?.provider !== 'github-actions' || evidence.ci.runId !== githubRunId)) {
      throw new Error('Historical evidence is not from this GitHub Actions run: ' + entry.name);
    }
  }
  if (seenPaths.size !== 8) throw new Error('Expected exactly eight historical predecessor evidences');
}

export async function main() {
  const release = process.env.RELEASE_COMMIT || '';
  const database = process.env.RC_BASE_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!/^[0-9a-f]{40}$/.test(release) || !database ||
      process.env.RC_NON_PRODUCTION_CONFIRMED !== 'YES' ||
      (process.env.RC_ENVIRONMENT || '').toLowerCase() !== 'ci' ||
      process.env.RC_POSTGRES_TOOL_MODE !== 'docker' ||
      process.env.GITHUB_ACTIONS !== 'true' ||
      !process.env.GITHUB_RUN_ID) {
    throw new Error('Parallel rehearsal requires exact GitHub CI, non-Production, Docker PostgreSQL and a fixed release commit');
  }
  const entries = GROUPS.flat();
  if (entries.length !== 8 || new Set(entries.map(x => x.file)).size !== 8) {
    throw new Error('Required historical rehearsal inventory is incomplete');
  }
  // Reset all evidence before any child starts. Never reuse stale PASS JSON.
  for (const entry of entries) {
    writeFileSync(entry.file, '{"version":1,"rehearsalStatus":"INCOMPLETE"}\n', {mode:0o600});
  }
  const directory = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const runOne = entry => new Promise((accept, reject) => {
    process.stdout.write('START ' + entry.name + ' / ' + entry.previous + '\n');
    const child = spawn('bash', ['deploy/release-candidate/rehearse.sh'], {
      cwd: directory,
      env: {
        ...process.env,
        RC_NON_PRODUCTION_CONFIRMED: 'YES',
        RC_ENVIRONMENT: 'ci',
        RC_POSTGRES_TOOL_MODE: 'docker',
        RC_BASE_DATABASE_URL: database,
        RC_PREVIOUS_RELEASE_COMMIT: entry.previous,
        RC_EVIDENCE_FILE: entry.file,
        RELEASE_COMMIT: release,
      },
      stdio:'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0 && !signal) {
        process.stdout.write('PASS ' + entry.name + '\n');
        accept();
      } else {
        reject(new Error('Rehearsal failed: ' + entry.name + ' (code ' + code + ', signal ' + signal + ')'));
      }
    });
  });
  await runGroups(GROUPS, runOne);
  verifyEvidence(GROUPS, release, readFileSync, process.env.GITHUB_RUN_ID);
  process.stdout.write('PASS: eight exact historical predecessors, two isolated concurrent groups, full evidence retained\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(String(error?.stack || error) + '\n');
    process.exitCode = 1;
  });
}
