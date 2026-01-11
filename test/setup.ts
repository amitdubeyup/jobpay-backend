// Test setup file
import 'reflect-metadata';
import { TestEnvironment } from './test-env';

// Store original console methods
const originalConsole = { ...console };

// Initialize test environment before anything else
TestEnvironment.initialize();

// Override console methods to reduce noise during tests (unless VERBOSE_TESTS is set)
if (process.env.VERBOSE_TESTS !== 'true') {
  const silentFn = () => {}; // Silent function that does nothing

  global.console = {
    ...console,
    log: silentFn,
    debug: silentFn,
    info: silentFn,
    // Keep warn and error for important messages
    warn: originalConsole.warn,
    error: originalConsole.error,
  };
}

// Global test configuration
beforeAll(() => {
  // Environment is already configured by TestEnvironment.initialize()
  // Only log if verbose mode is enabled
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('🧪 Running tests with environment configuration');
  }
});

// Global test teardown
afterAll(async () => {
  // Restore original console if it was mocked
  if (process.env.VERBOSE_TESTS !== 'true') {
    global.console = originalConsole;
  }

  // Close any open database connections
  if ((global as any).testPrisma) {
    await (global as any).testPrisma.$disconnect();
  }

  // Clear all timers
  jest.clearAllTimers();

  // Force garbage collection if available
  if ((global as any).gc) {
    (global as any).gc();
  }
});
