import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/guards/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';
import { SystemService } from '../system/system.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemService: SystemService,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    return this.ready();
  }

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  async live() {
    const sysStatus = await this.systemService.getPublicStatus();
    return {
      status: sysStatus.mode === 'OPERATIONAL' ? 'ok' : 'maintenance',
      mode: sysStatus.mode,
      service: 'e-pharmacy-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    const sysStatus = await this.systemService.getPublicStatus();
    try {
      await this.prisma.prisma.$queryRaw`SELECT 1`;
      return {
        status: sysStatus.mode === 'OPERATIONAL' ? 'ok' : 'maintenance',
        mode: sysStatus.mode,
        checks: {
          database: 'ok',
          system: sysStatus.mode.toLowerCase(),
        },
        ...(sysStatus.mode !== 'OPERATIONAL'
          ? {
              maintenance: {
                message: sysStatus.message,
                reason: sysStatus.reason,
                estimatedEndTime: sysStatus.estimatedEndTime,
              },
            }
          : {}),
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service dependencies are unavailable',
        checks: { database: 'failed' },
      });
    }
  }
}
