import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockPrismaService = {
      $queryRaw: jest.fn(),
    };

    const mockRedisService = {
      healthCheck: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return healthy status when database and redis are connected', async () => {
      // Mock successful database query
      prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);

      // Mock successful Redis health check
      redisService.healthCheck.mockResolvedValue({
        status: 'connected',
        connected: true,
        latency: 5,
      });

      const result = await controller.check();

      expect(result).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: process.env.NODE_ENV,
        version: expect.any(String),
        database: 'connected',
        redis: {
          status: 'connected',
          connected: true,
          latency: 5,
        },
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
        },
      });

      expect(prismaService.$queryRaw).toHaveBeenCalledWith`SELECT 1`;
      expect(redisService.healthCheck).toHaveBeenCalled();
    });

    it('should return error status when database is disconnected', async () => {
      // Mock database connection failure
      const dbError = new Error('Connection refused');
      prismaService.$queryRaw.mockRejectedValue(dbError);

      const result = await controller.check();

      expect(result).toEqual({
        status: 'error',
        timestamp: expect.any(String),
        environment: process.env.NODE_ENV,
        database: 'disconnected',
        redis: { status: 'unknown', connected: false },
        error: 'Connection refused',
      });
    });

    it('should handle unknown database errors', async () => {
      // Mock unknown error
      prismaService.$queryRaw.mockRejectedValue('Unknown error');

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.database).toBe('disconnected');
      expect(result.redis).toEqual({ status: 'unknown', connected: false });
      expect(result.error).toBe('Unknown error');
    });

    it('should include memory usage information', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);
      redisService.healthCheck.mockResolvedValue({
        status: 'connected',
        connected: true,
      });

      const result = await controller.check();

      expect(result.memory).toEqual({
        used: expect.any(Number),
        total: expect.any(Number),
      });
      expect(result.memory).toBeDefined();
      if (result.memory) {
        expect(result.memory.used).toBeGreaterThan(0);
        expect(result.memory.total).toBeGreaterThan(result.memory.used);
      }
    });
  });

  describe('readiness', () => {
    it('should return ready status when database is accessible', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ result: 1 }]);

      const result = await controller.readiness();

      expect(result).toEqual({ status: 'ready' });
      expect(prismaService.$queryRaw).toHaveBeenCalledWith`SELECT 1`;
    });

    it('should throw error when database is not accessible', async () => {
      const dbError = new Error('Database not accessible');
      prismaService.$queryRaw.mockRejectedValue(dbError);

      await expect(controller.readiness()).rejects.toThrow('Service not ready');
    });
  });

  describe('liveness', () => {
    it('should always return alive status', () => {
      const result = controller.liveness();

      expect(result).toEqual({ status: 'alive' });
    });

    it('should not depend on external services', () => {
      // This test ensures liveness probe is independent
      const result = controller.liveness();

      expect(result.status).toBe('alive');
      expect(prismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
