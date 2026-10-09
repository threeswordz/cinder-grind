import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Readable } from 'node:stream';

import {
  cleanupUploadedDocumentFile,
  checksumUploadedDocumentFile,
  documentUploadStorage,
} from './document-upload-storage';
import { UploadedDocumentFile } from './document-policy.service';

test('document upload storage streams bytes to managed temp disk without a memory buffer', async () => {
  const bytes = Buffer.from('streamed-upload');
  const storage = documentUploadStorage();

  const info = await new Promise<{
    destination: string;
    filename: string;
    path: string;
    size: number;
  }>((resolve, reject) => {
    storage._handleFile(
      {},
      { stream: Readable.from(bytes) },
      (error, stored) => {
        if (error) reject(error);
        else if (!stored) reject(new Error('Upload storage returned no file info.'));
        else resolve(stored);
      },
    );
  });

  const file: UploadedDocumentFile = {
    originalname: 'contract.pdf',
    mimetype: 'application/pdf',
    size: info.size,
    path: info.path,
  };

  try {
    assert.deepEqual(await readFile(info.path), bytes);
    assert.equal('buffer' in file, false);
    assert.equal(info.size, bytes.length);
    assert.equal(
      await checksumUploadedDocumentFile(file),
      '32b9102c90c3477fa726947c8948d90f6416f6b075cd0e7c9d43021b9df50b7c',
    );
  } finally {
    await cleanupUploadedDocumentFile(file);
  }

  await assert.rejects(() => readFile(info.path));
});
