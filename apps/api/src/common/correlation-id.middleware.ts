import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type RequestWithCorrelation = {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
};
type ResponseWithHeaders = { setHeader(name: string, value: string): void };
type Next = () => void;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelation, response: ResponseWithHeaders, next: Next): void {
    const supplied = request.headers['x-correlation-id'];
    const candidate = Array.isArray(supplied) ? supplied[0] : supplied;
    const correlationId =
      candidate && candidate.length <= 128 ? candidate : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
