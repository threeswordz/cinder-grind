import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

function fail(message) {
  process.stderr.write(`Recovery path safety check failed: ${message}\n`);
  process.exit(1);
}

function canonicalizeAllowMissing(raw, label) {
  if (!raw || !path.isAbsolute(raw)) {
    fail(`${label} must be an absolute path`);
  }

  let candidate = path.resolve(raw);
  const missing = [];

  while (!existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      fail(`unable to resolve existing ancestor for ${label}`);
    }
    missing.unshift(path.basename(candidate));
    candidate = parent;
  }

  let canonical;
  try {
    canonical = realpathSync(candidate);
  } catch (error) {
    fail(
      `unable to canonicalize ${label}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return path.normalize(path.join(canonical, ...missing));
}

function contains(parent, child) {
  if (parent === child) return true;
  const prefix = parent.endsWith(path.sep) ? parent : parent + path.sep;
  return child.startsWith(prefix);
}

const [command, firstRaw, secondRaw, thirdRaw] = process.argv.slice(2);

if (command === 'recovery-root') {
  const recoveryRoot = canonicalizeAllowMissing(firstRaw, 'RECOVERY_ROOT');
  const repoRoot = canonicalizeAllowMissing(secondRaw, 'repository root');
  const storageRoot = canonicalizeAllowMissing(thirdRaw, 'STORAGE_ROOT');

  if (contains(repoRoot, recoveryRoot)) {
    fail('RECOVERY_ROOT must be outside the repository');
  }
  if (contains(storageRoot, recoveryRoot)) {
    fail('RECOVERY_ROOT must be outside Documents storage');
  }
  if (contains(recoveryRoot, storageRoot)) {
    fail('STORAGE_ROOT must not be inside RECOVERY_ROOT');
  }

  process.stdout.write(recoveryRoot);
  process.exit(0);
}

if (command === 'restore-storage') {
  const restoreStorageRoot = canonicalizeAllowMissing(
    firstRaw,
    'RESTORE_STORAGE_ROOT',
  );
  const storageRoot = canonicalizeAllowMissing(secondRaw, 'STORAGE_ROOT');

  if (contains(storageRoot, restoreStorageRoot)) {
    fail('RESTORE_STORAGE_ROOT must be outside live Documents storage');
  }
  if (contains(restoreStorageRoot, storageRoot)) {
    fail('RESTORE_STORAGE_ROOT must not contain live Documents storage');
  }

  process.stdout.write(restoreStorageRoot);
  process.exit(0);
}

fail(
  'usage: path-safety.mjs recovery-root <recovery-root> <repo-root> <storage-root> | restore-storage <restore-storage-root> <storage-root>',
);
