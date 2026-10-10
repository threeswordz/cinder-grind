import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MINUTES = 15;
const PURGE_BATCH_SIZE = 100;

@Injectable()
export class LoginRateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async consume(clientKey: string): Promise<void> {
    const maxAttempts = this.readPositiveInteger(
      process.env.LOGIN_RATE_LIMIT_MAX,
      DEFAULT_MAX_ATTEMPTS,
      1000,
      'LOGIN_RATE_LIMIT_MAX',
    );
    const windowMinutes = this.readPositiveInteger(
      process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES,
      DEFAULT_WINDOW_MINUTES,
      1440,
      'LOGIN_RATE_LIMIT_WINDOW_MINUTES',
    );
    await this.purgeExpiredBuckets();
    const resetAt = new Date(Date.now() + windowMinutes * 60 * 1000);

    const rows = await this.prisma.$queryRaw<Array<{ attempt_count: number }>>(
      Prisma.sql`
        INSERT INTO "login_rate_limit_buckets"
          ("client_key", "attempt_count", "reset_at", "created_at", "updated_at")
        VALUES
          (${clientKey}, 1, ${resetAt}, NOW(), NOW())
        ON CONFLICT ("client_key") DO UPDATE SET
          "attempt_count" = CASE
            WHEN "login_rate_limit_buckets"."reset_at" <= NOW() THEN 1
            ELSE "login_rate_limit_buckets"."attempt_count" + 1
          END,
          "reset_at" = CASE
            WHEN "login_rate_limit_buckets"."reset_at" <= NOW() THEN ${resetAt}
            ELSE "login_rate_limit_buckets"."reset_at"
          END,
          "updated_at" = NOW()
        RETURNING "attempt_count"
      `,
    );

    const count = rows[0]?.attempt_count;
    if (count === undefined) throw new Error('Login rate-limit state was not persisted.');
    if (count > maxAttempts) {
      throw new HttpException(
        { code: 'LOGIN_RATE_LIMITED', detail: 'Too many login attempts. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async reset(clientKey: string): Promise<void> {
    await this.prisma.loginRateLimitBucket.deleteMany({ where: { clientKey } });
  }

  private async purgeExpiredBuckets(): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "login_rate_limit_buckets"
        WHERE "client_key" IN (
          SELECT "client_key"
          FROM "login_rate_limit_buckets"
          WHERE "reset_at" <= NOW()
          ORDER BY "reset_at" ASC, "client_key" ASC
          LIMIT ${PURGE_BATCH_SIZE}
        )
      `,
    );
  }

  private readPositiveInteger(
    raw: string | undefined,
    fallback: number,
    maximum: number,
    name: string,
  ): number {
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > maximum) {
      throw new Error(`${name} must be an integer from 1 to ${maximum}.`);
    }
    return value;
  }
}
