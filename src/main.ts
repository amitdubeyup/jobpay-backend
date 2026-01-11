// Load environment variables first
import { config } from 'dotenv';
config();

import { Logger } from '@nestjs/common';

// Create early logger for initialization messages
const initLogger = new Logger('Initialization');

// Initialize monitoring before anything else
// Initialize New Relic monitoring (must be first!)
if (process.env.NEW_RELIC_LICENSE_KEY) {
  require('../../newrelic');
  initLogger.log('✅ New Relic APM initialized successfully');
}

// Initialize OpenTelemetry for Grafana Cloud
if (process.env.GRAFANA_LICENSE_KEY) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeTelemetry } = require('./monitoring/telemetry');
  initializeTelemetry();
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RedisService } from './redis/redis.service';

/* eslint-disable @typescript-eslint/no-var-requires */
const helmet = require('@fastify/helmet');
const cors = require('@fastify/cors');
const rateLimit = require('@fastify/rate-limit');
/* eslint-enable @typescript-eslint/no-var-requires */

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // Disable Fastify's built-in logger
      trustProxy: true,
    }),
    {
      // Configure NestJS logger levels
      logger:
        process.env.NODE_ENV === 'production'
          ? ['error', 'warn', 'log'] // Production: only important logs
          : ['error', 'warn', 'log', 'debug', 'verbose'], // Development: all logs
    },
  );

  const logger = new Logger('Bootstrap');

  // Register Fastify plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  await app.register(cors, {
    origin: (origin: string, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }

      // In production, you should specify allowed origins
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://yourapp.com',
      ];

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Register Fastify rate limiting with Redis support
  const redisService = app.get(RedisService);

  // Give Redis a moment to connect if it's in the process of connecting
  let redisAttempts = 0;
  const maxRedisAttempts = 3;

  while (!redisService.isAvailable() && redisAttempts < maxRedisAttempts) {
    redisAttempts++;
    if (redisAttempts > 1) {
      logger.log(
        `🐞 Waiting for Redis connection... (attempt ${redisAttempts}/${maxRedisAttempts})`,
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (!redisService.isAvailable()) {
    logger.log('⚠️ Redis not available, using in-memory rate limiting');

    // Fallback to in-memory store if Redis URL is not available
    await app.register(rateLimit, {
      max: 100, // Maximum 100 requests
      timeWindow: '1 minute', // Per minute
      cache: 10000, // Cache capacity
      allowList: ['127.0.0.1'], // Allow localhost for development
      skipOnError: true, // Don't fail if rate limiting has issues
    });
  } else {
    const redisClient = redisService.getClient();

    try {
      // Test Redis connection
      if (redisClient) {
        await redisClient.ping();
        logger.log('✅ Redis connected for rate limiting');

        // Use Redis for distributed rate limiting
        await app.register(rateLimit, {
          max: 100, // Maximum 100 requests
          timeWindow: '1 minute', // Per minute
          cache: 10000, // Cache capacity
          allowList: ['127.0.0.1'], // Allow localhost for development
          redis: redisClient, // Use Redis for distributed rate limiting
          skipOnError: true, // Don't fail if rate limiting has issues
          keyGenerator: (req: any) => {
            // Use the same IP detection logic as SecurityMiddleware
            const forwarded = req.headers['x-forwarded-for'];
            const realIp = req.headers['x-real-ip'];
            const cfConnectingIp = req.headers['cf-connecting-ip'];

            if (cfConnectingIp) return cfConnectingIp;
            if (realIp) return realIp;
            if (forwarded) return forwarded.split(',')[0].trim();

            return req.ip || req.socket?.remoteAddress || 'unknown';
          },
        });
      }
    } catch (error: any) {
      logger.log('⚠️ Redis connection failed, using in-memory rate limiting:', error.message);

      // Fallback to in-memory store if Redis is unavailable
      await app.register(rateLimit, {
        max: 100, // Maximum 100 requests
        timeWindow: '1 minute', // Per minute
        cache: 10000, // Cache capacity
        allowList: ['127.0.0.1'], // Allow localhost for development
        skipOnError: true, // Don't fail if rate limiting has issues
      });
    }
  }

  // Enable global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable validation pipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validateCustomDecorators: true,
    }),
  );

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  logger.log(`🚀 Application is running on port: ${port}`);
}

bootstrap();
