import { Controller, Get } from '@nestjs/common';

import {
  HealthService,
  HealthStatus,
  LivenessStatus,
} from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }

  @Get('live')
  live(): LivenessStatus {
    return this.healthService.live();
  }

  @Get('ready')
  ready(): Promise<HealthStatus> {
    return this.healthService.ready();
  }
}
