import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DocumentStorage, StoredDocument } from './document-storage';

@Injectable()
export class LocalDocumentStorage extends DocumentStorage {
  private readonly root = path.resolve(
    process.cwd(),
    process.env.STORAGE_ROOT ?? '../../storage',
  );

  async put(bytes: Buffer): Promise<StoredDocument> {
    await mkdir(this.root, { recursive: true });
    const storageKey = randomUUID();
    await writeFile(this.resolveKey(storageKey), bytes, { flag: 'wx' });
    return { storageProvider: 'LOCAL', storageKey };
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(storageKey));
    } catch (error) {
      if (this.errorCode(error) === 'ENOENT') {
        throw new NotFoundException({
          code: 'DOCUMENT_BYTES_NOT_FOUND',
          detail: 'Document file is not available in storage.',
        });
      }
      throw error;
    }
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(storageKey));
    } catch (error) {
      if (this.errorCode(error) !== 'ENOENT') throw error;
    }
  }

  private resolveKey(storageKey: string): string {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        storageKey,
      )
    ) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STORAGE_KEY',
        detail: 'Storage key is invalid.',
      });
    }

    const target = path.resolve(this.root, storageKey);
    if (!target.startsWith(this.root + path.sep)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STORAGE_KEY',
        detail: 'Storage key is outside the configured storage root.',
      });
    }
    return target;
  }

  private errorCode(error: unknown): string | undefined {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  }
}
