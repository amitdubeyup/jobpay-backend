import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  isTemporary: boolean;
}

@Injectable()
export class RedisIpBlockingService {
  private readonly logger = new Logger(RedisIpBlockingService.name);
  private readonly BLOCKED_IPS_KEY = 'security:blocked_ips';
  private readonly SUSPICIOUS_ACTIVITY_KEY = 'security:suspicious_activity';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Block an IP address with Redis storage
   */
  async blockIp(ip: string, reason: string, durationMinutes?: number): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const now = new Date();
        const expiresAt = durationMinutes
          ? new Date(now.getTime() + durationMinutes * 60000)
          : undefined;

        const blockedIP: BlockedIP = {
          ip,
          reason,
          blockedAt: now,
          expiresAt,
          isTemporary: !!durationMinutes,
        };

        // Store in Redis hash
        await redis.hset(this.BLOCKED_IPS_KEY, ip, JSON.stringify(blockedIP));

        // Set expiration if temporary
        if (durationMinutes) {
          await redis.expire(`${this.BLOCKED_IPS_KEY}:${ip}`, durationMinutes * 60);
        }

        this.logger.warn(
          `IP ${ip} blocked in Redis. Reason: ${reason}. Duration: ${durationMinutes ? `${durationMinutes} minutes` : 'permanent'}`,
        );
      },
      undefined,
      'blockIp',
    );
  }

  /**
   * Unblock an IP address from Redis
   */
  async unblockIp(ip: string): Promise<boolean> {
    return this.redisService.executeOperation(
      async redis => {
        const removed = await redis.hdel(this.BLOCKED_IPS_KEY, ip);
        if (removed > 0) {
          this.logger.log(`IP ${ip} has been unblocked from Redis`);
          return true;
        }
        return false;
      },
      false,
      'unblockIp',
    );
  }

  /**
   * Check if an IP is blocked using Redis
   */
  async isBlocked(ip: string): Promise<boolean> {
    return this.redisService.executeOperation(
      async redis => {
        const blockedData = await redis.hget(this.BLOCKED_IPS_KEY, ip);
        if (!blockedData) return false;

        const blocked: BlockedIP = JSON.parse(blockedData);

        // Check if temporary block has expired
        if (blocked.isTemporary && blocked.expiresAt && new Date() > new Date(blocked.expiresAt)) {
          await this.unblockIp(ip);
          return false;
        }

        return true;
      },
      false,
      'isBlocked',
    );
  }

  /**
   * Track suspicious activity in Redis with automatic expiration
   */
  async trackSuspiciousActivity(ip: string, activity: string): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const activityKey = `${this.SUSPICIOUS_ACTIVITY_KEY}:${ip}`;
        const now = Date.now();

        // Use Redis for atomic increment with expiration
        const attempts = await redis.incr(activityKey);

        // Set expiration on first attempt
        if (attempts === 1) {
          await redis.expire(activityKey, 3600); // 1 hour expiration
        }

        // Store last attempt timestamp
        await redis.hset(
          `${activityKey}:details`,
          'lastAttempt',
          now.toString(),
          'activity',
          activity,
        );
        await redis.expire(`${activityKey}:details`, 3600);

        this.logger.warn(`Suspicious activity from IP ${ip}: ${activity}. Attempts: ${attempts}`);

        // Auto-block after multiple suspicious activities
        if (attempts >= 5) {
          await this.blockIp(ip, `Multiple suspicious activities: ${activity}`, 60); // Block for 1 hour
          await redis.del(activityKey, `${activityKey}:details`);
        }
      },
      undefined,
      'trackSuspiciousActivity',
    );
  }

  /**
   * Get blocked IPs list from Redis
   */
  async getBlockedIps(): Promise<BlockedIP[]> {
    return this.redisService.executeOperation(
      async redis => {
        const blockedData = await redis.hgetall(this.BLOCKED_IPS_KEY);
        return Object.values(blockedData).map((data: string) => JSON.parse(data));
      },
      [],
      'getBlockedIps',
    );
  }

  /**
   * Get suspicious activity report from Redis
   */
  async getSuspiciousActivity(): Promise<
    Array<{ ip: string; attempts: number; lastAttempt: Date }>
  > {
    return this.redisService.executeOperation(
      async redis => {
        const pattern = `${this.SUSPICIOUS_ACTIVITY_KEY}:*`;
        const keys = await redis.keys(pattern);

        const activities = [];
        for (const key of keys) {
          if (!key.includes(':details')) {
            const ip = key.replace(`${this.SUSPICIOUS_ACTIVITY_KEY}:`, '');
            const attempts = await redis.get(key);
            const details = await redis.hgetall(`${key}:details`);

            if (attempts && details.lastAttempt) {
              activities.push({
                ip,
                attempts: parseInt(attempts),
                lastAttempt: new Date(parseInt(details.lastAttempt)),
              });
            }
          }
        }

        return activities;
      },
      [],
      'getSuspiciousActivity',
    );
  }

  /**
   * Cleanup expired entries (Redis handles this automatically)
   */
  async cleanup(): Promise<void> {
    // Redis TTL handles cleanup automatically
    this.logger.log('Redis auto-cleanup completed');
  }

  /**
   * Get IP blocking statistics from Redis
   */
  async getStats() {
    return this.redisService.executeOperation(
      async redis => {
        const totalBlocked = await redis.hlen(this.BLOCKED_IPS_KEY);
        const suspiciousPattern = `${this.SUSPICIOUS_ACTIVITY_KEY}:*`;
        const suspiciousKeys = await redis.keys(suspiciousPattern);
        const suspiciousIps = suspiciousKeys.filter(
          (key: string) => !key.includes(':details'),
        ).length;

        // Count temporary vs permanent blocks
        const blockedData = await redis.hgetall(this.BLOCKED_IPS_KEY);
        const blocks = Object.values(blockedData).map((data: string) => JSON.parse(data));
        const temporaryBlocks = blocks.filter(b => b.isTemporary).length;
        const permanentBlocks = totalBlocked - temporaryBlocks;

        return {
          totalBlocked,
          temporaryBlocks,
          permanentBlocks,
          suspiciousIps,
        };
      },
      {
        totalBlocked: 0,
        temporaryBlocks: 0,
        permanentBlocks: 0,
        suspiciousIps: 0,
      },
      'getStats',
    );
  }

  /**
   * Import malicious IPs with Redis batch operations
   */
  async importMaliciousIpList(ips: string[], reason: string = 'Known malicious IP'): Promise<void> {
    await this.redisService.executeOperation(
      async redis => {
        const pipeline = redis.pipeline();

        for (const ip of ips) {
          const blockedIP: BlockedIP = {
            ip,
            reason,
            blockedAt: new Date(),
            isTemporary: false,
          };

          pipeline.hset(this.BLOCKED_IPS_KEY, ip, JSON.stringify(blockedIP));
        }

        await pipeline.exec();
        this.logger.log(`Imported ${ips.length} malicious IPs to Redis blocklist`);
      },
      undefined,
      'importMaliciousIpList',
    );
  }
}
