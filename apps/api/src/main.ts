import 'reflect-metadata';
import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

function getPort(): number {
  const rawPort = process.env.API_PORT ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('API_PORT must be a valid TCP port.');
  }
  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  await app.listen(getPort());
}

void bootstrap();
