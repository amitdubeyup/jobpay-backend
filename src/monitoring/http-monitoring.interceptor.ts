import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';

/**
 * HTTP Monitoring Interceptor
 *
 * This interceptor automatically tracks HTTP requests including:
 * - Request/response timing
 * - Status codes
 * - Error tracking
 * - Custom attributes for detailed monitoring
 */
@Injectable()
export class HTTPMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HTTPMonitoringInterceptor.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (!request || !response || !request.headers) {
      return next.handle();
    }

    const { method, url, ip, headers } = request;
    const userAgent = headers?.['user-agent'] || 'unknown';
    const contentType = headers?.['content-type'] || 'unknown';

    const timer = this.metricsService.createTimer();

    // Set transaction name for New Relic
    this.monitoringService.setTransactionName('HTTP', `${method} ${this.sanitizeUrl(url)}`);

    // Add custom attributes
    this.monitoringService.addCustomAttributes({
      'http.method': method,
      'http.url': this.sanitizeUrl(url),
      'http.user_agent': userAgent,
      'http.content_type': contentType,
      'http.request_size': this.getRequestSize(request),
    });

    this.logger.debug(`HTTP ${method} started: ${url} from ${ip}`);

    return next.handle().pipe(
      tap(() => {
        const duration = timer();
        const statusCode = response.statusCode;

        // Track successful request
        this.metricsService.recordHttpRequest(method, this.sanitizeUrl(url), statusCode, duration);

        // Add response attributes
        this.monitoringService.addCustomAttributes({
          'http.status_code': statusCode,
          'http.response_size': this.getResponseSize(response),
        });

        this.logger.debug(`HTTP ${method} completed: ${url} ${statusCode} (${duration}ms)`);
      }),
      catchError(error => {
        const duration = timer();
        const statusCode = response.statusCode || 500;

        // Track failed request
        this.metricsService.recordHttpRequest(method, this.sanitizeUrl(url), statusCode, duration);

        // Report error to New Relic
        this.monitoringService.noticeError(error, {
          'http.method': method,
          'http.url': this.sanitizeUrl(url),
          'http.status_code': statusCode,
          'http.error_type': error.constructor.name,
        });

        this.logger.error(
          `HTTP ${method} failed: ${url} ${statusCode} (${duration}ms)`,
          error.message,
        );

        throw error;
      }),
    );
  }

  /**
   * Sanitize URL for monitoring (remove sensitive parameters)
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, 'http://localhost');

      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'password', 'secret', 'key', 'auth'];
      sensitiveParams.forEach(param => {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      });

      // Replace IDs with placeholders
      const pathname = urlObj.pathname.replace(/\/\d+/g, '/{id}');

      return pathname + (urlObj.search ? urlObj.search : '');
    } catch {
      return url.replace(/\/\d+/g, '/{id}');
    }
  }

  /**
   * Get request size in bytes
   */
  private getRequestSize(request: Request): number {
    try {
      const contentLength = request.headers['content-length'];
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get response size in bytes
   */
  private getResponseSize(response: Response): number {
    try {
      const contentLength = response.getHeader('content-length');
      return contentLength ? parseInt(contentLength.toString(), 10) : 0;
    } catch {
      return 0;
    }
  }
}
