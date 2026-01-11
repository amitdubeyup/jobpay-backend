import { Injectable, Logger } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

/**
 * Metrics Service
 *
 * This service provides OpenTelemetry metrics collection for Grafana Cloud
 * monitoring and observability.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly isEnabled = false; // Disable metrics completely
  private readonly meter = metrics.getMeter('jobpay-backend', '1.0.0');

  // Metrics counters and histograms
  private readonly httpRequestsTotal = this.meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  private readonly httpRequestDuration = this.meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
  });

  private readonly graphqlOperationsTotal = this.meter.createCounter('graphql_operations_total', {
    description: 'Total number of GraphQL operations',
  });

  private readonly graphqlOperationDuration = this.meter.createHistogram(
    'graphql_operation_duration_ms',
    {
      description: 'GraphQL operation duration in milliseconds',
    },
  );

  private readonly databaseOperationsTotal = this.meter.createCounter('database_operations_total', {
    description: 'Total number of database operations',
  });

  private readonly databaseOperationDuration = this.meter.createHistogram(
    'database_operation_duration_ms',
    {
      description: 'Database operation duration in milliseconds',
    },
  );

  private readonly redisOperationsTotal = this.meter.createCounter('redis_operations_total', {
    description: 'Total number of Redis operations',
  });

  private readonly redisOperationDuration = this.meter.createHistogram(
    'redis_operation_duration_ms',
    {
      description: 'Redis operation duration in milliseconds',
    },
  );

  private readonly activeUsers = this.meter.createUpDownCounter('active_users_total', {
    description: 'Total number of active users',
  });

  private readonly jobsCreated = this.meter.createCounter('jobs_created_total', {
    description: 'Total number of jobs created',
  });

  private readonly userRegistrations = this.meter.createCounter('user_registrations_total', {
    description: 'Total number of user registrations',
  });

  private readonly authenticationAttempts = this.meter.createCounter(
    'authentication_attempts_total',
    {
      description: 'Total number of authentication attempts',
    },
  );

  private readonly rateLimitHits = this.meter.createCounter('rate_limit_hits_total', {
    description: 'Total number of rate limit hits',
  });

  constructor() {
    this.logger.log('📊 Metrics service initialized');
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    if (!this.isEnabled) return;
    const labels = { method, route, status_code: statusCode.toString() };

    this.httpRequestsTotal.add(1, labels);
    this.httpRequestDuration.record(duration, labels);

    this.logger.debug(`HTTP metric recorded: ${method} ${route} ${statusCode} (${duration}ms)`);
  }

  /**
   * Record GraphQL operation metrics
   */
  recordGraphQLOperation(
    operationName: string,
    operationType: string,
    duration: number,
    success: boolean,
  ) {
    if (!this.isEnabled) return;
    const labels = {
      operation_name: operationName,
      operation_type: operationType,
      success: success.toString(),
    };

    this.graphqlOperationsTotal.add(1, labels);
    this.graphqlOperationDuration.record(duration, labels);

    this.logger.debug(`GraphQL metric recorded: ${operationType} ${operationName} (${duration}ms)`);
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(operation: string, table: string, duration: number, success: boolean) {
    if (!this.isEnabled) return;
    const labels = {
      operation,
      table,
      success: success.toString(),
    };

    this.databaseOperationsTotal.add(1, labels);
    this.databaseOperationDuration.record(duration, labels);

    this.logger.debug(`Database metric recorded: ${operation} ${table} (${duration}ms)`);
  }

  /**
   * Record Redis operation metrics
   */
  recordRedisOperation(operation: string, key: string, duration: number, success: boolean) {
    if (!this.isEnabled) return;
    const labels = {
      operation,
      key_pattern: this.sanitizeKeyPattern(key),
      success: success.toString(),
    };

    this.redisOperationsTotal.add(1, labels);
    this.redisOperationDuration.record(duration, labels);

    this.logger.debug(`Redis metric recorded: ${operation} ${key} (${duration}ms)`);
  }

  /**
   * Record user registration
   */
  recordUserRegistration(role: string) {
    if (!this.isEnabled) return;
    const labels = { role };
    this.userRegistrations.add(1, labels);
    this.logger.debug(`User registration metric recorded: ${role}`);
  }

  /**
   * Record job creation
   */
  recordJobCreation(budget: number) {
    if (!this.isEnabled) return;
    const labels = { budget_range: this.getBudgetRange(budget) };
    this.jobsCreated.add(1, labels);
    this.logger.debug(`Job creation metric recorded: budget_range=${labels.budget_range}`);
  }

  /**
   * Record authentication attempt
   */
  recordAuthenticationAttempt(success: boolean, method: string = 'jwt') {
    const labels = { success: success.toString(), method };
    this.authenticationAttempts.add(1, labels);
    this.logger.debug(
      `Authentication metric recorded: ${method} ${success ? 'success' : 'failure'}`,
    );
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string, ip: string) {
    const ipHash = this.hashIP(ip); // Hash IP for privacy
    const labels = {
      endpoint,
      ip_hash: ipHash,
    };
    this.rateLimitHits.add(1, labels);
    this.logger.debug(`Rate limit metric recorded: ${endpoint} from ${ipHash}`);
  }

  /**
   * Update active users count
   */
  updateActiveUsers(count: number) {
    this.activeUsers.add(count);
    this.logger.debug(`Active users updated: ${count}`);
  }

  /**
   * Create a timer function for measuring duration
   */
  createTimer(): () => number {
    if (!this.isEnabled) return () => 0;
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }

  /**
   * Sanitize Redis key for metrics (remove sensitive data)
   */
  private sanitizeKeyPattern(key: string): string {
    // Replace user IDs, session IDs, etc. with placeholders
    return key
      .replace(/\d+/g, '{id}')
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '{uuid}')
      .replace(/[A-Za-z0-9+/]{40,}/g, '{token}');
  }

  /**
   * Get budget range for job metrics
   */
  private getBudgetRange(budget: number): string {
    if (budget < 1000) return '0-1k';
    if (budget < 5000) return '1k-5k';
    if (budget < 10000) return '5k-10k';
    if (budget < 50000) return '10k-50k';
    if (budget < 100000) return '50k-100k';
    return '100k+';
  }

  /**
   * Hash IP address for privacy
   */
  private hashIP(ip: string): string {
    // Simple hash for IP privacy (in production, use a proper hash function)
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'unknown';
  }
}
