import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import {
  UpdatePersonalDetailsInput,
  UpdateProfileInput,
  VerifyIdentityInput,
} from './dto/user.input';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: User) {
    // Get fresh user data from database
    return this.usersService.findById(user.id);
  }

  @Query(() => User, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async userProfile(@Args('id') id: string) {
    return this.usersService.findById(id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateProfile(@CurrentUser() user: User, @Args('input') input: UpdateProfileInput) {
    return this.usersService.updateProfile(user.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updatePersonalDetails(
    @CurrentUser() user: User,
    @Args('input') input: UpdatePersonalDetailsInput,
  ) {
    return this.usersService.updatePersonalDetails(user.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async verifyIdentity(@CurrentUser() user: User, @Args('input') input: VerifyIdentityInput) {
    return this.usersService.verifyIdentity(user.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async deactivateAccount(@CurrentUser() user: User) {
    return this.usersService.deactivateAccount(user.id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async verifyEmail(@CurrentUser() user: User) {
    return this.usersService.verifyEmail(user.id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async verifyMobile(@CurrentUser() user: User) {
    return this.usersService.verifyMobile(user.id);
  }
}
