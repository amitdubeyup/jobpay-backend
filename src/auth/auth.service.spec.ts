import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data without password when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        identityStatus: false,
        isActive: true,
        emailVerified: false,
        mobileVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeDefined();
      expect(result?.password).toBeUndefined();
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com', true);
    });

    it('should return null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        identityStatus: false,
        isActive: true,
        emailVerified: false,
        mobileVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user when credentials are valid', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        identityStatus: false,
        isActive: true,
        emailVerified: false,
        mobileVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser as User);
      jwtService.sign.mockReturnValue('mock-jwt-token');

      const result = await service.login('test@example.com', 'password');

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: mockUser,
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      await expect(service.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    it('should call usersService.createUser with input data', async () => {
      const mockInput = {
        email: 'test@example.com',
        password: 'password',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = {
        id: '1',
        ...mockInput,
        role: 'USER',
        identityStatus: false,
        isActive: true,
        emailVerified: false,
        mobileVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      usersService.createUser.mockResolvedValue(mockUser as User);

      const result = await service.register(mockInput);

      expect(usersService.createUser).toHaveBeenCalledWith(mockInput);
      expect(result).toEqual(mockUser);
    });
  });
});
