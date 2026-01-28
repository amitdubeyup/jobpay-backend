import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let usersService: jest.Mocked<UsersService>;

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
    const mockUsersService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
      updatePersonalDetails: jest.fn(),
      verifyIdentity: jest.fn(),
      deactivateAccount: jest.fn(),
      verifyEmail: jest.fn(),
      verifyMobile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
    usersService = module.get(UsersService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('me', () => {
    it('should return the current user with fresh data from database', async () => {
      const freshUserData = { ...mockUser, firstName: 'Updated' };
      usersService.findById.mockResolvedValue(freshUserData as User);

      const result = await resolver.me(mockUser as User);

      expect(result).toEqual(freshUserData);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('userProfile', () => {
    it('should return user by id', async () => {
      usersService.findById.mockResolvedValue(mockUser as User);

      const result = await resolver.userProfile('1');

      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith('1');
    });

    it('should return null when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await resolver.userProfile('999');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updateInput = {
        email: 'newemail@example.com',
        username: 'newusername',
      };

      const updatedUser = {
        ...mockUser,
        email: updateInput.email,
        username: updateInput.username,
      };

      usersService.updateProfile.mockResolvedValue(updatedUser as User);

      const result = await resolver.updateProfile(mockUser as User, updateInput);

      expect(result).toEqual(updatedUser);
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        updateInput,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      const updateInput = { email: 'newemail@example.com' };

      usersService.updateProfile.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        resolver.updateProfile(mockUser as User, updateInput),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePersonalDetails', () => {
    it('should update personal details when identity not verified', async () => {
      const updateInput = {
        firstName: 'NewFirst',
        lastName: 'NewLast',
      };

      const updatedUser = {
        ...mockUser,
        firstName: updateInput.firstName,
        lastName: updateInput.lastName,
      };

      usersService.updatePersonalDetails.mockResolvedValue(updatedUser as User);

      const result = await resolver.updatePersonalDetails(
        mockUser as User,
        updateInput,
      );

      expect(result).toEqual(updatedUser);
      expect(usersService.updatePersonalDetails).toHaveBeenCalledWith(
        mockUser.id,
        updateInput,
      );
    });

    it('should throw ForbiddenException when identity is verified', async () => {
      const updateInput = { firstName: 'NewFirst' };

      usersService.updatePersonalDetails.mockRejectedValue(
        new ForbiddenException(
          'Personal details cannot be updated after identity verification',
        ),
      );

      await expect(
        resolver.updatePersonalDetails(mockUser as User, updateInput),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verifyIdentity', () => {
    it('should verify identity successfully', async () => {
      const verifyInput = {
        identityNumber: 'ABC123456',
        identityUrl: 'https://example.com/document.pdf',
      };

      const verifiedUser = {
        ...mockUser,
        identityNumber: verifyInput.identityNumber,
        identityUrl: verifyInput.identityUrl,
        identityStatus: true,
      };

      usersService.verifyIdentity.mockResolvedValue(verifiedUser as User);

      const result = await resolver.verifyIdentity(mockUser as User, verifyInput);

      expect(result).toEqual(verifiedUser);
      expect(result.identityStatus).toBe(true);
      expect(usersService.verifyIdentity).toHaveBeenCalledWith(
        mockUser.id,
        verifyInput,
      );
    });

    it('should throw ForbiddenException when already verified', async () => {
      const verifyInput = {
        identityNumber: 'ABC123456',
        identityUrl: 'https://example.com/document.pdf',
      };

      usersService.verifyIdentity.mockRejectedValue(
        new ForbiddenException('Identity is already verified'),
      );

      await expect(
        resolver.verifyIdentity(mockUser as User, verifyInput),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account successfully', async () => {
      const deactivatedUser = {
        ...mockUser,
        isActive: false,
      };

      usersService.deactivateAccount.mockResolvedValue(deactivatedUser as User);

      const result = await resolver.deactivateAccount(mockUser as User);

      expect(result).toEqual(deactivatedUser);
      expect(result.isActive).toBe(false);
      expect(usersService.deactivateAccount).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const verifiedUser = {
        ...mockUser,
        emailVerified: true,
      };

      usersService.verifyEmail.mockResolvedValue(verifiedUser as User);

      const result = await resolver.verifyEmail(mockUser as User);

      expect(result).toEqual(verifiedUser);
      expect(result.emailVerified).toBe(true);
      expect(usersService.verifyEmail).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyMobile', () => {
    it('should verify mobile successfully', async () => {
      const verifiedUser = {
        ...mockUser,
        mobileVerified: true,
      };

      usersService.verifyMobile.mockResolvedValue(verifiedUser as User);

      const result = await resolver.verifyMobile(mockUser as User);

      expect(result).toEqual(verifiedUser);
      expect(result.mobileVerified).toBe(true);
      expect(usersService.verifyMobile).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
