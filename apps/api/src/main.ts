import 'reflect-metadata';
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';
import { corsOriginPolicy } from './common/cors-origin';
import { serializeOperationalEvent, startupFailureReason } from './common/operational-log';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { securityHeadersMiddleware } from './common/security-headers';
import { requestBodyMaxBytes, validateProductionConfig } from './production-config';

const operationalLogger = new Logger('Operational');

function getPort(): number {
  const rawPort = process.env.API_PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port.');
  }
  return port;
}

async function bootstrap(): Promise<void> {
  validateProductionConfig(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  const bodyLimit = requestBodyMaxBytes();

  app.setGlobalPrefix('api/v1');
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });
  app.enableCors({
    origin: corsOriginPolicy(webOrigin),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.use(securityHeadersMiddleware(process.env.NODE_ENV === 'production'));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  const httpAdapter = app.getHttpAdapter().getInstance() as {
    disable?: (name: string) => void;
  };
  httpAdapter.disable?.('x-powered-by');

  const apiHost = process.env.API_HOST ?? '127.0.0.1';
  const apiPort = getPort();
  await app.listen(apiPort, apiHost);
  operationalLogger.log(
    serializeOperationalEvent('service.start', {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      port: apiPort,
    }),
  );
}

void bootstrap().catch((error: unknown) => {
  operationalLogger.error(
    serializeOperationalEvent('service.start.failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      reason: startupFailureReason(error),
    }),
  );
  process.exitCode = 1;
});
