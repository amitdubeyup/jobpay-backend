import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from '../users/user.entity';
import { Job } from '../job/job.entity';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  SHORTLISTED = 'SHORTLISTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

registerEnumType(ApplicationStatus, {
  name: 'ApplicationStatus',
  description: 'Status of a job application',
});

@ObjectType()
export class Application {
  @Field(() => Int)
  id!: number;

  @Field(() => String, { nullable: true })
  coverLetter?: string | null;

  @Field(() => String, { nullable: true })
  resumeUrl?: string | null;

  @Field(() => ApplicationStatus)
  status!: ApplicationStatus;

  @Field(() => Date)
  appliedAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  reviewedAt?: Date | null;

  @Field()
  applicantId!: string;

  @Field(() => Int)
  jobId!: number;

  @Field(() => User)
  applicant!: User;

  @Field(() => Job)
  job!: Job;
}

@ObjectType()
export class ApplicationListResult {
  @Field(() => [Application])
  applications!: Application[];

  @Field(() => Int)
  total!: number;
}
