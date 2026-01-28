import { Test, TestingModule } from '@nestjs/testing';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { User } from '../users/user.entity';

describe('AuthResolver', () => {
  let resolver: AuthResolver;
  let authService: jest.Mocked<AuthService>;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER' as any,
    identityStatus: false,
    isActive: true,
    emailVerified: false,
    mobileVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      register: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthResolver,
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    resolver = module.get<AuthResolver>(AuthResolver);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('login', () => {
    it('should return login response with access token and user', async () => {
      const loginInput = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const mockLoginResponse = {
        accessToken: 'mock-jwt-token',
        user: mockUser as User,
      };

      authService.login.mockResolvedValue(mockLoginResponse);

      const result = await resolver.login(loginInput);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(
        loginInput.email,
        loginInput.password,
      );
    });

    it('should throw error when login fails', async () => {
      const loginInput = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      authService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(resolver.login(loginInput)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('register', () => {
    it('should create a new user and return it', async () => {
      const registerInput = {
        email: 'newuser@example.com',
        password: 'Password123',
        firstName: 'New',
        lastName: 'User',
      };

      const createdUser = {
        ...mockUser,
        email: registerInput.email,
        firstName: registerInput.firstName,
        lastName: registerInput.lastName,
      };

      authService.register.mockResolvedValue(createdUser as User);

      const result = await resolver.register(registerInput);

      expect(result).toEqual(createdUser);
      expect(authService.register).toHaveBeenCalledWith(registerInput);
    });

    it('should throw error when registration fails', async () => {
      const registerInput = {
        email: 'existing@example.com',
        password: 'Password123',
      };

      authService.register.mockRejectedValue(new Error('Email already exists'));

      await expect(resolver.register(registerInput)).rejects.toThrow(
        'Email already exists',
      );
    });
  });

  describe('me', () => {
    it('should return the current authenticated user', async () => {
      const result = await resolver.me(mockUser as User);

      expect(result).toEqual(mockUser);
    });
  });
});
