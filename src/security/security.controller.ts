import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
// ✅ REPLACED: Memory-leaking services with Redis-based ones
import { Roles } from '../auth/decorators/roles.decorator';
import { HttpRolesGuard } from '../auth/guards/roles.guard';
import { RedisIpBlockingService } from './redis-ip-blocking.service';
import { RedisPerformanceService } from './redis-performance.service';
import { RedisSecurityService } from './redis-security.service';

@Controller('security')
@UseGuards(AuthGuard('jwt'), HttpRolesGuard)
export class SecurityController {
  constructor(
    // ✅ REPLACED: Memory-leaking services with Redis-based ones
    private readonly securityService: RedisSecurityService,
    private readonly ipBlockingService: RedisIpBlockingService,
    private readonly performanceService: RedisPerformanceService,
  ) {}

  @Get('stats')
  @Roles('ADMIN')
  async getSecurityStats() {
    const [ipBlocking, performance] = await Promise.all([
      this.ipBlockingService.getStats(),
      this.performanceService.getSystemMetrics(),
    ]);

    return {
      ipBlocking,
      performance,
    };
  }

  @Get('blocked-ips')
  @Roles('ADMIN')
  async getBlockedIps() {
    return this.ipBlockingService.getBlockedIps();
  }

  @Get('suspicious-activity')
  @Roles('ADMIN')
  async getSuspiciousActivity() {
    return this.ipBlockingService.getSuspiciousActivity();
  }

  @Get('performance/report')
  @Roles('ADMIN')
  async getPerformanceReport() {
    const systemMetrics = await this.performanceService.getSystemMetrics();
    const endpointStats = await this.performanceService.getEndpointStats();

    return {
      systemMetrics,
      endpointStats,
      alerts: await this.performanceService.getPerformanceAlerts(),
    };
  }

  @Get('performance/slowest')
  @Roles('ADMIN')
  async getSlowestEndpoints() {
    const endpointStats = await this.performanceService.getEndpointStats();
    return endpointStats
      .sort((a: any, b: any) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 20);
  }

  @Post('block-ip/:ip')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async blockIp(
    @Param('ip') ip: string,
    @Body() body: { reason: string; durationMinutes?: number },
  ) {
    await this.ipBlockingService.blockIp(ip, body.reason, body.durationMinutes);
    return { message: `IP ${ip} has been blocked`, success: true };
  }

  @Post('unblock-ip/:ip')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async unblockIp(@Param('ip') ip: string) {
    const success = await this.ipBlockingService.unblockIp(ip);
    return {
      message: success ? `IP ${ip} has been unblocked` : `IP ${ip} was not blocked`,
      success,
    };
  }

  @Post('cleanup')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async cleanup() {
    await Promise.all([
      this.ipBlockingService.cleanup(),
      this.performanceService.clearOldMetrics(),
    ]);
    return { message: 'Security cleanup completed', success: true };
  }
}
