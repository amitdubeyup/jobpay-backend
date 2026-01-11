import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MonitoringService } from './monitoring.service';

/**
 * Monitoring Module
 *
 * This module provides monitoring capabilities including:
 * - Application performance monitoring
 * - Custom metrics collection
 * - Health and performance tracking
 * - Integration with New Relic and Grafana
 */
@Global()
@Module({
  providers: [MonitoringService, MetricsService],
  exports: [MonitoringService, MetricsService],
})
export class MonitoringModule {}
