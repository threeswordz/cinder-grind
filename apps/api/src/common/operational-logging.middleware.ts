import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

import { buildRequestOperationalEvent } from './operational-log';

type OperationalRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  correlationId?: string;
};
type OperationalResponse = {
  statusCode: number;
  once(event: 'finish', listener: () => void): void;
};
type Next = () => void;

@Injectable()
export class OperationalLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('Operational');

  use(
    request: OperationalRequest,
    response: OperationalResponse,
    next: Next,
  ): void {
    const startedAt = process.hrtime.bigint();
    response.once('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log(
        JSON.stringify(
          buildRequestOperationalEvent({
            method: request.method,
            url: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs,
            correlationId: request.correlationId,
          }),
        ),
      );
    });
    next();
  }
}
