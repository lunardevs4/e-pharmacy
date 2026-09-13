import { Injectable } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

@Injectable()
export class MonitoringService {
  private readonly requestCount = metrics.getMeter('e-pharmacy-api').createCounter(
    'http.server.request.count', { unit: 'requests' },
  );
  private readonly requestDuration = metrics.getMeter('e-pharmacy-api').createHistogram(
    'http.server.request.duration', { unit: 'ms' },
  );
  private readonly requestErrors = metrics.getMeter('e-pharmacy-api').createCounter(
    'http.server.error.count', { unit: 'errors' },
  );
  private readonly dbQueryCount = metrics.getMeter('e-pharmacy-api').createCounter(
    'db.client.operation.count', { unit: 'operations' },
  );
  private readonly dbQueryDuration = metrics.getMeter('e-pharmacy-api').createHistogram(
    'db.client.operation.duration', { unit: 'ms' },
  );

  recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number) {
    const attributes = { method, route, status_code: String(statusCode) };
    this.requestCount.add(1, attributes);
    this.requestDuration.record(durationMs, attributes);
    if (statusCode >= 500) this.requestErrors.add(1, attributes);
  }

  recordDatabaseQuery(operation: string, durationMs: number) {
    const attributes = { system: 'postgresql', operation };
    this.dbQueryCount.add(1, attributes);
    this.dbQueryDuration.record(durationMs, attributes);
  }

}
