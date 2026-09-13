# Observability with OpenTelemetry and Grafana

The API emits OpenTelemetry traces and metrics to any OTLP/HTTP-compatible
Grafana endpoint. Instrumentation is enabled only when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set, so local development remains offline.

## Grafana Cloud configuration

Create a Grafana Cloud stack and copy its OTLP HTTP endpoint and instance
credentials. Configure the backend with:

```env
NODE_ENV=production
OTEL_SERVICE_NAME=e-pharmacy-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64-instance-id-colon-token>
OTEL_METRIC_EXPORT_INTERVAL_MS=15000
```

Store the endpoint and header in the platform's secret manager. Do not commit
the Grafana token or put it in a frontend environment variable. Restart the API
after changing these values and verify that a service named `e-pharmacy-api`
appears in Grafana Explore.

## Signals and coverage

- Traces: HTTP, Express/Nest, PostgreSQL (`pg`), Redis, and common Node.js
  dependencies through OpenTelemetry auto-instrumentation.
- API analytics: request count, duration, error count, method, route, status.
  Routes use Nest route templates rather than raw URLs to prevent user IDs and
  query strings becoming high-cardinality labels.
- Database monitoring: Prisma operation count and duration, plus PostgreSQL
  client spans. SQL text and bind parameters are intentionally not exported.
  Enable the managed PostgreSQL/Neon integration in Grafana as well for server
  CPU, storage, connections, locks, and cache hit ratio.
- Production errors: failed HTTP requests and exception spans are exported to
  Grafana through OpenTelemetry when a Grafana endpoint is configured.

## Recommended Grafana dashboard

Create panels for:

1. Request rate: `sum(rate(http_server_request_count_total[5m]))`.
2. Error rate: `sum(rate(http_server_error_count_total[5m])) / sum(rate(http_server_request_count_total[5m]))`.
3. P95 latency: `histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_milliseconds_bucket[5m])))`.
4. Requests by route and status code.
5. Database query rate and P95 query duration using the `db_client_*` metrics.
6. PostgreSQL connections, locks, CPU, storage, and cache hit ratio from the
   managed database integration.

## Recommended production alerts

Configure these as Grafana managed alert rules, grouped by `service.name` and
`deployment.environment.name`:

- API availability: error rate above 5% for 5 minutes (critical).
- API latency: P95 above 750 ms for 10 minutes (warning), above 2 s for 5
  minutes (critical).
- Database latency: P95 query duration above 500 ms for 10 minutes (warning).
- Database availability: `/health/ready` probes failing for 2 consecutive
  evaluations (critical).
- Database capacity: connections above 80% of the configured limit or storage
  above 80% (warning).
- No telemetry: no request data for 15 minutes during an expected traffic
  window (warning).

Route alerts to an on-call email, Slack, or PagerDuty contact point. Add a
synthetic check for `GET /health/live` and a dependency check for
`GET /health/ready`; the latter verifies PostgreSQL connectivity.
