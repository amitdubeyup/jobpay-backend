import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterUserInput } from '../users/dto/user.input';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email, true);
    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      return new User({ ...user, password: undefined });
    } else {
      return null;
    }
  }

  async login(email: string, password: string) {
    this.logger.log(`🔐 Login attempt for email: ${email}`);

    const user = await this.validateUser(email, password);
    if (!user) {
      this.logger.warn(`❌ Failed login attempt for email: ${email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login timestamp
    await this.usersService.updateLastLogin(user.id);

    const accessToken = this.jwtService.sign({ userId: user.id, email: user.email });
    this.logger.log(`✅ Successful login for user: ${user.id}`);

    return {
      accessToken,
      user,
    };
  }

  async register(input: RegisterUserInput) {
    this.logger.log(`📝 User registration attempt for email: ${input.email}`);

    try {
      const user = await this.usersService.createUser(input);
      this.logger.log(`✅ User registered successfully: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(
        `❌ Registration failed for email: ${input.email}`,
        error instanceof Error ? error.stack : 'Unknown error',
      );
      throw error;
    }
  }
}
