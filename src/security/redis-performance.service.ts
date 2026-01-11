import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  timestamp: Date;
  statusCode: number;
  memoryUsage: number;
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  requestCount: {
    total: number;
    successful: number;
    failed: number;
  };
}

@Injectable()
export class RedisPerformanceService {
  private readonly logger = new Logger(RedisPerformanceService.name);
  private readonly METRICS_KEY = 'performance:metrics';
  private readonly METRICS_SORTED_SET = 'performance:metrics_sorted';
  private readonly SYSTEM_STATS_KEY = 'performance:system_stats';
  private startTime = Date.now();

  constructor(private readonly redisService: RedisService) {}

  /**
   * Record a performance metric in Redis with TTL
   */
  async recordMetric(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
  ): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const metric: PerformanceMetric = {
          endpoint,
          method,
          responseTime,
          timestamp: new Date(),
          statusCode,
          memoryUsage: process.memoryUsage().heapUsed,
        };

        const metricKey = `${this.METRICS_KEY}:${Date.now()}:${Math.random()}`;
        const score = Date.now(); // Use timestamp as score for sorting

        // Store metric in Redis with automatic expiration (24 hours)
        await redis.setex(metricKey, 24 * 60 * 60, JSON.stringify(metric));

        // Add to sorted set for efficient time-based queries
        await redis.zadd(this.METRICS_SORTED_SET, score, metricKey);

        // Clean old entries from sorted set (keep last 24 hours)
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        await redis.zremrangebyscore(this.METRICS_SORTED_SET, 0, oneDayAgo);

        // Log slow requests
        if (responseTime > 1000) {
          this.logger.warn(`Slow request detected: ${method} ${endpoint} - ${responseTime}ms`);
        }

        // Log very slow requests as errors
        if (responseTime > 5000) {
          this.logger.error(`Very slow request: ${method} ${endpoint} - ${responseTime}ms`);
        }

        // Update real-time stats
        await this.updateSystemStats(metric);
      },
      undefined,
      'recordMetric',
    );
  }

  /**
   * Get system performance metrics from Redis
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    return this.redisService.executeOperation(
      async redis => {
        const now = Date.now();
        const last5Minutes = now - 5 * 60 * 1000;

        // Get recent metrics from Redis sorted set
        const metricKeys = await redis.zrangebyscore(this.METRICS_SORTED_SET, last5Minutes, now);

        const recentMetrics: PerformanceMetric[] = [];
        if (metricKeys.length > 0) {
          const metricsData = await redis.mget(metricKeys);
          for (const data of metricsData) {
            if (data) {
              recentMetrics.push(JSON.parse(data));
            }
          }
        }

        // Calculate response time percentiles
        const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
        const average =
          responseTimes.length > 0
            ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            : 0;

        const p95Index = Math.floor(responseTimes.length * 0.95);
        const p99Index = Math.floor(responseTimes.length * 0.99);

        const p95 = responseTimes[p95Index] || 0;
        const p99 = responseTimes[p99Index] || 0;

        // Calculate request counts
        const total = recentMetrics.length;
        const successful = recentMetrics.filter(
          m => m.statusCode >= 200 && m.statusCode < 400,
        ).length;
        const failed = total - successful;

        // Memory usage
        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapTotal;
        const usedMemory = memUsage.heapUsed;
        const memoryPercentage = (usedMemory / totalMemory) * 100;

        return {
          cpuUsage: this.getCpuUsage(),
          memoryUsage: {
            used: usedMemory,
            total: totalMemory,
            percentage: memoryPercentage,
          },
          responseTime: {
            average,
            p95,
            p99,
          },
          requestCount: {
            total,
            successful,
            failed,
          },
        };
      },
      {
        cpuUsage: 0,
        memoryUsage: {
          used: 0,
          total: 0,
          percentage: 0,
        },
        responseTime: {
          average: 0,
          p95: 0,
          p99: 0,
        },
        requestCount: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      },
      'getSystemMetrics',
    );
  }

  /**
   * Get endpoint performance statistics from Redis
   */
  async getEndpointStats(endpoint?: string): Promise<
    Array<{
      endpoint: string;
      method: string;
      averageResponseTime: number;
      requestCount: number;
      errorRate: number;
    }>
  > {
    return this.redisService.executeOperation(
      async redis => {
        const now = Date.now();
        const last24Hours = now - 24 * 60 * 60 * 1000;

        // Get metrics from last 24 hours
        const metricKeys = await redis.zrangebyscore(this.METRICS_SORTED_SET, last24Hours, now);

        const allMetrics: PerformanceMetric[] = [];
        if (metricKeys.length > 0) {
          const metricsData = await redis.mget(metricKeys);
          for (const data of metricsData) {
            if (data) {
              const metric = JSON.parse(data);
              if (!endpoint || metric.endpoint === endpoint) {
                allMetrics.push(metric);
              }
            }
          }
        }

        // Group by endpoint and method
        const grouped = new Map<string, PerformanceMetric[]>();
        allMetrics.forEach(metric => {
          const key = `${metric.method}:${metric.endpoint}`;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key)!.push(metric);
        });

        // Calculate statistics for each group
        return Array.from(grouped.entries()).map(([key, metrics]) => {
          const [method, endpointPath] = key.split(':');
          const responseTimes = metrics.map(m => m.responseTime);
          const averageResponseTime =
            responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
          const requestCount = metrics.length;
          const errorCount = metrics.filter(m => m.statusCode >= 400).length;
          const errorRate = (errorCount / requestCount) * 100;

          return {
            endpoint: endpointPath,
            method,
            averageResponseTime: Math.round(averageResponseTime * 100) / 100,
            requestCount,
            errorRate: Math.round(errorRate * 100) / 100,
          };
        });
      },
      [],
      'getEndpointStats',
    );
  }

  /**
   * Update system statistics in Redis
   */
  private async updateSystemStats(metric: PerformanceMetric): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const statsKey = `${this.SYSTEM_STATS_KEY}:current`;

        // Update counters using Redis atomic operations
        const pipeline = redis.pipeline();
        pipeline.hincrby(statsKey, 'total_requests', 1);

        if (metric.statusCode >= 200 && metric.statusCode < 400) {
          pipeline.hincrby(statsKey, 'successful_requests', 1);
        } else {
          pipeline.hincrby(statsKey, 'failed_requests', 1);
        }

        // Set expiration for stats (1 hour)
        pipeline.expire(statsKey, 3600);

        await pipeline.exec();
      },
      undefined,
      'updateSystemStats',
    );
  }

  /**
   * Clean up old metrics (Redis TTL handles most of this)
   */
  async clearOldMetrics(): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        // Remove old entries from sorted set
        const removed = await redis.zremrangebyscore(this.METRICS_SORTED_SET, 0, oneDayAgo);

        if (removed > 0) {
          this.logger.log(`Cleared ${removed} old performance metrics from Redis`);
        }
      },
      undefined,
      'clearOldMetrics',
    );
  }

  /**
   * Get CPU usage estimation
   */
  private getCpuUsage(): number {
    // This is a simplified CPU usage calculation
    // In production, you might want to use a more sophisticated method
    const usage = process.cpuUsage();
    const total = usage.user + usage.system;
    return Math.round((total / 1000000) * 100) / 100; // Convert to percentage
  }

  /**
   * Get performance alerts from Redis
   */
  async getPerformanceAlerts(): Promise<
    Array<{
      type: string;
      message: string;
      timestamp: Date;
      severity: 'low' | 'medium' | 'high';
    }>
  > {
    return this.redisService.executeOperation(
      async redis => {
        const alertsKey = `${this.SYSTEM_STATS_KEY}:alerts`;
        const alerts = await redis.lrange(alertsKey, 0, 50); // Get last 50 alerts

        return alerts.map((alert: string) => JSON.parse(alert));
      },
      [],
      'getPerformanceAlerts',
    );
  }

  /**
   * Store performance alert in Redis
   */
  async addPerformanceAlert(
    type: string,
    message: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const alertsKey = `${this.SYSTEM_STATS_KEY}:alerts`;
        const alert = {
          type,
          message,
          timestamp: new Date(),
          severity,
        };

        // Add to list and trim to keep only recent alerts
        await redis.lpush(alertsKey, JSON.stringify(alert));
        await redis.ltrim(alertsKey, 0, 99); // Keep last 100 alerts
        await redis.expire(alertsKey, 7 * 24 * 60 * 60); // 7 days expiration
      },
      undefined,
      'addPerformanceAlert',
    );
  }
}
