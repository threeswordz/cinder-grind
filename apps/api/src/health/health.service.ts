import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { DocumentStorage } from '../documents/document-storage';
import { PrismaService } from '../prisma/prisma.service';

export type LivenessStatus = {
  status: 'ok';
  timestamp: string;
};

export type HealthStatus = LivenessStatus & {
  database: 'ok';
  documentStorage: 'ok';
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentStorage: DocumentStorage,
  ) {}

  live(): LivenessStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  check(): Promise<HealthStatus> {
    return this.ready();
  }

  async ready(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        detail: 'Database health check failed.',
      });
    }

    try {
      await this.documentStorage.assertReady();
    } catch {
      throw new ServiceUnavailableException({
        code: 'DOCUMENT_STORAGE_UNAVAILABLE',
        detail: 'Document storage health check failed.',
      });
    }

    return {
      status: 'ok',
      database: 'ok',
      documentStorage: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
