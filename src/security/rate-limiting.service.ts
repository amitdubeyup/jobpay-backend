import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);

  /**
   * Enhanced rate limiting for different endpoint types - PRODUCTION OPTIMIZED
   */
  getEndpointLimits(endpoint: string): { ttl: number; limit: number } {
    const limits: Record<string, { ttl: number; limit: number }> = {
      // Authentication endpoints - security-focused
      '/auth/login': { ttl: 60000, limit: 30 }, // Increased from 20 to 30 attempts per minute
      '/auth/register': { ttl: 300000, limit: 15 }, // Increased from 10 to 15 registrations per 5 minutes
      '/auth/forgot-password': { ttl: 3600000, limit: 8 }, // Increased from 5 to 8 attempts per hour

      // GraphQL endpoints - HIGH PERFORMANCE
      '/graphql': { ttl: 60000, limit: 1000 }, // 1000 queries per minute (~16.67 RPS)

      // File upload endpoints - moderate increase
      '/upload': { ttl: 60000, limit: 100 }, // Increased from 50 to 100 uploads per minute

      // API endpoints - HIGH PERFORMANCE
      '/api/jobs': { ttl: 60000, limit: 2000 }, // 2000 requests per minute (~33.33 RPS)
      '/api/users': { ttl: 60000, limit: 1000 }, // 1000 requests per minute (~16.67 RPS)

      // Admin endpoints - controlled access
      '/api/admin': { ttl: 60000, limit: 200 }, // 200 requests per minute for admin operations

      // Health checks - high frequency allowed
      '/health': { ttl: 60000, limit: 2000 }, // Allow frequent health checks
    };

    const defaultLimits = { ttl: 60000, limit: 800 }; // Increased from 600 to 800 requests per minute
    return limits[endpoint] || defaultLimits;
  }

  /**
   * Create custom throttle decorator for specific endpoints
   */
  createThrottleDecorator(ttl: number, limit: number) {
    return Throttle({ default: { ttl, limit } });
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(ip: string, endpoint: string, remaining: number): void {
    if (remaining <= 5) {
      this.logger.warn(`Rate limit warning for IP ${ip} on ${endpoint}. Remaining: ${remaining}`);
    }
  }

  /**
   * Get rate limiting statistics - PRODUCTION ENHANCED
   */
  getRateLimitStats() {
    const defaultLimits = this.getEndpointLimits('');
    return {
      activeRules: 9, // Updated count: auth(3) + api(3) + special(3)
      defaultLimit: defaultLimits,
      productionOptimized: true,
      performanceMode: 'high',
    };
  }

  /**
   * Dynamic rate limit adjustment based on server load
   */
  getDynamicLimits(endpoint: string, serverLoad: number): { ttl: number; limit: number } {
    const baseLimits = this.getEndpointLimits(endpoint);

    // Adjust limits based on server load (0-100%)
    if (serverLoad > 80) {
      // High load: reduce limits by 30%
      return {
        ttl: baseLimits.ttl,
        limit: Math.floor(baseLimits.limit * 0.7),
      };
    } else if (serverLoad < 30) {
      // Low load: increase limits by 20%
      return {
        ttl: baseLimits.ttl,
        limit: Math.floor(baseLimits.limit * 1.2),
      };
    }

    return baseLimits;
  }
}

/**
 * Custom throttler guard that works with GraphQL
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(GqlThrottlerGuard.name);

  getRequestResponse(context: ExecutionContext) {
    const gqlCtx = GqlExecutionContext.create(context);
    const ctx = gqlCtx.getContext();
    return { req: ctx.req, res: ctx.res };
  }

  protected async getTracker(req: {
    headers?: Record<string, string | string[]>;
    ip?: string;
    connection?: { remoteAddress?: string };
  }): Promise<string> {
    // Get real IP address considering proxies
    const forwarded = req.headers?.['x-forwarded-for'] as string;
    const realIp = req.headers?.['x-real-ip'] as string;
    const cfConnectingIp = req.headers?.['cf-connecting-ip'] as string; // Cloudflare

    if (cfConnectingIp) return cfConnectingIp;
    if (realIp) return realIp;
    if (forwarded) return forwarded.split(',')[0].trim();

    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  protected async getErrorMessage(): Promise<string> {
    return 'Rate limit exceeded. Please slow down your requests.';
  }
}
