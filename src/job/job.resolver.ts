import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { Job } from './job.entity';
import { CreateJobInput } from './dto/create-job.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Resolver(() => Job)
export class JobResolver {
  constructor(private readonly jobService: JobService) {}

  @Query(() => [Job], { name: 'jobs' })
  async findAll(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset: number,
  ): Promise<Job[]> {
    // Enforce maximum limit to prevent excessive data loading
    const safeLimit = Math.min(limit, 100);
    return this.jobService.findAll(safeLimit, offset);
  }

  @Mutation(() => Job)
  @UseGuards(GqlAuthGuard)
  async createJob(
    @Args('input') createJobInput: CreateJobInput,
    @CurrentUser() user: User,
  ): Promise<Job> {
    // Override posterId with authenticated user's ID for security
    const secureInput = {
      ...createJobInput,
      posterId: user.id,
    };
    return this.jobService.create(secureInput);
  }
}
