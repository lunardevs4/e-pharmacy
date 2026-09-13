import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { getRequestId } from '../http/api-response';
import { MonitoringService } from '../monitoring/monitoring.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  constructor(private readonly monitoring?: MonitoringService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const requestId = getRequestId(request, response);
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const event = {
        event: 'http_request',
        requestId,
        method: request.method,
        path: request.originalUrl || request.url,
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userAgent: request.get('user-agent'),
        ip: request.ip,
      };
      this.monitoring?.recordHttpRequest(
        request.method,
        request.route?.path || 'unmatched',
        response.statusCode,
        durationMs,
      );
      if (response.statusCode >= 500) this.logger.error(event);
      else if (response.statusCode >= 400) this.logger.warn(event);
      else this.logger.log(event);
    });
    next();
  }
}
