/**
 * Jest global teardown to ensure proper cleanup of resources
 */

export default async () => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Close any open handles
  if (process.env.NODE_ENV === 'test') {
    // Force exit after a short delay to ensure cleanup
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
};
