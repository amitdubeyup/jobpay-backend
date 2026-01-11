import { Logger } from '@nestjs/common';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

/**
 * OpenTelemetry Configuration for Grafana Cloud
 *
 * This configuration sets up OpenTelemetry instrumentation for the JobPay Backend
 * to send telemetry data to Grafana Cloud for monitoring and observability.
 */

// Create logger for telemetry initialization
const telemetryLogger = new Logger('Telemetry');

// Grafana Cloud OTLP endpoints
const GRAFANA_CLOUD_OTLP_ENDPOINT = 'https://otlp-gateway-prod-us-central-0.grafana.net/otlp';

// Extract instance ID and token from Grafana token
const parseGrafanaToken = (token: string) => {
  try {
    // Grafana Cloud tokens are typically in format: instanceId:token
    const [userId, apiKey] = token.split(':');
    return { userId, apiKey };
  } catch (error) {
    telemetryLogger.error(
      'Failed to parse Grafana token:',
      error instanceof Error ? error.stack : 'Unknown error',
    );
    return { userId: '', apiKey: '' };
  }
};

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry for Grafana Cloud integration
 */
export function initializeTelemetry(): void {
  if (!process.env.GRAFANA_LICENSE_KEY) {
    telemetryLogger.warn(
      '⚠️ GRAFANA_LICENSE_KEY not found in environment variables. Skipping OpenTelemetry initialization.',
    );
    return;
  }

  if (sdk) {
    telemetryLogger.log('OpenTelemetry already initialized');
    return;
  }

  try {
    const grafanaConfig = parseGrafanaToken(process.env.GRAFANA_LICENSE_KEY);

    if (!grafanaConfig.userId || !grafanaConfig.apiKey) {
      telemetryLogger.error('Invalid Grafana token format. Expected format: instanceId:token');
      return;
    }

    // Configure trace exporter for Grafana Cloud
    const traceExporter = new OTLPTraceExporter({
      url: `${GRAFANA_CLOUD_OTLP_ENDPOINT}/v1/traces`,
      headers: {
        Authorization: `Basic ${Buffer.from(`${grafanaConfig.userId}:${process.env.GRAFANA_LICENSE_KEY}`).toString('base64')}`,
      },
    });

    // Configure metric exporter for Grafana Cloud
    const metricExporter = new OTLPMetricExporter({
      url: `${GRAFANA_CLOUD_OTLP_ENDPOINT}/v1/metrics`,
      headers: {
        Authorization: `Basic ${Buffer.from(`${grafanaConfig.userId}:${process.env.GRAFANA_LICENSE_KEY}`).toString('base64')}`,
      },
    });

    // Configure metric reader
    const metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000, // Export every 10 seconds
    });

    // Initialize the OpenTelemetry SDK
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: 'jobpay-backend',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'jobpay',
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'localhost',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      }),

      traceExporter: traceExporter,
      metricReader: metricReader,

      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable specific instrumentations to reduce noise
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
          '@opentelemetry/instrumentation-net': {
            enabled: false,
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    telemetryLogger.log('✅ OpenTelemetry initialized successfully for Grafana Cloud');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk
        ?.shutdown()
        .then(() => telemetryLogger.log('OpenTelemetry terminated'))
        .catch(error =>
          telemetryLogger.error(
            'Error terminating OpenTelemetry',
            error instanceof Error ? error.stack : 'Unknown error',
          ),
        )
        .finally(() => process.exit(0));
    });
  } catch (error) {
    telemetryLogger.error(
      'Failed to initialize OpenTelemetry:',
      error instanceof Error ? error.stack : 'Unknown error',
    );
  }
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      sdk = null;
      telemetryLogger.log('OpenTelemetry SDK shut down successfully');
    } catch (error) {
      telemetryLogger.error(
        'Error shutting down OpenTelemetry SDK:',
        error instanceof Error ? error.stack : 'Unknown error',
      );
    }
  }
}

/**
 * Check if OpenTelemetry is initialized
 */
export function isTelemetryInitialized(): boolean {
  return sdk !== null;
}
