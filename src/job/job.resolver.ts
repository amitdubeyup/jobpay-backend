import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JobService } from './job.service';
import { Job } from './job.entity';
import { CreateJobInput } from './dto/create-job.input';

@Resolver(() => Job)
export class JobResolver {
  constructor(private readonly jobService: JobService) {}

  @Query(() => [Job], { name: 'jobs' })
  async findAll(): Promise<Job[]> {
    return this.jobService.findAll();
  }

  @Mutation(() => Job)
  async createJob(@Args('input') createJobInput: CreateJobInput): Promise<Job> {
    return this.jobService.create(createJobInput);
  }
}
