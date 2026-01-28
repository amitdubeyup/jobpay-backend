import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JobService } from './job.service';
import { Job, JobSearchResult } from './job.entity';
import { CreateJobInput } from './dto/create-job.input';
import { JobFilterInput, PaginationInput } from './dto/job-filter.input';
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
    const safeLimit = Math.min(limit, 100);
    return this.jobService.findAll(safeLimit, offset);
  }

  @Query(() => JobSearchResult, { name: 'searchJobs' })
  async searchJobs(
    @Args('filter', { nullable: true }) filter: JobFilterInput,
    @Args('pagination', { nullable: true }) pagination: PaginationInput,
  ): Promise<JobSearchResult> {
    const filterInput = filter || {};
    const paginationInput = pagination || { limit: 20, offset: 0 };
    const safeLimit = Math.min(paginationInput.limit || 20, 100);
    const safeOffset = paginationInput.offset || 0;

    const { jobs, total } = await this.jobService.search(filterInput, {
      limit: safeLimit,
      offset: safeOffset,
    });

    return {
      jobs,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + jobs.length < total,
    };
  }

  @Query(() => Job, { name: 'job', nullable: true })
  async findOne(@Args('id', { type: () => Int }) id: number): Promise<Job | null> {
    return this.jobService.findById(id);
  }

  @Query(() => [Job], { name: 'myJobs' })
  @UseGuards(GqlAuthGuard)
  async myJobs(@CurrentUser() user: User): Promise<Job[]> {
    return this.jobService.findByPosterId(user.id);
  }

  @Mutation(() => Job)
  @UseGuards(GqlAuthGuard)
  async createJob(
    @Args('input') createJobInput: CreateJobInput,
    @CurrentUser() user: User,
  ): Promise<Job> {
    const secureInput = {
      ...createJobInput,
      posterId: user.id,
    };
    return this.jobService.create(secureInput);
  }

  @Mutation(() => Job)
  @UseGuards(GqlAuthGuard)
  async updateJobStatus(
    @Args('id', { type: () => Int }) id: number,
    @Args('status') status: string,
    @CurrentUser() user: User,
  ): Promise<Job> {
    return this.jobService.updateStatus(id, status, user.id);
  }
}
