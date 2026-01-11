import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
// ✅ REPLACED: Memory-leaking services with Redis-based ones
import { RedisIpBlockingService } from './redis-ip-blocking.service';
import { RedisSecurityService } from './redis-security.service';
import { ValidationService } from './validation.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(
    // ✅ REPLACED: Memory-leaking services with Redis-based ones
    private readonly securityService: RedisSecurityService,
    private readonly ipBlockingService: RedisIpBlockingService,
    private readonly validationService: ValidationService,
  ) {}

  async use(req: FastifyRequest, res: FastifyReply, next: () => void) {
    const startTime = Date.now();
    const clientIp = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const method = req.method;
    const url = req.url;

    // Log request for monitoring
    this.logger.debug(`${method} ${url} from ${clientIp} - ${userAgent}`);

    try {
      // 1. Check if IP is blocked
      const isBlocked = await this.ipBlockingService.isBlocked(clientIp);
      if (isBlocked) {
        this.logger.warn(`Blocked request from IP: ${clientIp}`);
        return res.status(403).send({
          error: 'Access denied',
          message: 'Your IP address has been blocked',
        });
      }

      // 2. Check for known malicious IPs using pattern matching
      if (this.isKnownMaliciousIp(clientIp)) {
        await this.ipBlockingService.blockIp(clientIp, 'Known malicious IP pattern', 1440); // Block for 24 hours
        return res.status(403).send({
          error: 'Access denied',
          message: 'Suspicious IP address detected',
        });
      }

      // 3. Validate request size
      const contentLength = parseInt((req.headers['content-length'] as string) || '0');
      if (contentLength > 50 * 1024 * 1024) {
        // 50MB limit
        this.logger.warn(`Request too large from IP: ${clientIp}, size: ${contentLength}`);
        await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'Oversized request');
        return res.status(413).send({
          error: 'Payload too large',
          message: 'Request size exceeds maximum allowed limit',
        });
      }

      // 4. Check for suspicious user agents
      if (this.isSuspiciousUserAgent(userAgent)) {
        this.logger.warn(`Suspicious user agent from IP: ${clientIp} - ${userAgent}`);
        await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'Suspicious user agent');
      }

      // 5. Check for SQL injection in URL parameters
      if (this.containsSqlInjection(url)) {
        this.logger.warn(`SQL injection attempt from IP: ${clientIp} in URL: ${url}`);
        await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'SQL injection in URL');
        return res.status(400).send({
          error: 'Bad request',
          message: 'Invalid request parameters',
        });
      }

      // 6. Validate request body for injection attacks
      if (req.body && this.containsInjectionAttacks(req.body)) {
        this.logger.warn(`Injection attack attempt from IP: ${clientIp}`);
        await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'Injection attack in body');
        return res.status(400).send({
          error: 'Bad request',
          message: 'Invalid request data',
        });
      }

      // 7. Add security headers (temporarily disabled for debugging)
      // this.addSecurityHeaders(res);

      // 8. Add request tracking using raw response
      if (res.raw) {
        res.raw.on('finish', async () => {
          const duration = Date.now() - startTime;
          const statusCode = res.raw.statusCode;

          this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms - ${clientIp}`);

          // Track failed authentication attempts
          if (url.includes('/auth/') && statusCode === 401) {
            await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'Failed authentication');
          }

          // Track too many requests
          if (statusCode === 429) {
            await this.ipBlockingService.trackSuspiciousActivity(clientIp, 'Rate limit exceeded');
          }
        });
      }

      next();
    } catch (error) {
      this.logger.error(`Security middleware error for IP ${clientIp}:`, error);
      next(); // Continue with request even if security check fails
    }
  }

  private getClientIP(req: FastifyRequest): string {
    const forwarded = req.headers['x-forwarded-for'] as string;
    const realIp = req.headers['x-real-ip'] as string;
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string;

    if (cfConnectingIp) return cfConnectingIp;
    if (realIp) return realIp;
    if (forwarded) return forwarded.split(',')[0].trim();

    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider/i,
      /curl|wget|httpclient/i,
      /scanner|nikto|sqlmap/i,
      /python-requests|go-http-client/i,
      /masscan|nmap/i,
    ];

    // Allow legitimate bots
    const legitimateBots = [
      /googlebot/i,
      /bingbot/i,
      /slurp/i, // Yahoo
      /duckduckbot/i,
      /facebookexternalhit/i,
      /twitterbot/i,
      /linkedinbot/i,
    ];

    if (legitimateBots.some(pattern => pattern.test(userAgent))) {
      return false;
    }

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isKnownMaliciousIp(ip: string): boolean {
    // Check for common malicious IP patterns
    const maliciousPatterns = [
      // Known malicious ranges
      /^192\.0\.2\./, // RFC 5737 test range often used by attackers
      /^198\.51\.100\./, // RFC 5737 test range
      /^203\.0\.113\./, // RFC 5737 test range
      // Add other known malicious patterns
    ];

    return maliciousPatterns.some(pattern => pattern.test(ip));
  }

  private containsSqlInjection(input: string): boolean {
    return this.validationService.containsSqlInjection(input);
  }

  private containsInjectionAttacks(data: unknown): boolean {
    if (typeof data === 'string') {
      return this.validationService.containsSqlInjection(data);
    }

    if (typeof data === 'object' && data !== null) {
      return this.validationService.containsNoSqlInjection(data);
    }

    return false;
  }

  private addSecurityHeaders(res: FastifyReply): void {
    try {
      // Use the raw response object for setting headers in Fastify/NestJS
      if (res.raw && res.raw.setHeader) {
        res.raw.setHeader('X-XSS-Protection', '1; mode=block');
        res.raw.setHeader('X-Content-Type-Options', 'nosniff');
        res.raw.setHeader('X-Frame-Options', 'DENY');
        res.raw.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload',
        );
        res.raw.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        );
        res.raw.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.raw.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      } else {
        // Headers are handled by @fastify/helmet plugin in main.ts
        // This is a no-op fallback since Helmet provides these headers
        this.logger.debug('Security headers handled by @fastify/helmet plugin');
      }
    } catch (error) {
      // Headers are handled by @fastify/helmet plugin in main.ts
      this.logger.debug('Security headers fallback to @fastify/helmet plugin');
    }
  }
}
