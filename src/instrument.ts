import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';

function parseHeaders(value = ''): Record<string, string> {
  return Object.fromEntries(
    value.split(',').flatMap((header) => {
      const separator = header.indexOf('=');
      if (separator < 1) return [];
      return [[header.slice(0, separator).trim(), header.slice(separator + 1).trim()]];
    }),
  );
}

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
const otlpHeaders = parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);
const serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'e-pharmacy-api';

if (otlpEndpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.version': process.env.npm_package_version || '0.0.1',
      'deployment.environment.name': process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces`,
      headers: otlpHeaders,
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${otlpEndpoint.replace(/\/$/, '')}/v1/metrics`,
        headers: otlpHeaders,
      }),
      exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS || 15000),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
}
