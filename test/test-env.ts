import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Test environment configuration utility
 * Ensures all tests use environment variables instead of hardcoded values
 */
export class TestEnvironment {
  private static initialized = false;

  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Load main .env file first (silently)
    dotenv.config({ path: path.resolve(process.cwd(), '.env'), debug: false });

    // Load integration test .env if it exists (silently)
    const integrationEnvPath = path.resolve(process.cwd(), '.env.integration');
    dotenv.config({ path: integrationEnvPath, debug: false });

    // Configure test timeouts and Redis settings for better test stability
    process.env.REDIS_COMMAND_TIMEOUT = '2000'; // 2 seconds - reduced for tests
    process.env.REDIS_CONNECT_TIMEOUT = '5000'; // 5 seconds - reduced for tests
    process.env.REDIS_RETRY_DELAY_ON_FAILOVER = '50';
    process.env.REDIS_MAX_RETRIES_PER_REQUEST = '1'; // Minimal retries for tests

    // Disable some security features for faster tests
    process.env.SECURITY_MIDDLEWARE_LIGHT_MODE = 'true';

    // Validate required environment variables
    this.validateEnvironment();

    this.initialized = true;
  }

  private static validateEnvironment(): void {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for tests: ${missing.join(', ')}\n` +
          'Please ensure your .env file is properly configured.\n' +
          'You can copy .env.example to .env and update the values.',
      );
    }

    // Validate DATABASE_URL format
    if (!this.isValidDatabaseUrl(process.env.DATABASE_URL!)) {
      throw new Error(
        'Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database',
      );
    }

    // Set test-specific environment
    process.env.NODE_ENV = 'test';

    // Only log environment details if VERBOSE_TESTS is set or if there are issues
    if (process.env.VERBOSE_TESTS === 'true') {
      console.log('✅ Test environment validated successfully');
      console.log(`📊 NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`🗄️ Database: ${this.maskSensitiveUrl(process.env.DATABASE_URL!)}`);
      if (process.env.REDIS_URL) {
        console.log(`🔴 Redis: ${this.maskSensitiveUrl(process.env.REDIS_URL)}`);
      }
    }
  }

  private static isValidDatabaseUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'postgresql:' && !!parsed.hostname;
    } catch {
      return false;
    }
  }

  private static maskSensitiveUrl(url: string): string {
    return url.replace(/\/\/[^@]+@/, '//***:***@');
  }

  /**
   * Get a test-specific database URL
   * For local databases, appends '_test' to the database name
   * For cloud databases, uses the same database
   */
  static getTestDatabaseUrl(): string {
    const originalUrl = process.env.DATABASE_URL!;

    // If it's a local database, create a test database
    if (originalUrl.includes('localhost') || originalUrl.includes('127.0.0.1')) {
      return originalUrl.replace(/\/([^/?]+)(\?|$)/, '/$1_test$2');
    }

    // For cloud databases (Neon, Supabase, etc.), use the same database
    // but warn the user
    console.warn(
      '⚠️  Using cloud database for tests. ' +
        'Consider setting up a separate test database for better isolation.',
    );

    return originalUrl;
  }

  /**
   * Clean up environment after tests
   */
  static cleanup(): void {
    // Reset any test-specific configurations
    this.initialized = false;
  }

  /**
   * Get Redis configuration optimized for tests
   */
  static getRedisConfig(): any {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL not configured, Redis features will be disabled in tests');
      return null;
    }

    return {
      url: redisUrl,
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY_ON_FAILOVER || '100'),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3'),
      lazyConnect: true, // Connect only when needed
      enableReadyCheck: false, // Skip ready check for faster tests
      maxLoadingTimeout: 5000, // Max time to wait for Redis to load
    };
  }

  /**
   * Check if we're using local development setup
   */
  static isLocalDevelopment(): boolean {
    const dbUrl = process.env.DATABASE_URL || '';
    return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  }
}
