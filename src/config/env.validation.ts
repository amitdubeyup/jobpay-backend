import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  REDIS_URL: z
    .string()
    .url()
    .refine(url => url.startsWith('redis://') || url.startsWith('rediss://'), {
      message: 'REDIS_URL must start with "redis://" or "rediss://"',
    }),
  GRAPHQL_PLAYGROUND: z.string().transform(str => str === 'true'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for security'),
  JWT_EXPIRY: z
    .string()
    .min(1)
    .regex(/^\d+[smhd]$/, 'JWT_EXPIRY must be in format like "1d", "7d", "24h", etc.'),
});

export function validateEnv(config: Record<string, unknown>) {
  try {
    const env = envSchema.parse(config);

    // Additional production checks
    if (env.NODE_ENV === 'production') {
      if (env.JWT_SECRET.length < 64) {
        // eslint-disable-next-line no-console
        console.warn('WARNING: JWT_SECRET should be at least 64 characters in production');
      }
      if (env.GRAPHQL_PLAYGROUND) {
        // eslint-disable-next-line no-console
        console.warn('WARNING: GraphQL Playground should be disabled in production');
      }
    }

    return env;
  } catch (error) {
    throw new Error(
      `Configuration validation error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
