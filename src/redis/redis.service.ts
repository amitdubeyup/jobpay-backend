import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  constructor() {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Initialize Redis connection
   */
  private async connect(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        this.logger.warn('REDIS_URL not configured, Redis features will be disabled');
        return;
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
            this.logger.error(`Redis connection failed after ${maxRetries} attempts, giving up`);
            return null;
          }
          const delay = process.env.NODE_ENV === 'test' ? 100 : Math.min(times * 2000, 30000);
          this.logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
          return delay;
        },
        // Graceful error handling
        retryDelayOnFailover: process.env.NODE_ENV === 'test' ? 100 : 1000,
        maxLoadingTimeout: process.env.NODE_ENV === 'test' ? 1000 : 5000,
      };

      this.redis = new Redis(redisUrl, config);

      // Setup event handlers
      this.redis.on('connect', () => {
        this.logger.log('Redis connection established');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        this.logger.log('Redis is ready to accept commands');
        this.isConnected = true;
      });

      this.redis.on('error', error => {
        // Reduce log noise in test environment
        if (process.env.NODE_ENV === 'test') {
          this.logger.debug(`Redis error: ${error.message}`);
        } else {
          this.logger.error(`Redis error: ${error.message}`);
        }
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        if (process.env.NODE_ENV === 'test') {
          this.logger.debug('Redis connection closed');
        } else {
          this.logger.warn('Redis connection closed');
        }
        this.isConnected = false;
      });

      this.redis.on('reconnecting', (time: number) => {
        if (process.env.NODE_ENV === 'test') {
          this.logger.debug(`Redis reconnecting in ${time}ms`);
        } else {
          this.logger.log(`Redis reconnecting in ${time}ms`);
        }
        this.isConnected = false;
      });

      // Wait for Redis to be ready before continuing
      if (process.env.NODE_ENV === 'test') {
        // Quick connection test for tests
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout in test')), 1000),
        );
        await Promise.race([this.redis.ping(), timeout]);
      } else {
        // Wait for Redis to be ready with a reasonable timeout
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000),
        );
        await Promise.race([
          new Promise<void>(resolve => {
            if (this.redis?.status === 'ready') {
              resolve();
            } else {
              this.redis?.once('ready', () => resolve());
            }
          }),
          timeout,
        ]);
        await this.redis.ping();
      }
      this.logger.log('✅ Redis connection successful');
    } catch (error: any) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.debug(`Failed to connect to Redis: ${error.message}`);
      } else {
        this.logger.error(`Failed to connect to Redis: ${error.message}`);
      }
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
        this.logger.log('Redis connection closed gracefully');
      } catch (error: any) {
        this.logger.error(`Error closing Redis connection: ${error.message}`);
      } finally {
        this.redis = null;
        this.isConnected = false;
      }
    }
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis | null {
    return this.redis;
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   * Execute Redis operations with error handling and fallback
   */
  async executeOperation<T>(
    operation: (redis: Redis) => Promise<T>,
    fallback: T,
    operationName: string = 'Redis operation',
  ): Promise<T> {
    if (!this.isAvailable() || !this.redis) {
      this.logger.warn(`${operationName} skipped - Redis not available, using fallback`);
      return fallback;
    }

    try {
      return await operation(this.redis);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      // Check for connection-related errors
      if (
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('MaxRetriesPerRequestError') ||
        errorMessage.includes('Connection is closed')
      ) {
        this.logger.warn(`${operationName} failed due to connection issue: ${errorMessage}`);
        this.isConnected = false;
      } else {
        this.logger.error(`${operationName} failed: ${errorMessage}`);
      }

      return fallback;
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ status: string; connected: boolean; latency?: number }> {
    if (!this.redis) {
      return { status: 'disconnected', connected: false };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'connected',
        connected: true,
        latency,
      };
    } catch (error: any) {
      return {
        status: 'error',
        connected: false,
      };
    }
  }

  /**
   * Common Redis operations with built-in error handling
   */

  async get(key: string): Promise<string | null> {
    return this.executeOperation(async redis => redis.get(key), null, `GET ${key}`);
  }

  async set(key: string, value: string, ttl?: number): Promise<string | null> {
    return this.executeOperation(
      async redis => {
        if (ttl) {
          return redis.setex(key, ttl, value);
        }
        return redis.set(key, value);
      },
      null,
      `SET ${key}`,
    );
  }

  async del(key: string): Promise<number> {
    return this.executeOperation(async redis => redis.del(key), 0, `DEL ${key}`);
  }

  async incr(key: string): Promise<number> {
    return this.executeOperation(async redis => redis.incr(key), 0, `INCR ${key}`);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.executeOperation(async redis => redis.expire(key, seconds), 0, `EXPIRE ${key}`);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.executeOperation(
      async redis => redis.hset(key, field, value),
      0,
      `HSET ${key} ${field}`,
    );
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.executeOperation(
      async redis => redis.hget(key, field),
      null,
      `HGET ${key} ${field}`,
    );
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.executeOperation(async redis => redis.hgetall(key), {}, `HGETALL ${key}`);
  }

  async hdel(key: string, field: string): Promise<number> {
    return this.executeOperation(async redis => redis.hdel(key, field), 0, `HDEL ${key} ${field}`);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.executeOperation(async redis => redis.keys(pattern), [], `KEYS ${pattern}`);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.executeOperation(async redis => redis.zadd(key, score, member), 0, `ZADD ${key}`);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    return this.executeOperation(
      async redis => redis.zrangebyscore(key, min, max),
      [],
      `ZRANGEBYSCORE ${key}`,
    );
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    return this.executeOperation(
      async redis => redis.zremrangebyscore(key, min, max),
      0,
      `ZREMRANGEBYSCORE ${key}`,
    );
  }

  async pipeline(): Promise<any> {
    if (!this.isAvailable() || !this.redis) {
      this.logger.warn('Pipeline operation skipped - Redis not available');
      return {
        exec: async () => [],
        incr: () => {},
        expire: () => {},
        hset: () => {},
        zadd: () => {},
      };
    }

    return this.redis.pipeline();
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return this.executeOperation(async redis => redis.mget(keys), [], `MGET ${keys.length} keys`);
  }
}
