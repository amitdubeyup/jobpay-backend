import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { Application } from './application.entity';
import { CreateApplicationInput, UpdateApplicationStatusInput } from './dto/application.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Resolver(() => Application)
export class ApplicationResolver {
  constructor(private readonly applicationService: ApplicationService) {}

  @Mutation(() => Application)
  @UseGuards(GqlAuthGuard)
  async applyToJob(
    @Args('input') input: CreateApplicationInput,
    @CurrentUser() user: User,
  ): Promise<Application> {
    return this.applicationService.apply(user.id, input);
  }

  @Mutation(() => Application)
  @UseGuards(GqlAuthGuard)
  async withdrawApplication(
    @Args('applicationId', { type: () => Int }) applicationId: number,
    @CurrentUser() user: User,
  ): Promise<Application> {
    return this.applicationService.withdraw(user.id, applicationId);
  }

  @Mutation(() => Application)
  @UseGuards(GqlAuthGuard)
  async updateApplicationStatus(
    @Args('input') input: UpdateApplicationStatusInput,
    @CurrentUser() user: User,
  ): Promise<Application> {
    return this.applicationService.updateStatus(user.id, input);
  }

  @Query(() => [Application], { name: 'myApplications' })
  @UseGuards(GqlAuthGuard)
  async myApplications(@CurrentUser() user: User): Promise<Application[]> {
    return this.applicationService.getMyApplications(user.id);
  }

  @Query(() => [Application], { name: 'jobApplications' })
  @UseGuards(GqlAuthGuard)
  async jobApplications(
    @Args('jobId', { type: () => Int }) jobId: number,
    @CurrentUser() user: User,
  ): Promise<Application[]> {
    return this.applicationService.getJobApplications(user.id, jobId);
  }

  @Query(() => Application, { name: 'application', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getApplication(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: User,
  ): Promise<Application | null> {
    return this.applicationService.getApplicationById(user.id, id);
  }
}
