import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type CorrelatedRequest = { url?: string; correlationId?: string };
type HttpResponse = {
  status(code: number): HttpResponse;
  type?(contentType: string): HttpResponse;
  json(body: unknown): void;
};
type HttpExceptionBody = {
  code?: unknown;
  message?: unknown;
  detail?: unknown;
  errors?: unknown;
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<CorrelatedRequest>();
    const response = http.getResponse<HttpResponse>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = isHttpException ? exception.getResponse() : undefined;
    const body: HttpExceptionBody =
      typeof exceptionBody === 'object' && exceptionBody !== null
        ? (exceptionBody as HttpExceptionBody)
        : {};

    const detail =
      status >= 500
        ? 'An unexpected server error occurred.'
        : this.readDetail(body, exception as HttpException);
    const code =
      typeof body.code === 'string' ? body.code : this.defaultCode(status);

    if (!isHttpException) {
      this.logger.error(
        'Unhandled request error',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status);
    response.type?.('application/problem+json');
    response.json({
      type: `https://construction-erp.local/problems/${code.toLowerCase().replaceAll('_', '-')}`,
      title: this.titleForStatus(status),
      status,
      code,
      detail,
      instance: request.url ?? '',
      correlationId: request.correlationId ?? '',
      ...(Array.isArray(body.errors) ? { errors: body.errors } : {}),
    });
  }

  private readDetail(body: HttpExceptionBody, exception: HttpException): string {
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) {
      return body.message
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }
    return exception.message;
  }

  private defaultCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST: return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED: return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN: return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND: return 'NOT_FOUND';
      case HttpStatus.CONFLICT: return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY: return 'VALIDATION_ERROR';
      case HttpStatus.SERVICE_UNAVAILABLE: return 'SERVICE_UNAVAILABLE';
      default: return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
    }
  }

  private titleForStatus(status: number): string {
    if (status >= 500) return 'Server error';
    if (status === HttpStatus.NOT_FOUND) return 'Not found';
    if (status === HttpStatus.FORBIDDEN) return 'Forbidden';
    if (status === HttpStatus.UNAUTHORIZED) return 'Unauthorized';
    if (status === HttpStatus.CONFLICT) return 'Conflict';
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) return 'Validation failed';
    return 'Request failed';
  }
}
