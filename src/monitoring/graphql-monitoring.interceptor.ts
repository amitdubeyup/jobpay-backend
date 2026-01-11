import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';

/**
 * GraphQL Monitoring Interceptor
 *
 * This interceptor automatically tracks GraphQL operations including:
 * - Operation timing
 * - Success/failure rates
 * - Custom attributes for detailed monitoring
 */
@Injectable()
export class GraphQLMonitoringInterceptor implements NestInterceptor {
  private readonly logger = new Logger(GraphQLMonitoringInterceptor.name);

  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();

    if (!info || !info.operation) {
      return next.handle();
    }

    const operationType = info.operation.operation;
    const operationName = info.fieldName;

    // Track GraphQL operation start
    this.monitoringService.recordCustomEvent('graphql_operation_start', {
      operation_type: operationType,
      operation_name: operationName,
      field_name: info.fieldName,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          // Track successful GraphQL operation
          this.monitoringService.recordCustomEvent('graphql_operation_success', {
            operation_type: operationType,
            operation_name: operationName,
            field_name: info.fieldName,
          });
        },
        error: error => {
          // Track GraphQL operation error
          this.monitoringService.noticeError(error, {
            operation_type: operationType,
            operation_name: operationName,
            field_name: info.fieldName,
          });
        },
      }),
    );
  }

  /**
   * Count the number of fields in the GraphQL query
   */
  private getFieldCount(info: any): number {
    try {
      const selections = info.fieldNodes[0]?.selectionSet?.selections;
      return selections ? selections.length : 0;
    } catch {
      return 0;
    }
  }
}
