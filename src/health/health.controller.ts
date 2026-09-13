import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../common/guards/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return {
      status: 'ok',
      service: 'e-pharmacy-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async ready() {
    try {
      await this.prisma.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        checks: { database: 'ok' },
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
