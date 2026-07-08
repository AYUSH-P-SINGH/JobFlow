import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { logger } from '../logger/logger.js';

// Get service name from env or default
const serviceName = process.env.OTEL_SERVICE_NAME || 'jobflow-backend';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

let sdk: NodeSDK | null = null;

if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_TRACING === 'true') {
  logger.info(`Initializing OpenTelemetry for service: ${serviceName} exporting to ${otlpEndpoint}`);
  
  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // fs spans are too noisy
      }),
    ],
  });

  try {
    sdk.start();
    logger.info('OpenTelemetry SDK started successfully');
  } catch (error) {
    logger.error('Error starting OpenTelemetry SDK:', error);
  }

  // Gracefully shut down the SDK on process exit
  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => logger.info('Tracing SDK terminated'))
      .catch((error) => logger.error('Error terminating Tracing SDK', error));
  });
} else {
  logger.info('OpenTelemetry Tracing is disabled (ENABLE_TRACING is not "true" or NODE_ENV is "test").');
}
export default sdk;
