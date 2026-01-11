import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Mock the GqlArgumentsHost.create method
jest.mock('@nestjs/graphql', () => ({
  GqlArgumentsHost: {
    create: jest.fn(),
  },
  GqlExceptionFilter: class {},
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;
  let mockGqlHost: any;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GqlArgumentsHost } = require('@nestjs/graphql');

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockRequest = {
      url: '/test',
      method: 'GET',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockGqlHost = {
      getContext: jest.fn().mockReturnValue({ req: mockRequest }),
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
      getType: jest.fn().mockReturnValue('http'),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
    } as unknown as ArgumentsHost;

    // Setup the mock for GqlArgumentsHost.create
    GqlArgumentsHost.create.mockReturnValue(mockGqlHost);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Exception Handling', () => {
    it('should handle HTTP exceptions correctly', () => {
      const httpException = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(httpException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Test error',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Generic error message');

      filter.catch(genericError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Generic error message',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle unknown exceptions', () => {
      const unknownException = 'String error';

      filter.catch(unknownException, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });
  });

  describe('Prisma Error Handling', () => {
    it('should handle P2002 (unique constraint) errors', () => {
      const prismaError = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '4.0.0',
      });

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this data already exists',
          error: 'Conflict',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle P2025 (record not found) errors', () => {
      const prismaError = new PrismaClientKnownRequestError('Record to delete does not exist', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle P2003 (foreign key constraint) errors', () => {
      const prismaError = new PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '4.0.0',
      });

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid foreign key constraint',
          error: 'Bad Request',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });

    it('should handle unknown Prisma errors', () => {
      const prismaError = new PrismaClientKnownRequestError('Unknown Prisma error', {
        code: 'P9999',
        clientVersion: '4.0.0',
      });

      filter.catch(prismaError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error occurred',
          error: 'Internal Server Error',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });
  });

  describe('GraphQL Error Handling', () => {
    beforeEach(() => {
      mockHost.getType = jest.fn().mockReturnValue('graphql');
    });

    it('should throw HttpException for GraphQL context', () => {
      const httpException = new HttpException('GraphQL error', HttpStatus.BAD_REQUEST);

      expect(() => filter.catch(httpException, mockHost)).toThrow(HttpException);
    });

    it('should convert generic errors to HttpException for GraphQL', () => {
      const genericError = new Error('GraphQL generic error');

      expect(() => filter.catch(genericError, mockHost)).toThrow(HttpException);
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should sanitize internal server errors in production', () => {
      const internalError = new Error('Internal error details');

      filter.catch(internalError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          timestamp: expect.any(String),
          path: '/test',
        }),
      );
    });
  });
});
