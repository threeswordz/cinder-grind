import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function fail(message) {
  process.stderr.write(`Document storage verification failed: ${message}\n`);
  process.exit(1);
}

function isContained(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

const storageRoot = process.env.DOCUMENT_STORAGE_ROOT ?? process.env.RESTORE_STORAGE_ROOT;
if (!storageRoot || !path.isAbsolute(storageRoot)) {
  fail('DOCUMENT_STORAGE_ROOT (or RESTORE_STORAGE_ROOT) must be an absolute path');
}

const root = path.resolve(storageRoot);
let canonicalRoot;
try {
  canonicalRoot = await realpath(root);
} catch {
  fail('configured document storage root does not exist');
}

const prisma = new PrismaClient();

try {
  const documents = await prisma.document.findMany({
    where: { storageProvider: 'LOCAL' },
    select: {
      id: true,
      storageKey: true,
      fileSizeBytes: true,
      checksum: true,
    },
  });

  for (const document of documents) {
    const target = path.resolve(root, document.storageKey);
    if (!isContained(root, target)) {
      fail(`document ${document.id} resolves outside restored storage`);
    }

    let fileStat;
    try {
      fileStat = await lstat(target);
    } catch {
      fail(`document ${document.id} is missing restored bytes`);
    }
    if (fileStat.isSymbolicLink()) {
      fail(`document ${document.id} storage target must not be a symbolic link`);
    }
    if (!fileStat.isFile()) fail(`document ${document.id} storage target is not a file`);

    let canonicalTarget;
    try {
      canonicalTarget = await realpath(target);
    } catch {
      fail(`document ${document.id} storage target cannot be resolved`);
    }
    if (!isContained(canonicalRoot, canonicalTarget)) {
      fail(`document ${document.id} canonical storage target escapes restored storage`);
    }

    if (fileStat.size !== document.fileSizeBytes) {
      fail(`document ${document.id} size does not match restored metadata`);
    }

    if (document.checksum) {
      const checksum = await sha256File(canonicalTarget);
      if (checksum !== document.checksum) {
        fail(`document ${document.id} checksum does not match restored metadata`);
      }
    }
  }

  process.stdout.write(`Document storage verification passed for ${documents.length} LOCAL document record(s).\n`);
} finally {
  await prisma.$disconnect();
}
