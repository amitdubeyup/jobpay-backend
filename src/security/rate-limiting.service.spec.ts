import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { GqlThrottlerGuard, RateLimitingService } from './rate-limiting.service';

describe('RateLimitingService', () => {
  let service: RateLimitingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitingService],
    }).compile();

    service = module.get<RateLimitingService>(RateLimitingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEndpointLimits', () => {
    it('should return specific limits for auth endpoints', () => {
      const loginLimits = service.getEndpointLimits('/auth/login');
      expect(loginLimits).toEqual({ ttl: 60000, limit: 30 }); // Updated for production

      const registerLimits = service.getEndpointLimits('/auth/register');
      expect(registerLimits).toEqual({ ttl: 300000, limit: 15 }); // Updated for production

      const forgotPasswordLimits = service.getEndpointLimits('/auth/forgot-password');
      expect(forgotPasswordLimits).toEqual({ ttl: 3600000, limit: 8 }); // Updated for production
    });

    it('should return specific limits for GraphQL endpoints', () => {
      const graphqlLimits = service.getEndpointLimits('/graphql');
      expect(graphqlLimits).toEqual({ ttl: 60000, limit: 1000 }); // Updated for production
    });

    it('should return specific limits for API endpoints', () => {
      const jobsLimits = service.getEndpointLimits('/api/jobs');
      expect(jobsLimits).toEqual({ ttl: 60000, limit: 2000 }); // Updated for production

      const usersLimits = service.getEndpointLimits('/api/users');
      expect(usersLimits).toEqual({ ttl: 60000, limit: 1000 }); // Updated for production
    });

    it('should return default limits for unknown endpoints', () => {
      const unknownLimits = service.getEndpointLimits('/unknown/endpoint');
      expect(unknownLimits).toEqual({ ttl: 60000, limit: 800 }); // Updated for production
    });

    it('should return specific limits for upload endpoints', () => {
      const uploadLimits = service.getEndpointLimits('/upload');
      expect(uploadLimits).toEqual({ ttl: 60000, limit: 100 }); // Updated for production
    });
  });

  describe('createThrottleDecorator', () => {
    it('should create a throttle decorator with specified limits', () => {
      const decorator = service.createThrottleDecorator(30000, 10);
      expect(decorator).toBeDefined();
      expect(typeof decorator).toBe('function');
    });
  });

  describe('logRateLimit', () => {
    it('should log warning when remaining requests are low', () => {
      const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      service.logRateLimit('192.168.1.1', '/auth/login', 3);

      expect(logSpy).toHaveBeenCalledWith(
        'Rate limit warning for IP 192.168.1.1 on /auth/login. Remaining: 3',
      );

      logSpy.mockRestore();
    });

    it('should not log when remaining requests are above threshold', () => {
      const logSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

      service.logRateLimit('192.168.1.1', '/auth/login', 10);

      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('getRateLimitStats', () => {
    it('should return rate limiting statistics', () => {
      const stats = service.getRateLimitStats();

      expect(stats).toHaveProperty('activeRules');
      expect(stats).toHaveProperty('defaultLimit');
      expect(stats.activeRules).toBe(9); // Updated count for production endpoints
      expect(stats.defaultLimit).toEqual({ ttl: 60000, limit: 800 }); // Updated for production
    });
  });
});

describe('GqlThrottlerGuard', () => {
  let guard: GqlThrottlerGuard;

  beforeEach(async () => {
    const mockReflectorInstance = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
      getAllAndOverride: jest.fn(),
    };

    const mockThrottlerStorage = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1, timeToExpire: 60000 }),
      getRecord: jest.fn().mockResolvedValue({ totalHits: 0, timeToExpire: 60000 }),
    };

    const mockThrottlerOptions = {
      throttlers: [{ name: 'default', ttl: 60000, limit: 10 }],
      storage: mockThrottlerStorage,
      skipIf: () => false,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GqlThrottlerGuard,
        { provide: Reflector, useValue: mockReflectorInstance },
        { provide: 'THROTTLER:MODULE_OPTIONS', useValue: mockThrottlerOptions },
        { provide: ThrottlerStorage, useValue: mockThrottlerStorage },
      ],
    }).compile();

    guard = module.get<GqlThrottlerGuard>(GqlThrottlerGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getRequestResponse', () => {
    it('should extract request and response from GraphQL context', () => {
      const mockGqlContext = {
        req: { test: 'request' },
        res: { test: 'response' },
      };

      const mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as unknown as ExecutionContext;

      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: jest.fn().mockReturnValue(mockGqlContext),
        getArgs: jest.fn(),
        getRoot: jest.fn(),
        getInfo: jest.fn(),
        getType: jest.fn(),
      } as unknown as GqlExecutionContext);

      const result = guard.getRequestResponse(mockExecutionContext);
      expect(result).toEqual({
        req: { test: 'request' },
        res: { test: 'response' },
      });
    });
  });

  describe('getTracker', () => {
    it('should extract IP from CF-Connecting-IP header', async () => {
      const req = {
        headers: { 'cf-connecting-ip': '1.1.1.1' },
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('1.1.1.1');
    });

    it('should extract IP from X-Real-IP header when CF header not present', async () => {
      const req = {
        headers: { 'x-real-ip': '2.2.2.2' },
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('2.2.2.2');
    });

    it('should extract IP from X-Forwarded-For header', async () => {
      const req = {
        headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' },
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('3.3.3.3');
    });

    it('should fall back to req.ip', async () => {
      const req = {
        headers: {},
        ip: '5.5.5.5',
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('5.5.5.5');
    });

    it('should fall back to connection.remoteAddress', async () => {
      const req = {
        headers: {},
        connection: { remoteAddress: '6.6.6.6' },
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('6.6.6.6');
    });

    it('should return "unknown" when no IP sources available', async () => {
      const req = {
        headers: {},
      };

      const tracker = await guard['getTracker'](req);
      expect(tracker).toBe('unknown');
    });
  });

  describe('getErrorMessage', () => {
    it('should return appropriate error message', async () => {
      const message = await guard['getErrorMessage']();
      expect(message).toBe('Rate limit exceeded. Please slow down your requests.');
    });
  });
});
