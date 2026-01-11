import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitingService } from './rate-limiting.service';
// ✅ REPLACED: Memory-leaking services with Redis-based ones
import { RedisIpBlockingService } from './redis-ip-blocking.service';
import { RedisPerformanceService } from './redis-performance.service';
import { RedisSecurityService } from './redis-security.service';
import { SecurityController } from './security.controller';
import { SecurityMiddleware } from './security.middleware';
import { ValidationService } from './validation.service';

@Module({
  imports: [
    // Global rate limiting configuration - PRODUCTION OPTIMIZED
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second (increased from 3)
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests per 10 seconds (increased from 20)
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 300, // 300 requests per minute (increased from 100)
      },
    ]),
  ],
  controllers: [SecurityController],
  providers: [
    RateLimitingService,
    // ✅ REPLACED: Memory-leaking services with Redis-based ones
    RedisSecurityService,
    RedisIpBlockingService,
    ValidationService,
    RedisPerformanceService,
  ],
  exports: [
    RateLimitingService,
    // ✅ REPLACED: Memory-leaking services with Redis-based ones
    RedisSecurityService,
    RedisIpBlockingService,
    ValidationService,
    RedisPerformanceService,
  ],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*'); // Apply to all routes
  }
}
