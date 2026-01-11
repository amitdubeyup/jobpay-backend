import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisConfig {
  private static readonly logger = new Logger(RedisConfig.name);

  static createRedisInstance(): Redis {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      RedisConfig.logger.warn('REDIS_URL not found, Redis features will be disabled');
      throw new Error('Redis URL not configured');
    }

    const config = {
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '30000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '10000'),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3'),
      lazyConnect: false, // Changed: Connect immediately during startup
      enableReadyCheck: true,
      // Enable offline queue in test environment to prevent connection errors
      enableOfflineQueue: process.env.NODE_ENV === 'test',
      keepAlive: 30000,
      family: 4,
      retryStrategy: (times: number) => {
        // In test environment, fail faster to avoid hanging tests
        const maxRetries = process.env.NODE_ENV === 'test' ? 2 : 5;
        if (times > maxRetries) {
          RedisConfig.logger.error(
            `Redis connection failed after ${maxRetries} attempts, giving up`,
          );
          return null;
        }
        const delay = process.env.NODE_ENV === 'test' ? 100 : Math.min(times * 2000, 30000);
        RedisConfig.logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      // Graceful error handling
      retryDelayOnFailover: process.env.NODE_ENV === 'test' ? 100 : 1000,
      maxLoadingTimeout: process.env.NODE_ENV === 'test' ? 1000 : 5000,
    };

    const redis = new Redis(redisUrl, config);

    // Setup event handlers with environment-aware logging
    redis.on('connect', () => {
      if (process.env.NODE_ENV !== 'test') {
        RedisConfig.logger.log('Redis connection established');
      }
    });

    redis.on('ready', () => {
      if (process.env.NODE_ENV !== 'test') {
        RedisConfig.logger.log('Redis is ready to accept commands');
      }
    });

    redis.on('error', error => {
      if (process.env.NODE_ENV === 'test') {
        RedisConfig.logger.debug(`Redis error: ${error.message}`);
      } else {
        RedisConfig.logger.error(`Redis error: ${error.message}`);
      }
    });

    redis.on('close', () => {
      if (process.env.NODE_ENV === 'test') {
        RedisConfig.logger.debug('Redis connection closed');
      } else {
        RedisConfig.logger.warn('Redis connection closed');
      }
    });

    redis.on('reconnecting', (time: number) => {
      if (process.env.NODE_ENV === 'test') {
        RedisConfig.logger.debug(`Redis reconnecting in ${time}ms`);
      } else {
        RedisConfig.logger.log(`Redis reconnecting in ${time}ms`);
      }
    });

    return redis;
  }

  static getRedisConfigForBull() {
    if (!process.env.REDIS_URL) {
      return undefined;
    }

    try {
      const url = new URL(process.env.REDIS_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        username: url.username || undefined,
        connectTimeout: 30000,
        commandTimeout: 10000,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        retryStrategy: (times: number) => {
          if (times > 5) return null;
          return Math.min(times * 2000, 30000);
        },
      };
    } catch (error: any) {
      RedisConfig.logger.error(`Invalid Redis URL: ${error.message}`);
      return undefined;
    }
  }
}
