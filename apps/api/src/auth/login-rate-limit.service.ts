import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type AttemptWindow = {
  count: number;
  resetAt: number;
};

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_WINDOW_MINUTES = 15;

@Injectable()
export class LoginRateLimitService {
  private readonly attempts = new Map<string, AttemptWindow>();

  consume(key: string): void {
    const now = Date.now();
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
    const windowMs = windowMinutes * 60 * 1000;

    const existing = this.attempts.get(key);
    if (!existing || existing.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (existing.count >= maxAttempts) {
      throw new HttpException(
        {
          code: 'LOGIN_RATE_LIMITED',
          detail: 'Too many login attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
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
