import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AUDIT_ROUTE_MAP } from './audit.config';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditLogsService: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method?.toUpperCase();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path: string = req.route?.path ?? req.url ?? '';

    const match = AUDIT_ROUTE_MAP.find(
      (rule) => rule.method === method && rule.pattern.test(path),
    );

    if (!match) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (responseBody: any) => {
          const user = req.user as { id?: string } | undefined;
          const userId = user?.id ?? null;

          const entityId = this.extractEntityId(responseBody, req);

          this.auditLogsService
            .log({
              userId,
              action: match.action,
              entityType: match.entityType,
              entityId,
              pharmacyId: this.extractPharmacyId(req),
              changes: this.sanitizeChanges(req.body),
              ipAddress: this.extractIp(req),
              userAgent: req.headers?.['user-agent'] ?? null,
            })
            .catch((err: Error) => {
              this.logger.error(
                `Failed to write audit log [${match.action} ${match.entityType}]: ${err.message}`,
              );
            });
        },
      }),
    );
  }

  private extractEntityId(body: any, req: any): string | null {
    const payload = body?.data ?? body;

    if (payload?.id && typeof payload.id === 'string') {
      return payload.id;
    }

    const paramId = req.params?.id;
    if (paramId && typeof paramId === 'string') {
      return paramId;
    }

    return null;
  }

  private extractPharmacyId(req: any): string | null {
    const pharmacyId = req.params?.pharmacyId;
    return typeof pharmacyId === 'string' ? pharmacyId : null;
  }

  private sanitizeChanges(body: any): Record<string, any> | null {
    if (!body || typeof body !== 'object') return null;

    const SENSITIVE_KEYS = new Set([
      'password',
      'confirmPassword',
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'pin',
    ]);

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      sanitized[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    return sanitized;
  }

  private extractIp(req: any): string | null {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded : forwarded[0])
        .split(',')[0]
        .trim();
    }
    return req.socket?.remoteAddress ?? req.ip ?? null;
  }
}
