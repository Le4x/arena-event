import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connectivity
      () => this.db.pingCheck('database', this.prisma),
      // Memory: Ensure heap doesn't exceed 150MB
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      // Memory: Ensure RSS doesn't exceed 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      // Disk: Ensure storage is not more than 90% full
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('ready')
  ready() {
    // Simple readiness check - is the server running?
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('live')
  live() {
    // Liveness check - for Kubernetes/container orchestration
    return { status: 'ok' };
  }
}
