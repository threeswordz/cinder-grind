import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type RequestWithCorrelation = {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
};
type ResponseWithHeaders = { setHeader(name: string, value: string): void };
type Next = () => void;

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelation, response: ResponseWithHeaders, next: Next): void {
    const supplied = request.headers['x-correlation-id'];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    const correlationId =
      candidate && SAFE_CORRELATION_ID.test(candidate) ? candidate : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
