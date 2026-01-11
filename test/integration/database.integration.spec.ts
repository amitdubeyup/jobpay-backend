import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Database Integration Tests', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Ensure we have the required environment variables from .env
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for integration tests. Please check your .env file.',
      );
    }

    console.log('🔗 Using DATABASE_URL:', process.env.DATABASE_URL.substring(0, 50) + '...');
    console.log('🔗 Using REDIS_URL:', process.env.REDIS_URL?.substring(0, 30) + '...');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        logger: false, // Disable logging in tests
        trustProxy: true,
      }),
    );
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
    await app.getHttpAdapter().getInstance().ready(); // Wait for Fastify to be ready
  });

  afterAll(async () => {
    // Only clean if in test environment to prevent accidental production cleanup
    if (process.env.NODE_ENV === 'test') {
      await prisma.cleanDatabase();
    }
    await app.close();
  });

  describe('User Operations', () => {
    it('should create and retrieve a user', async () => {
      // Test actual database operations
      const userData = {
        email: `test-${Date.now()}@example.com`, // Unique email
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await prisma.user.create({
        data: userData,
      });

      expect(user.email).toBe(userData.email);
      expect(user.id).toBeDefined();

      // Cleanup - Check existence before deletion
      const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (existingUser) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  describe('Job Operations', () => {
    it('should handle job creation with poster relationship', async () => {
      // Create user first
      const user = await prisma.user.create({
        data: {
          email: `poster-${Date.now()}@example.com`, // Unique email
          password: 'hashedpass',
          firstName: 'Job',
          lastName: 'Poster',
        },
      });

      // Create job
      const job = await prisma.job.create({
        data: {
          title: 'Test Job',
          description: 'Test job description',
          budget: 5000,
          posterId: user.id,
        },
        include: { poster: true },
      });

      expect(job.title).toBe('Test Job');
      expect(job.poster.firstName).toBe('Job');
      expect(job.poster.lastName).toBe('Poster');

      // Cleanup - Check existence before deletion to handle cascade deletes
      const existingJob = await prisma.job.findUnique({ where: { id: job.id } });
      if (existingJob) {
        await prisma.job.delete({ where: { id: job.id } });
      }

      const existingUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (existingUser) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });
});
