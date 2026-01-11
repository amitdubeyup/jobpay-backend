import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobInput } from './dto/create-job.input';
import { JobService } from './job.service';

describe('JobService', () => {
  let service: JobService;
  let prismaService: {
    job: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrismaService = {
      job: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<JobService>(JobService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new job with poster details', async () => {
      const mockInput: CreateJobInput = {
        title: 'Test Job',
        budget: 5000,
        posterId: '1', // Changed to string
      };

      const mockCreatedJob = {
        id: 1,
        title: 'Test Job',
        description: null,
        budget: 5000,
        status: 'OPEN',
        skills: [],
        isActive: true,
        posterId: BigInt(1),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        poster: {
          id: BigInt(1),
          email: 'poster@example.com',
          phone: null,
          password: 'hashedPassword',
          firstName: 'Job',
          lastName: 'Poster',
          dob: null,
          gender: null,
          photoUrl: null,
          identityNumber: null,
          identityStatus: false,
          identityUrl: null,
          username: null,
          role: 'USER',
          countryCode: null,
          isActive: true,
          emailVerified: false,
          mobileVerified: false,
          signupSource: null,
          lastLogin: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      };

      prismaService.job.create.mockResolvedValue(mockCreatedJob);

      const result = await service.create(mockInput);

      expect(prismaService.job.create).toHaveBeenCalledWith({
        data: {
          title: mockInput.title,
          budget: mockInput.budget,
          posterId: BigInt(mockInput.posterId), // Expect BigInt conversion
          description: null,
          status: 'OPEN',
          skills: [],
          isActive: true,
        },
        include: {
          poster: true,
        },
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Job');
      expect(result.budget).toBe(5000);
      expect(result.poster).toBeDefined();
      expect(result.poster.password).toBeUndefined(); // Password should be excluded
    });

    it('should handle invalid posterId', async () => {
      const mockInput: CreateJobInput = {
        title: 'Test Job',
        budget: 5000,
        posterId: '999', // Non-existent user (changed to string)
      };

      const prismaError = new Error('Foreign key constraint failed');
      prismaService.job.create.mockRejectedValue(prismaError);

      await expect(service.create(mockInput)).rejects.toThrow(prismaError);
    });

    it('should validate required fields', async () => {
      const mockInput: CreateJobInput = {
        title: '',
        budget: -100,
        posterId: '1', // Changed to string
      };

      prismaService.job.create.mockRejectedValue(new Error('Validation failed'));

      await expect(service.create(mockInput)).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return all jobs with poster details', async () => {
      const mockJobs = [
        {
          id: 1,
          title: 'Job 1',
          description: null,
          budget: 5000,
          status: 'OPEN',
          skills: [],
          isActive: true,
          posterId: BigInt(1),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          poster: {
            id: BigInt(1),
            email: 'poster1@example.com',
            phone: null,
            password: 'hashedPassword',
            firstName: 'Poster',
            lastName: 'One',
            dob: null,
            gender: null,
            photoUrl: null,
            identityNumber: null,
            identityStatus: false,
            identityUrl: null,
            username: null,
            role: 'USER',
            countryCode: null,
            isActive: true,
            emailVerified: false,
            mobileVerified: false,
            signupSource: null,
            lastLogin: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        },
        {
          id: 2,
          title: 'Job 2',
          description: null,
          budget: 3000,
          status: 'OPEN',
          skills: [],
          isActive: true,
          posterId: BigInt(2),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          poster: {
            id: BigInt(2),
            email: 'poster2@example.com',
            phone: null,
            password: 'hashedPassword',
            firstName: 'Poster',
            lastName: 'Two',
            dob: null,
            gender: null,
            photoUrl: null,
            identityNumber: null,
            identityStatus: false,
            identityUrl: null,
            username: null,
            role: 'USER',
            countryCode: null,
            isActive: true,
            emailVerified: false,
            mobileVerified: false,
            signupSource: null,
            lastLogin: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        },
      ];

      prismaService.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.findAll();

      expect(prismaService.job.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        include: {
          poster: true,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Job 1');
      expect(result[1].title).toBe('Job 2');

      // Ensure passwords are not included
      expect(result[0].poster.password).toBeUndefined();
      expect(result[1].poster.password).toBeUndefined();
    });

    it('should return empty array when no jobs exist', async () => {
      prismaService.job.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');
      prismaService.job.findMany.mockRejectedValue(dbError);

      await expect(service.findAll()).rejects.toThrow(dbError);
    });
  });

  describe('mapPrismaJobToEntity', () => {
    it('should correctly map Prisma job to entity', () => {
      const mockPrismaJob = {
        id: 1,
        title: 'Test Job',
        description: 'Test job description',
        budget: 5000,
        status: 'OPEN',
        skills: ['JavaScript', 'TypeScript'],
        isActive: true,
        posterId: BigInt(1), // Changed to BigInt
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        poster: {
          id: BigInt(1), // Changed to BigInt
          email: 'poster@example.com',
          firstName: 'Job',
          lastName: 'Poster',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Access private method for testing
      const result = service['mapPrismaJobToEntity'](mockPrismaJob);

      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Job');
      expect(result.description).toBe('Test job description');
      expect(result.budget).toBe(5000);
      expect(result.status).toBe('OPEN');
      expect(result.skills).toEqual(['JavaScript', 'TypeScript']);
      expect(result.isActive).toBe(true);
      expect(result.poster).toBeDefined();
      expect(result.poster.password).toBeUndefined();
      expect(result.poster.firstName).toBe('Job');
      expect(result.poster.lastName).toBe('Poster');
    });

    it('should correctly map Prisma job to entity when poster first name is null', () => {
      const mockPrismaJob = {
        id: 1,
        title: 'Test Job',
        description: 'Test job description',
        budget: 5000,
        status: 'OPEN',
        skills: ['JavaScript', 'TypeScript'],
        isActive: true,
        posterId: BigInt(1), // Changed to BigInt
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        poster: {
          id: BigInt(1), // Changed to BigInt
          email: 'poster@example.com',
          firstName: null, // Testing null firstName case
          lastName: null, // Testing null lastName case
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      // Access private method for testing
      const result = service['mapPrismaJobToEntity'](mockPrismaJob);

      expect(result.poster).toBeDefined();
      expect(result.poster.firstName).toBeNull(); // Should be null when firstName is null
      expect(result.poster.lastName).toBeNull(); // Should be null when lastName is null
      expect(result.poster.password).toBeUndefined();
    });
  });
});
