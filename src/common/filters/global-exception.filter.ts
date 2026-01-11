import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter, GqlExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const context = gqlHost.getContext();
    const request = context.req;

    let error: Record<string, unknown> = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request?.url || 'GraphQL',
    };

    if (exception instanceof HttpException) {
      error.statusCode = exception.getStatus();
      error.message = exception.message;

      const response = exception.getResponse();
      if (typeof response === 'object') {
        error = { ...error, ...response };
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception);
      error = {
        ...error,
        ...prismaError,
      };
    } else if (exception instanceof Error) {
      error.message = exception.message;
    }

    // Log the error details with environment-aware verbosity
    const isTestingEnvironment =
      process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    if (isTestingEnvironment) {
      // Minimal logging in test environment to reduce noise
      this.logger.debug(
        `${error.statusCode} ${error.message}`,
        `${request?.method || 'GraphQL'} ${error.path}`,
      );
    } else {
      // Full logging in non-test environments
      this.logger.error(
        `${error.statusCode} ${error.message}`,
        exception instanceof Error ? exception.stack : undefined,
        `${request?.method || 'GraphQL'} ${error.path}`,
      );
    }

    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production' && error.statusCode === 500) {
      error.message = 'Internal server error';
      delete error.stack;
    }

    // For GraphQL, throw the error to be handled by GraphQL error formatting
    if (host.getType<'graphql' | 'http' | 'rpc'>() === 'graphql') {
      throw new HttpException(error.message as string, error.statusCode as number);
    }

    // For REST endpoints
    const response = host.switchToHttp().getResponse();
    response.status(error.statusCode).json(error);
  }

  private handlePrismaError(exception: PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this data already exists',
          error: 'Conflict',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'Not Found',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid foreign key constraint',
          error: 'Bad Request',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error occurred',
          error: 'Internal Server Error',
        };
    }
  }
}
