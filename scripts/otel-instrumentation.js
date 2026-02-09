import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, context } from '@opentelemetry/api';

let sdk = null;
let loggerProvider = null;

/**
 * Bridge console.log/warn/error to OpenTelemetry logs
 */
function bridgeConsoleLogs(logger) {
  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const severityMap = {
    debug: SeverityNumber.DEBUG,
    log: SeverityNumber.INFO,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };

  for (const [method, severity] of Object.entries(severityMap)) {
    console[method] = (...args) => {
      // Always call original console method
      originalConsole[method](...args);
      
      // Send to OTel
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Get current span context for trace correlation
        const activeContext = context.active();
        const span = trace.getSpan(activeContext);
        const spanContext = span?.spanContext();
        
        logger.emit({
          severityNumber: severity,
          severityText: method.toUpperCase(),
          body: message,
          timestamp: Date.now(),
          context: activeContext,
          attributes: spanContext ? {
            'trace_id': spanContext.traceId,
            'span_id': spanContext.spanId,
          } : undefined,
        });
      } catch (e) {
        // Silently ignore OTel errors to prevent infinite loops
      }
    };
  }

  return originalConsole;
}

export function initTelemetry(serviceName = 'receipt2recipe') {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  
  if (!endpoint) {
    console.warn(
      '[OTel] OTEL_EXPORTER_OTLP_ENDPOINT is not set. Telemetry is disabled.'
    );
    return null;
  }

  // Log before bridging console (so this goes to stdout only)
  const initMsg = `[OTel] Initializing telemetry for ${serviceName}. Exporting to ${endpoint}`;
  process.stdout.write(initMsg + '\n');

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.1',
    'deployment.environment': process.env.OTEL_ENVIRONMENT || process.env.NODE_ENV || 'development',
  });

  const traceExporter = new OTLPTraceExporter({ url: endpoint });
  const logExporter = new OTLPLogExporter({ url: endpoint });

  // Set up LoggerProvider for console bridging
  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);
  
  // Bridge console.log/warn/error to OTel
  const logger = loggerProvider.getLogger(serviceName);
  bridgeConsoleLogs(logger);

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
  try {
    if (loggerProvider) {
      await loggerProvider.shutdown();
    }
    if (sdk) {
      await sdk.shutdown();
    }
    process.stdout.write('[OTel] Telemetry shut down successfully.\n');
  } catch (err) {
    process.stderr.write(`[OTel] Error shutting down telemetry: ${err}\n`);
  }
}

// Auto-initialize if this file is imported and OTEL_EXPORTER_OTLP_ENDPOINT is set
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (endpoint && !globalThis.__otel_initialized__) {
  globalThis.__otel_initialized__ = true;
  initTelemetry();
}
