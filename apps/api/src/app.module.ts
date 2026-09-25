import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({ imports: [PrismaModule, AuthModule, HealthModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
