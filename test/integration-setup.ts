import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env before anything else
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('🚀 Test setup: Environment variables loaded');
console.log('📊 NODE_ENV:', process.env.NODE_ENV);
console.log('🔗 DATABASE_URL loaded:', process.env.DATABASE_URL ? '✅ Yes' : '❌ No');
console.log('🔗 REDIS_URL loaded:', process.env.REDIS_URL ? '✅ Yes' : '❌ No');

if (process.env.DATABASE_URL) {
  console.log('🗄️ Database host:', process.env.DATABASE_URL.match(/@([^:/]+)/)?.[1] || 'unknown');
}
