import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Job } from '../job/job.entity';

@ObjectType()
export class Bookmark {
  @Field(() => Int)
  id!: number;

  @Field()
  userId!: string;

  @Field(() => Int)
  jobId!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Job)
  job!: Job;
}

@ObjectType()
export class BookmarkResult {
  @Field()
  success!: boolean;

  @Field()
  isBookmarked!: boolean;
}
