import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      const mockInput = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockCreatedUser = {
        id: BigInt(1),
        email: 'test@example.com',
        phone: null,
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
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
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.createUser(mockInput);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockInput.email,
          password: 'hashedPassword',
          firstName: mockInput.firstName,
          lastName: mockInput.lastName,
          role: 'USER',
        },
      });
      expect(result.password).toBeUndefined();
    });

    it('should assign ADMIN role to admin@jobpay.com', async () => {
      const mockInput = {
        email: 'admin@jobpay.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
      };

      const mockCreatedUser = {
        id: BigInt(1),
        email: 'admin@jobpay.com',
        phone: null,
        password: 'hashedPassword',
        firstName: 'Admin',
        lastName: 'User',
        dob: null,
        gender: null,
        photoUrl: null,
        identityNumber: null,
        identityStatus: false,
        identityUrl: null,
        username: null,
        role: 'ADMIN',
        countryCode: null,
        isActive: true,
        emailVerified: false,
        mobileVerified: false,
        signupSource: null,
        lastLogin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockedBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      prismaService.user.create.mockResolvedValue(mockCreatedUser);

      await service.createUser(mockInput);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockInput.email,
          password: 'hashedPassword',
          firstName: mockInput.firstName,
          lastName: mockInput.lastName,
          role: 'ADMIN',
        },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: BigInt(1),
        email: 'test@example.com',
        phone: null,
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
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
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { jobs: false },
      });
      expect(result).toBeDefined();
    });

    it('should return null when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });
});
