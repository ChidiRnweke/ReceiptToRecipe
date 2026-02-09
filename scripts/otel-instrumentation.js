import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

let sdk = null;

export function initTelemetry(serviceName = 'receipt2recipe') {
  if (!endpoint) {
    console.warn(
      '[OTel] OTEL_EXPORTER_OTLP_ENDPOINT is not set. Telemetry is disabled.'
    );
    return null;
  }

  console.log(`[OTel] Initializing telemetry for ${serviceName}. Exporting to ${endpoint}`);

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.1',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
      process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development',
  });

  const traceExporter = new OTLPTraceExporter({ url: endpoint });
  const logExporter = new OTLPLogExporter({ url: endpoint });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    logRecordProcessor: new SimpleLogRecordProcessor(logExporter),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // Enable pg instrumentation with query text for rich DB spans
        '@opentelemetry/instrumentation-pg': {
          enhancedDatabaseReporting: true,
        },
        // Enable http instrumentation (every request = a span)
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        // Disable noisy/unnecessary instrumentations
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  sdk.start();

  console.log('[OTel] Telemetry initialized successfully.');
  return sdk;
}

export async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log('[OTel] Telemetry shut down successfully.');
    } catch (err) {
      console.error('[OTel] Error shutting down telemetry:', err);
    }
  }
}

// Auto-initialize if this file is imported and OTEL_EXPORTER_OTLP_ENDPOINT is set
if (endpoint && !globalThis.__otel_initialized__) {
  globalThis.__otel_initialized__ = true;
  initTelemetry();
}
