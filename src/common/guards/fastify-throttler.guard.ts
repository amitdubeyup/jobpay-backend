import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class FastifyThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: any): Promise<string> {
    if (!req) {
      return Promise.resolve('unknown');
    }

    // For Fastify, try multiple ways to get the IP
    let ip: string;

    if (req.ip) {
      ip = req.ip;
    } else if (req.ips && req.ips.length > 0) {
      ip = req.ips[0];
    } else if (req.raw && req.raw.socket && req.raw.socket.remoteAddress) {
      // Fastify raw request
      ip = req.raw.socket.remoteAddress;
    } else if (req.socket && req.socket.remoteAddress) {
      ip = req.socket.remoteAddress;
    } else if (req.connection && req.connection.remoteAddress) {
      ip = req.connection.remoteAddress;
    } else if (req.headers) {
      // Try headers for proxy scenarios
      ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      if (typeof ip === 'string' && ip.includes(',')) {
        ip = ip.split(',')[0].trim();
      }
    } else {
      ip = 'unknown';
    }

    return Promise.resolve(ip);
  }

  protected getKeyGenerator(): (name: string, suffix: string, context: ExecutionContext) => string {
    return (name: string, suffix: string, context: ExecutionContext): string => {
      try {
        const request = context.switchToHttp().getRequest();

        if (!request) {
          return `${name}-unknown-${suffix}`;
        }

        let ip = 'unknown';

        if (request.ip) {
          ip = request.ip;
        } else if (request.ips && request.ips.length > 0) {
          ip = request.ips[0];
        } else if (request.raw && request.raw.socket && request.raw.socket.remoteAddress) {
          ip = request.raw.socket.remoteAddress;
        } else if (request.socket && request.socket.remoteAddress) {
          ip = request.socket.remoteAddress;
        } else if (request.connection && request.connection.remoteAddress) {
          ip = request.connection.remoteAddress;
        } else if (request.headers) {
          ip = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown';
          if (typeof ip === 'string' && ip.includes(',')) {
            ip = ip.split(',')[0].trim();
          }
        }

        return `${name}-${ip}-${suffix}`;
      } catch (error) {
        return `${name}-unknown-${suffix}`;
      }
    };
  }
}
