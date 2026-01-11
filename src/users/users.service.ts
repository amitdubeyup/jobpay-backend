import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterUserInput,
  UpdatePersonalDetailsInput,
  UpdateProfileInput,
  VerifyIdentityInput,
} from './dto/user.input';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: RegisterUserInput): Promise<User> {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob ? new Date(data.dob) : undefined,
        gender: data.gender,
        username: data.username,
        countryCode: data.countryCode,
        signupSource: data.signupSource,
        role: data.email === 'admin@jobpay.com' ? UserRole.ADMIN : UserRole.USER,
      },
    });

    return new User({
      ...user,
      id: user.id.toString(),
      password: undefined,
    });
  }

  async findByEmail(email: string, includePassword = false): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { jobs: false },
    });

    if (!user) return null;

    return new User({
      ...user,
      id: user.id.toString(),
      password: includePassword ? user.password : undefined,
    });
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });

    if (!user) return null;

    return new User({
      ...user,
      id: user.id.toString(),
      password: undefined,
    });
  }

  async updateProfile(userId: string, data: UpdateProfileInput): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Record<string, unknown> = {};

    // Always updatable fields
    if (data.email) updateData.email = data.email;
    if (data.phone) updateData.phone = data.phone;
    if (data.photoUrl) updateData.photoUrl = data.photoUrl;
    if (data.username) updateData.username = data.username;

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: updateData,
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }

  async updatePersonalDetails(userId: string, data: UpdatePersonalDetailsInput): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if identity is verified - if so, don't allow personal details update
    if (user.identityStatus) {
      throw new ForbiddenException(
        'Personal details cannot be updated after identity verification',
      );
    }

    const updateData: Record<string, unknown> = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dob !== undefined) updateData.dob = data.dob ? new Date(data.dob) : null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.countryCode !== undefined) updateData.countryCode = data.countryCode;

    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: updateData,
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }

  async verifyIdentity(userId: string, data: VerifyIdentityInput): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.identityStatus) {
      throw new ForbiddenException('Identity is already verified');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        identityNumber: data.identityNumber,
        identityUrl: data.identityUrl,
        identityStatus: true,
      },
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }

  async deactivateAccount(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        isActive: false,
      },
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        lastLogin: new Date(),
      },
    });
  }

  async verifyEmail(userId: string): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        emailVerified: true,
      },
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }

  async verifyMobile(userId: string): Promise<User> {
    const updatedUser = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        mobileVerified: true,
      },
    });

    return new User({
      ...updatedUser,
      id: updatedUser.id.toString(),
      password: undefined,
    });
  }
}
