import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Readable } from 'node:stream';
import { ExecutionContext } from '@nestjs/common';
import { lastValueFrom, throwError } from 'rxjs';

import {
  cleanupUploadedDocumentFile,
  checksumUploadedDocumentFile,
  DocumentUploadCleanupInterceptor,
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
      '2e118d214dd47d9015f5c01bae0b386b2a958f54696ce1f62729903ce3096680',
    );
  } finally {
    await cleanupUploadedDocumentFile(file);
  }

  await assert.rejects(() => readFile(info.path));
});


test('upload cleanup interceptor removes staged files when downstream validation fails', async () => {
  const bytes = Buffer.from('validation-failure-upload');
  const storage = documentUploadStorage();
  const info = await new Promise<{
    destination: string;
    filename: string;
    path: string;
    size: number;
  }>((resolve, reject) => {
    storage._handleFile({}, { stream: Readable.from(bytes) }, (error, stored) => {
      if (error) reject(error);
      else if (!stored) reject(new Error('Upload storage returned no file info.'));
      else resolve(stored);
    });
  });
  const file: UploadedDocumentFile = {
    originalname: 'invalid.pdf',
    mimetype: 'application/pdf',
    size: info.size,
    path: info.path,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ file }) }),
  } as unknown as ExecutionContext;
  const interceptor = new DocumentUploadCleanupInterceptor();

  await assert.rejects(
    () =>
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new Error('validation failed')),
        }),
      ),
    /validation failed/,
  );
  await assert.rejects(() => readFile(info.path));
});
