import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function fail(message) {
  process.stderr.write(`Document storage verification failed: ${message}\n`);
  process.exit(1);
}

const storageRoot = process.env.DOCUMENT_STORAGE_ROOT ?? process.env.RESTORE_STORAGE_ROOT;
if (!storageRoot || !path.isAbsolute(storageRoot)) {
  fail('DOCUMENT_STORAGE_ROOT (or RESTORE_STORAGE_ROOT) must be an absolute path');
}

const root = path.resolve(storageRoot);
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
    if (!target.startsWith(root + path.sep)) {
      fail(`document ${document.id} resolves outside restored storage`);
    }

    let fileStat;
    try {
      fileStat = await stat(target);
    } catch {
      fail(`document ${document.id} is missing restored bytes`);
    }
    if (!fileStat.isFile()) fail(`document ${document.id} storage target is not a file`);
    if (fileStat.size !== document.fileSizeBytes) {
      fail(`document ${document.id} size does not match restored metadata`);
    }

    if (document.checksum) {
      const bytes = await readFile(target);
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum !== document.checksum) {
        fail(`document ${document.id} checksum does not match restored metadata`);
      }
    }
  }

  process.stdout.write(`Document storage verification passed for ${documents.length} LOCAL document record(s).\n`);
} finally {
  await prisma.$disconnect();
}
