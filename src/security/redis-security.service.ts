import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisSecurityService {
  private readonly logger = new Logger(RedisSecurityService.name);
  private readonly REQUEST_TRACKING_KEY = 'security:request_tracking';
  private readonly SUSPICIOUS_IPS_KEY = 'security:suspicious_ips';
  private readonly SECURITY_STATS_KEY = 'security:stats';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Enhanced security middleware for DDoS protection using Redis
   */
  async trackRequest(clientIp: string): Promise<{
    isBlocked: boolean;
    isDdos: boolean;
    requestCount: number;
  }> {
    return this.redisService.executeOperation(
      async redis => {
        const now = Date.now();
        const minuteWindow = Math.floor(now / 60000); // Current minute
        const hourWindow = Math.floor(now / 3600000); // Current hour

        // Keys for rate limiting
        const minuteKey = `${this.REQUEST_TRACKING_KEY}:${clientIp}:minute:${minuteWindow}`;
        const hourKey = `${this.REQUEST_TRACKING_KEY}:${clientIp}:hour:${hourWindow}`;

        // Atomic increment and set expiration
        const pipeline = redis.pipeline();
        pipeline.incr(minuteKey);
        pipeline.expire(minuteKey, 60); // Expire in 1 minute
        pipeline.incr(hourKey);
        pipeline.expire(hourKey, 3600); // Expire in 1 hour

        const results = await pipeline.exec();

        const minuteCount = (results?.[0]?.[1] as number) || 0;
        const hourCount = (results?.[2]?.[1] as number) || 0;

        // Check limits - PRODUCTION OPTIMIZED
        const maxRequestsPerMinute = 500; // Increased from 100 to 500 for production
        const maxRequestsPerHour = 5000; // Increased from 1000 to 5000 for production

        const isBlocked = minuteCount > maxRequestsPerMinute || hourCount > maxRequestsPerHour;
        const isDdos = minuteCount > 1000; // DDoS threshold increased from 200 to 1000

        // Track suspicious activity
        if (isBlocked || isDdos) {
          await this.addToSuspiciousIps(
            clientIp,
            `High request rate: ${minuteCount}/min, ${hourCount}/hour`,
          );
        }

        return {
          isBlocked,
          isDdos,
          requestCount: minuteCount,
        };
      },
      // Fallback when Redis is not available - allow the request but log it
      {
        isBlocked: false,
        isDdos: false,
        requestCount: 0,
      },
      'trackRequest',
    );
  }

  /**
   * Enhanced IP blocking with Redis persistence and improved tracking
   */
  async addToSuspiciousIps(clientIp: string, reason: string): Promise<void> {
    return this.redisService.executeOperation(
      async redis => {
        const key = `${this.SUSPICIOUS_IPS_KEY}:${clientIp}`;
        const now = Date.now();

        // Get existing data
        const existing = await redis.get(key);
        let suspiciousData = {
          ip: clientIp,
          reasons: [reason],
          firstSeen: now,
          lastSeen: now,
          count: 1,
          severity: 'medium' as const,
        };

        if (existing) {
          const parsed = JSON.parse(existing);
          suspiciousData = {
            ...parsed,
            reasons: [...parsed.reasons, reason],
            lastSeen: now,
            count: parsed.count + 1,
            severity: parsed.count > 5 ? 'high' : ('medium' as const),
          };
        }

        // Store with 24 hour expiration
        await redis.setex(key, 24 * 60 * 60, JSON.stringify(suspiciousData));

        this.logger.warn(
          `Suspicious IP ${clientIp} tracked in Redis. Reason: ${reason}. Total incidents: ${suspiciousData.count}`,
        );
      },
      undefined,
      'addToSuspiciousIps',
    );
  }

  /**
   * Get suspicious IP information from Redis
   */
  async getSuspiciousIpInfo(clientIp: string): Promise<any> {
    const key = `${this.SUSPICIOUS_IPS_KEY}:${clientIp}`;
    const data = await this.redisService.get(key);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get comprehensive security statistics from Redis
   */
  async getSecurityStats(): Promise<{
    totalRequests: number;
    suspiciousIps: number;
    blockedAttempts: number;
    topSuspiciousIps: Array<{ ip: string; count: number; severity: string }>;
  }> {
    return this.redisService.executeOperation(
      async redis => {
        // Get request tracking data
        const requestPattern = `${this.REQUEST_TRACKING_KEY}:*`;
        const suspiciousPattern = `${this.SUSPICIOUS_IPS_KEY}:*`;

        const requestKeys = await redis.keys(requestPattern);
        const suspiciousKeys = await redis.keys(suspiciousPattern);

        let totalRequests = 0;
        if (requestKeys.length > 0) {
          const counts = await redis.mget(requestKeys);
          totalRequests = counts.reduce((sum: number, count) => sum + parseInt(count || '0'), 0);
        }

        // Get suspicious IPs details
        const topSuspiciousIps = [];
        if (suspiciousKeys.length > 0) {
          const suspiciousData = await redis.mget(suspiciousKeys);
          for (const data of suspiciousData) {
            if (data) {
              const parsed = JSON.parse(data);
              topSuspiciousIps.push({
                ip: parsed.ip,
                count: parsed.count,
                severity: parsed.severity,
              });
            }
          }
        }

        // Sort by count descending
        topSuspiciousIps.sort((a, b) => b.count - a.count);

        return {
          totalRequests,
          suspiciousIps: suspiciousKeys.length,
          blockedAttempts: topSuspiciousIps.filter(ip => ip.count > 5).length,
          topSuspiciousIps: topSuspiciousIps.slice(0, 10), // Top 10
        };
      },
      {
        totalRequests: 0,
        suspiciousIps: 0,
        blockedAttempts: 0,
        topSuspiciousIps: [],
      },
      'getSecurityStats',
    );
  }

  /**
   * Check if an IP should be rate limited
   */
  async shouldRateLimit(clientIp: string): Promise<{
    shouldLimit: boolean;
    remainingRequests: number;
    resetTime: number;
  }> {
    return this.redisService.executeOperation(
      async redis => {
        const now = Date.now();
        const minuteWindow = Math.floor(now / 60000);
        const key = `${this.REQUEST_TRACKING_KEY}:${clientIp}:minute:${minuteWindow}`;

        const currentCount = await redis.get(key);
        const requestCount = parseInt(currentCount || '0');

        const maxRequestsPerMinute = 500;
        const shouldLimit = requestCount >= maxRequestsPerMinute;
        const remainingRequests = Math.max(0, maxRequestsPerMinute - requestCount);
        const resetTime = (minuteWindow + 1) * 60000; // Next minute

        return {
          shouldLimit,
          remainingRequests,
          resetTime,
        };
      },
      {
        shouldLimit: false,
        remainingRequests: 500,
        resetTime: Date.now() + 60000,
      },
      'shouldRateLimit',
    );
  }

  /**
   * Get all suspicious IPs from Redis
   */
  async getAllSuspiciousIps(): Promise<
    Array<{
      ip: string;
      reasons: string[];
      firstSeen: number;
      lastSeen: number;
      count: number;
      severity: string;
    }>
  > {
    return this.redisService.executeOperation(
      async redis => {
        const pattern = `${this.SUSPICIOUS_IPS_KEY}:*`;
        const keys = await redis.keys(pattern);

        if (keys.length === 0) {
          return [];
        }

        const data = await redis.mget(keys);
        const results = [];

        for (const item of data) {
          if (item) {
            results.push(JSON.parse(item));
          }
        }

        return results.sort((a, b) => b.lastSeen - a.lastSeen);
      },
      [],
      'getAllSuspiciousIps',
    );
  }

  /**
   * Clear suspicious IP data
   */
  async clearSuspiciousIp(clientIp: string): Promise<boolean> {
    const key = `${this.SUSPICIOUS_IPS_KEY}:${clientIp}`;
    const result = await this.redisService.del(key);

    if (result > 0) {
      this.logger.log(`Cleared suspicious IP data for ${clientIp}`);
      return true;
    }

    return false;
  }

  /**
   * Get real-time request metrics
   */
  async getRequestMetrics(): Promise<{
    currentMinute: number;
    currentHour: number;
    activeIps: number;
  }> {
    return this.redisService.executeOperation(
      async redis => {
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        const currentHour = Math.floor(now / 3600000);

        // Count requests in current minute
        const minutePattern = `${this.REQUEST_TRACKING_KEY}:*:minute:${currentMinute}`;
        const hourPattern = `${this.REQUEST_TRACKING_KEY}:*:hour:${currentHour}`;

        const minuteKeys = await redis.keys(minutePattern);
        const hourKeys = await redis.keys(hourPattern);

        let currentMinuteRequests = 0;
        let currentHourRequests = 0;

        if (minuteKeys.length > 0) {
          const minuteCounts = await redis.mget(minuteKeys);
          currentMinuteRequests = minuteCounts.reduce(
            (sum: number, count) => sum + parseInt(count || '0'),
            0,
          );
        }

        if (hourKeys.length > 0) {
          const hourCounts = await redis.mget(hourKeys);
          currentHourRequests = hourCounts.reduce(
            (sum: number, count) => sum + parseInt(count || '0'),
            0,
          );
        }

        return {
          currentMinute: currentMinuteRequests,
          currentHour: currentHourRequests,
          activeIps: minuteKeys.length,
        };
      },
      {
        currentMinute: 0,
        currentHour: 0,
        activeIps: 0,
      },
      'getRequestMetrics',
    );
  }

  /**
   * Clean up old security data (Redis TTL handles most cleanup)
   */
  async cleanup(): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        // Clean up old request tracking data (older than 1 hour)
        const oneHourAgo = Math.floor((Date.now() - 3600000) / 60000);
        const oldPattern = `${this.REQUEST_TRACKING_KEY}:*:minute:${oneHourAgo}`;
        const oldKeys = await redis.keys(oldPattern);

        if (oldKeys.length > 0) {
          await redis.del(...oldKeys);
          this.logger.log(`Cleaned up ${oldKeys.length} old security tracking records`);
        }
      },
      undefined,
      'cleanup',
    );
  }
}
