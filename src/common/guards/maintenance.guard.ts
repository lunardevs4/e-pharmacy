import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemService } from '../../system/system.service';
import { UserRole } from '@generated/prisma';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(forwardRef(() => SystemService))
    private readonly systemService: SystemService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const status = await this.systemService.getSystemStatus();

    // If system is operating normally, allow all traffic
    if (status.mode === 'OPERATIONAL') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path: string = request.url || request.originalUrl || '';

    // Exempt paths: health checks, admin system management, public status, auth endpoints
    const isExemptPath =
      path.includes('/api/v1/admin/system') ||
      path.includes('/api/v1/public/system-status') ||
      path.startsWith('/health') ||
      path.includes('/api/v1/health') ||
      path.includes('/api/v1/auth/');

    if (isExemptPath) {
      return true;
    }

    // Allow Admin users bypass
    const user = request.user;
    if (user && user.role === UserRole.ADMIN) {
      return true;
    }

    // Otherwise, throw 503 Service Unavailable with maintenance or lockdown code
    if (status.mode === 'LOCKDOWN') {
      throw new ServiceUnavailableException({
        code: 'SYSTEM_EMERGENCY_LOCKDOWN',
        message:
          'System is currently under emergency lockdown. All user actions are disabled.',
        reason: status.reason,
        mode: 'LOCKDOWN',
        updatedAt: status.updatedAt,
      });
    }

    throw new ServiceUnavailableException({
      code: 'SYSTEM_MAINTENANCE',
      message:
        status.message ||
        'System is currently undergoing scheduled maintenance. Please check back later.',
      reason: status.reason,
      estimatedEndTime: status.estimatedEndTime,
      mode: 'MAINTENANCE',
      updatedAt: status.updatedAt,
    });
  }
}
