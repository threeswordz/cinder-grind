import {
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export type UploadedDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
};

export function documentMaxBytes(): number {
  const raw = process.env.DOCUMENT_MAX_FILE_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_BYTES;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 2_000_000_000) {
    throw new Error('DOCUMENT_MAX_FILE_BYTES must be an integer between 1 and 2000000000.');
  }
  return value;
}

@Injectable()
export class DocumentPolicyService {
  readonly maxBytes = documentMaxBytes();
  readonly allowedMimeTypes = new Set(
    (process.env.DOCUMENT_ALLOWED_MIME_TYPES?.split(',') ?? DEFAULT_MIME_TYPES)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );

  validate(file: UploadedDocumentFile): { fileName: string; mimeType: string } {
    if (
      file.size < 1 ||
      (file.buffer !== undefined && file.buffer.length < 1) ||
      (file.buffer === undefined && file.path === undefined)
    ) {
      throw new UnprocessableEntityException({
        code: 'EMPTY_DOCUMENT',
        detail: 'Uploaded document must not be empty.',
      });
    }
    if (
      file.size > this.maxBytes ||
      (file.buffer !== undefined && file.buffer.length > this.maxBytes)
    ) {
      throw new PayloadTooLargeException({
        code: 'DOCUMENT_TOO_LARGE',
        detail: 'Uploaded document exceeds the configured size limit.',
      });
    }

    const mimeType = file.mimetype.trim().toLowerCase();
    if (!this.allowedMimeTypes.has(mimeType)) {
      throw new UnsupportedMediaTypeException({
        code: 'DOCUMENT_TYPE_NOT_ALLOWED',
        detail: 'Uploaded document MIME type is not allowed.',
      });
    }

    const fileName = file.originalname.trim();
    if (
      !fileName ||
      fileName.length > 255 ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      /[\u0000-\u001f\u007f]/.test(fileName) ||
      fileName === '.' ||
      fileName === '..'
    ) {
      throw new UnprocessableEntityException({
        code: 'UNSAFE_FILE_NAME',
        detail: 'Uploaded filename is invalid.',
      });
    }

    return { fileName, mimeType };
  }
}
