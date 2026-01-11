'use strict';

/**
 * New Relic Agent Configuration
 *
 * This configuration file is used to set up New Relic monitoring
 * for the JobPay Backend application.
 *
 * For a complete description of configuration options, see:
 * https://docs.newrelic.com/docs/agents/nodejs-agent/installation-configuration/nodejs-agent-configuration
 */
exports.config = {
  /**
   * Array of application names.
   * @env NEW_RELIC_APP_NAME
   */
  app_name: ['JobPay'],

  /**
   * Your New Relic license key.
   * @env NEW_RELIC_LICENSE_KEY or NEW_RELIC_TOKEN
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  /**
   * Logging configuration
   */
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

    /**
     * Whether to write to a log file or not
     */
    enabled: true,

    /**
     * Where to put the log file -- by default just uses process.cwd +
     * 'newrelic_agent.log'
     */
    filepath: './logs/newrelic_agent.log',
  },

  /**
   * Whether the agent is enabled or not.
   * @env NEW_RELIC_ENABLED
   */
  agent_enabled: process.env.NODE_ENV !== 'test',

  /**
   * Security policy settings
   */
  security: {
    /**
     * Whether to capture and transmit request parameters
     */
    request: {
      parameters: {
        enabled: true,
      },
    },
  },

  /**
   * Rules for ignoring transactions
   */
  rules: {
    ignore: [
      // Health check endpoints
      '^/health',
      // GraphQL introspection queries
      '^/graphql.*__schema.*',
    ],
  },

  /**
   * Error collection configuration
   */
  error_collector: {
    /**
     * Whether to collect errors
     */
    enabled: true,

    /**
     * Whether to capture source maps
     */
    capture_events: true,

    /**
     * Maximum number of errors to collect per minute
     */
    max_event_samples_stored: 100,
  },

  /**
   * Transaction tracer configuration
   */
  transaction_tracer: {
    /**
     * Whether to enable transaction tracing
     */
    enabled: true,

    /**
     * Threshold for transaction tracing in milliseconds
     */
    transaction_threshold: 'apdex_f',

    /**
     * Whether to record SQL statements
     */
    record_sql: 'obfuscated',

    /**
     * Whether to explain slow SQL statements
     */
    explain_threshold: 500,
  },

  /**
   * Browser monitoring (RUM) configuration
   */
  browser_monitoring: {
    /**
     * Whether to enable browser monitoring
     */
    enable: false,
  },

  /**
   * Application performance monitoring configuration
   */
  application_logging: {
    /**
     * Whether to enable log forwarding
     */
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },

    /**
     * Whether to enable log metrics
     */
    metrics: {
      enabled: true,
    },

    /**
     * Whether to enable log decoration
     */
    local_decorating: {
      enabled: true,
    },
  },

  /**
   * Distributed tracing configuration
   */
  distributed_tracing: {
    /**
     * Whether to enable distributed tracing
     */
    enabled: true,
  },

  /**
   * Custom attributes to add to all transactions
   */
  attributes: {
    /**
     * Whether to enable custom attributes
     */
    enabled: true,

    /**
     * Attributes to include in all destinations
     */
    include: [
      'request.headers.userAgent',
      'request.headers.contentType',
      'response.headers.contentType',
    ],
  },

  /**
   * Environment-specific settings
   */
  ...(() => {
    const env = process.env.NODE_ENV;

    if (env === 'development') {
      return {
        slow_sql: {
          enabled: true,
        },
        transaction_tracer: {
          record_sql: 'raw',
          explain_threshold: 100,
        },
      };
    }

    if (env === 'production') {
      return {
        high_security: false,
        proxy_host: null,
        proxy_port: null,
        proxy_user: null,
        proxy_pass: null,
      };
    }

    return {};
  })(),
};
