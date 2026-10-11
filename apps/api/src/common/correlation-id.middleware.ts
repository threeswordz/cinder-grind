import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

type RequestWithCorrelation = {
  correlationId?: string;
};
type ResponseWithHeaders = { setHeader(name: string, value: string): void };
type Next = () => void;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithCorrelation, response: ResponseWithHeaders, next: Next): void {
    const correlationId = randomUUID();

    request.correlationId = correlationId;
    response.setHeader('X-Correlation-ID', correlationId);
    next();
  }
}
