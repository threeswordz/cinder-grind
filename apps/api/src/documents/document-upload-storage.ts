import { createHash, randomUUID } from 'node:crypto';
import { access, lstat, mkdir, rm } from 'node:fs/promises';
import { constants, createReadStream, createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import {
  documentMaxBytes,
  UploadedDocumentFile,
} from './document-policy.service';

type StoredTempFile = {
  destination: string;
  filename: string;
  path: string;
  size: number;
};

type StorageCallback = (error: Error | null, info?: StoredTempFile) => void;
type RemoveCallback = (error: Error | null) => void;

export function documentUploadTempRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.DOCUMENT_UPLOAD_TEMP_ROOT?.trim();
  const root = configured || path.join(tmpdir(), 'construction-erp-uploads');
  if (!path.isAbsolute(root)) {
    throw new Error('DOCUMENT_UPLOAD_TEMP_ROOT must be an absolute path when configured.');
  }
  return path.resolve(root);
}

async function ensureTempRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error('Document upload temp root must be a real directory.');
  }
  await access(root, constants.W_OK);
}

function assertManagedTempPath(filePath: string): string {
  const root = documentUploadTempRoot();
  const target = path.resolve(filePath);
  if (!target.startsWith(root + path.sep)) {
    throw new Error('Uploaded temp file is outside the configured temp root.');
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      path.basename(target),
    )
  ) {
    throw new Error('Uploaded temp file name is not managed by the application.');
  }
  return target;
}

export function documentUploadLimits() {
  return {
    fileSize: documentMaxBytes(),
    fieldSize: 64 * 1024,
    fields: 5,
    files: 1,
    parts: 6,
  };
}

export function documentUploadStorage() {
  return {
    _handleFile(
      _request: unknown,
      file: { stream: Readable },
      callback: StorageCallback,
    ): void {
      void (async () => {
        const root = documentUploadTempRoot();
        await ensureTempRoot(root);
        const filename = randomUUID();
        const target = path.join(root, filename);
        try {
          await pipeline(
            file.stream,
            createWriteStream(target, { flags: 'wx', mode: 0o600 }),
          );
          const stat = await lstat(target);
          return {
            destination: root,
            filename,
            path: target,
            size: stat.size,
          };
        } catch (error) {
          await rm(target, { force: true }).catch(() => undefined);
          throw error;
        }
      })().then(
        (info) => callback(null, info),
        (error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error))),
      );
    },

    _removeFile(
      _request: unknown,
      file: { path?: string },
      callback: RemoveCallback,
    ): void {
      if (!file.path) {
        callback(null);
        return;
      }
      let target: string;
      try {
        target = assertManagedTempPath(file.path);
      } catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      void rm(target, { force: true }).then(
        () => callback(null),
        (error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error))),
      );
    },
  };
}

export async function cleanupUploadedDocumentFile(
  file: UploadedDocumentFile,
): Promise<void> {
  if (!file.path) return;
  await rm(assertManagedTempPath(file.path), { force: true });
}

export async function checksumUploadedDocumentFile(
  file: UploadedDocumentFile,
): Promise<string> {
  const hash = createHash('sha256');
  if (file.buffer !== undefined) {
    hash.update(file.buffer);
    return hash.digest('hex');
  }
  if (!file.path) throw new Error('Uploaded document has no readable content.');
  for await (const chunk of createReadStream(assertManagedTempPath(file.path))) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}


export class DocumentUploadCleanupInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ file?: UploadedDocumentFile }>();

    return new Observable((subscriber) => {
      let terminal = false;
      const cleanup = async () => {
        if (request.file) await cleanupUploadedDocumentFile(request.file);
      };
      const subscription = next.handle().subscribe({
        next: (value) => subscriber.next(value),
        error: (error: unknown) => {
          terminal = true;
          void cleanup().then(
            () => subscriber.error(error),
            (cleanupError: unknown) => subscriber.error(cleanupError),
          );
        },
        complete: () => {
          terminal = true;
          void cleanup().then(
            () => subscriber.complete(),
            (cleanupError: unknown) => subscriber.error(cleanupError),
          );
        },
      });

      return () => {
        subscription.unsubscribe();
        if (!terminal) void cleanup().catch(() => undefined);
      };
    });
  }
}
