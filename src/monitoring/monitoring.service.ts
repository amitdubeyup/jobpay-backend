import { Injectable, Logger } from '@nestjs/common';
import * as newrelic from 'newrelic';

/**
 * Monitoring Service
 *
 * This service provides centralized monitoring capabilities for the application,
 * including integration with New Relic for APM and custom event tracking.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly isEnabled = false; // Disable monitoring completely

  constructor() {
    this.logger.log('🔍 Monitoring service initialized (disabled)');
  }

  /**
   * Record a custom event in New Relic
   */
  recordCustomEvent(eventType: string, attributes: Record<string, any>) {
    if (!this.isEnabled) return;
    try {
      if (process.env.NODE_ENV !== 'test') {
        newrelic.recordCustomEvent(eventType, attributes);
        this.logger.debug(`Custom event recorded: ${eventType}`, attributes);
      }
    } catch (error) {
      this.logger.error('Failed to record custom event', error);
    }
  }

  /**
   * Record a metric in New Relic
   */
  recordMetric(name: string, value: number) {
    if (!this.isEnabled) return;
    try {
      if (process.env.NODE_ENV !== 'test') {
        newrelic.recordMetric(name, value);
        this.logger.debug(`Metric recorded: ${name} = ${value}`);
      }
    } catch (error) {
      this.logger.error('Failed to record metric', error);
    }
  }

  /**
   * Add custom attributes to the current transaction
   */
  addCustomAttributes(attributes: Record<string, string | number | boolean>) {
    if (!this.isEnabled) return;
    try {
      if (process.env.NODE_ENV !== 'test') {
        newrelic.addCustomAttributes(attributes);
        this.logger.debug('Custom attributes added', attributes);
      }
    } catch (error) {
      this.logger.error('Failed to add custom attributes', error);
    }
  }

  /**
   * Set the name of the current transaction
   */
  setTransactionName(category: string, name: string) {
    if (!this.isEnabled) return;
    try {
      if (process.env.NODE_ENV !== 'test') {
        newrelic.setTransactionName(category, name);
        this.logger.debug(`Transaction name set: ${category}/${name}`);
      }
    } catch (error) {
      this.logger.error('Failed to set transaction name', error);
    }
  }

  /**
   * Notice an error in New Relic
   */
  noticeError(error: Error, customAttributes?: Record<string, any>) {
    if (!this.isEnabled) return;
    try {
      if (process.env.NODE_ENV !== 'test') {
        newrelic.noticeError(error, customAttributes);
        this.logger.error('Error reported to New Relic', error.message, customAttributes);
      }
    } catch (err) {
      this.logger.error('Failed to report error to New Relic', err);
    }
  }

  /**
   * Start a custom timing for performance tracking
   */
  startTimer(name: string): () => void {
    if (!this.isEnabled) return () => {};
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(`Custom/Timer/${name}`, duration);
      this.logger.debug(`Timer ${name} completed in ${duration}ms`);
    };
  }

  /**
   * Track user login events
   */
  trackUserLogin(userId: string, email: string, role: string) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('UserLogin', {
      userId,
      email,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track user registration events
   */
  trackUserRegistration(userId: string, email: string, role: string) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('UserRegistration', {
      userId,
      email,
      role,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track job creation events
   */
  trackJobCreation(jobId: string, posterId: string, title: string, budget: number) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('JobCreation', {
      jobId,
      posterId,
      title,
      budget,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track GraphQL operations
   */
  trackGraphQLOperation(
    operationName: string,
    operationType: string,
    duration: number,
    success: boolean,
  ) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('GraphQLOperation', {
      operationName,
      operationType,
      duration,
      success,
      timestamp: new Date().toISOString(),
    });

    this.recordMetric(`GraphQL/${operationType}/${operationName}/Duration`, duration);
    this.recordMetric(
      `GraphQL/${operationType}/${operationName}/${success ? 'Success' : 'Error'}`,
      1,
    );
  }

  /**
   * Track Redis operations
   */
  trackRedisOperation(operation: string, key: string, duration: number, success: boolean) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('RedisOperation', {
      operation,
      key,
      duration,
      success,
      timestamp: new Date().toISOString(),
    });

    this.recordMetric(`Redis/${operation}/Duration`, duration);
    this.recordMetric(`Redis/${operation}/${success ? 'Success' : 'Error'}`, 1);
  }

  /**
   * Track database operations
   */
  trackDatabaseOperation(operation: string, table: string, duration: number, success: boolean) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('DatabaseOperation', {
      operation,
      table,
      duration,
      success,
      timestamp: new Date().toISOString(),
    });

    this.recordMetric(`Database/${operation}/${table}/Duration`, duration);
    this.recordMetric(`Database/${operation}/${table}/${success ? 'Success' : 'Error'}`, 1);
  }

  /**
   * Track rate limiting events
   */
  trackRateLimit(ip: string, endpoint: string, remainingRequests: number) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('RateLimit', {
      ip,
      endpoint,
      remainingRequests,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track security events
   */
  trackSecurityEvent(type: string, ip: string, userAgent: string, details?: Record<string, any>) {
    if (!this.isEnabled) return;
    this.recordCustomEvent('SecurityEvent', {
      type,
      ip,
      userAgent,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}
