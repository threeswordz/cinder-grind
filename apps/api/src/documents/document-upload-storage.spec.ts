import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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


test('document upload storage removes partial temp files when the source stream aborts', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'construction-erp-upload-fail-'));
  const previousRoot = process.env.DOCUMENT_UPLOAD_TEMP_ROOT;
  process.env.DOCUMENT_UPLOAD_TEMP_ROOT = tempRoot;

  try {
    const storage = documentUploadStorage();
    let emitted = false;
    const failingStream = new Readable({
      read() {
        if (emitted) return;
        emitted = true;
        this.push(Buffer.from('partial-upload'));
        this.destroy(new Error('simulated upload abort'));
      },
    });

    await assert.rejects(
      () =>
        new Promise<void>((resolve, reject) => {
          storage._handleFile({}, { stream: failingStream }, (error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
      /simulated upload abort/,
    );
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    if (previousRoot === undefined) delete process.env.DOCUMENT_UPLOAD_TEMP_ROOT;
    else process.env.DOCUMENT_UPLOAD_TEMP_ROOT = previousRoot;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
