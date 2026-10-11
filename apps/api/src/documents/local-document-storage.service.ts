import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DocumentStorage, StoredDocument } from './document-storage';

@Injectable()
export class LocalDocumentStorage extends DocumentStorage {
  private readonly root = path.resolve(
    process.cwd(),
    process.env.STORAGE_ROOT ?? '../../storage',
  );

  async assertReady(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        const deploymentId = process.env.STORAGE_DEPLOYMENT_ID;
        if (!deploymentId) throw new Error('missing storage deployment identity');
        await access(this.root, constants.R_OK | constants.W_OK);
        const sentinel = await readFile(
          path.join(this.root, '.construction-erp-storage-ready'),
          'utf8',
        );
        if (sentinel.trim() !== `construction-erp-production-storage-v1:${deploymentId}`) {
          throw new Error('invalid sentinel');
        }
      } else {
        await mkdir(this.root, { recursive: true });
        await access(this.root, constants.R_OK | constants.W_OK);
      }
      await this.probeWriteReadiness();
    } catch {
      throw new ServiceUnavailableException({
        code: 'DOCUMENT_STORAGE_UNAVAILABLE',
        detail: 'Persistent document storage is unavailable.',
      });
    }
  }

  private async probeWriteReadiness(): Promise<void> {
    const probePath = path.join(
      this.root,
      `.construction-erp-readiness-${randomUUID()}`,
    );
    let created = false;
    try {
      await writeFile(probePath, Buffer.from('ready'), {
        flag: 'wx',
        mode: 0o600,
      });
      created = true;
      await unlink(probePath);
      created = false;
    } finally {
      if (created) {
        try {
          await unlink(probePath);
        } catch {
          // Best-effort cleanup; the readiness call still fails with the
          // original write/unlink error so operators do not receive a false OK.
        }
      }
    }
  }

  async put(bytes: Buffer): Promise<StoredDocument> {
    await this.assertReady();
    const storageKey = randomUUID();
    await writeFile(this.resolveKey(storageKey), bytes, { flag: 'wx' });
    return { storageProvider: 'LOCAL', storageKey };
  }

  async putFile(sourcePath: string): Promise<StoredDocument> {
    await this.assertReady();
    const storageKey = randomUUID();
    const target = this.resolveKey(storageKey);
    try {
      await copyFile(sourcePath, target, constants.COPYFILE_EXCL);
      return { storageProvider: 'LOCAL', storageKey };
    } catch (error) {
      try {
        await unlink(target);
      } catch {
        // Best-effort cleanup of a partially copied destination.
      }
      throw error;
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    if (process.env.NODE_ENV === 'production') await this.assertReady();
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
    if (process.env.NODE_ENV === 'production') await this.assertReady();
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
