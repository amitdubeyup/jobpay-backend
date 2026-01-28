import { Test, TestingModule } from '@nestjs/testing';
import { JobResolver } from './job.resolver';
import { JobService } from './job.service';
import { Job } from './job.entity';
import { User } from '../users/user.entity';

describe('JobResolver', () => {
  let resolver: JobResolver;
  let jobService: jest.Mocked<JobService>;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'employer@example.com',
    firstName: 'Test',
    lastName: 'Employer',
    role: 'USER' as any,
    identityStatus: true,
    isActive: true,
    emailVerified: true,
    mobileVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJob: Partial<Job> = {
    id: 1,
    title: 'Software Engineer',
    description: 'Build amazing software',
    budget: 50000,
    status: 'OPEN',
    skills: ['TypeScript', 'React', 'Node.js'],
    isActive: true,
    posterId: '1',
    poster: mockUser as User,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockJobService = {
      create: jest.fn(),
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobResolver,
        { provide: JobService, useValue: mockJobService },
      ],
    }).compile();

    resolver = module.get<JobResolver>(JobResolver);
    jobService = module.get(JobService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of jobs with default pagination', async () => {
      const mockJobs = [mockJob as Job, { ...mockJob, id: 2 } as Job];
      jobService.findAll.mockResolvedValue(mockJobs);

      const result = await resolver.findAll(20, 0);

      expect(result).toEqual(mockJobs);
      expect(jobService.findAll).toHaveBeenCalledWith(20, 0);
    });

    it('should respect custom pagination parameters', async () => {
      const mockJobs = [mockJob as Job];
      jobService.findAll.mockResolvedValue(mockJobs);

      const result = await resolver.findAll(10, 5);

      expect(result).toEqual(mockJobs);
      expect(jobService.findAll).toHaveBeenCalledWith(10, 5);
    });

    it('should enforce maximum limit of 100', async () => {
      const mockJobs = [mockJob as Job];
      jobService.findAll.mockResolvedValue(mockJobs);

      // Try to request 200, but should be capped at 100
      await resolver.findAll(200, 0);

      expect(jobService.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should return empty array when no jobs exist', async () => {
      jobService.findAll.mockResolvedValue([]);

      const result = await resolver.findAll(20, 0);

      expect(result).toEqual([]);
    });
  });

  describe('createJob', () => {
    it('should create a job with authenticated user as poster', async () => {
      const createJobInput = {
        title: 'New Job',
        description: 'Job description',
        budget: 30000,
        skills: ['JavaScript', 'Python'],
        posterId: '999', // This should be overridden
      };

      const expectedJob = {
        ...mockJob,
        title: createJobInput.title,
        description: createJobInput.description,
        budget: createJobInput.budget,
        skills: createJobInput.skills,
        posterId: mockUser.id, // Should use authenticated user's ID
      };

      jobService.create.mockResolvedValue(expectedJob as Job);

      const result = await resolver.createJob(createJobInput, mockUser as User);

      expect(result).toEqual(expectedJob);
      // Verify that posterId was overridden with authenticated user's ID
      expect(jobService.create).toHaveBeenCalledWith({
        ...createJobInput,
        posterId: mockUser.id,
      });
    });

    it('should throw error when job creation fails', async () => {
      const createJobInput = {
        title: 'New Job',
        budget: 30000,
      };

      jobService.create.mockRejectedValue(new Error('Database error'));

      await expect(
        resolver.createJob(createJobInput, mockUser as User),
      ).rejects.toThrow('Database error');
    });

    it('should handle jobs without optional fields', async () => {
      const createJobInput = {
        title: 'Minimal Job',
        budget: 10000,
      };

      const expectedJob = {
        id: 3,
        title: createJobInput.title,
        budget: createJobInput.budget,
        status: 'OPEN',
        isActive: true,
        posterId: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jobService.create.mockResolvedValue(expectedJob as Job);

      const result = await resolver.createJob(createJobInput, mockUser as User);

      expect(result).toEqual(expectedJob);
    });
  });
});
