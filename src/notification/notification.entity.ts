import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
  JOB_CREATED = 'JOB_CREATED',
  JOB_UPDATED = 'JOB_UPDATED',
  JOB_STATUS_CHANGED = 'JOB_STATUS_CHANGED',
  APPLICATION_RECEIVED = 'APPLICATION_RECEIVED',
  APPLICATION_STATUS_CHANGED = 'APPLICATION_STATUS_CHANGED',
  JOB_BOOKMARKED = 'JOB_BOOKMARKED',
}

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Types of real-time notifications',
});

@ObjectType()
export class JobNotification {
  @Field(() => NotificationType)
  type!: NotificationType;

  @Field(() => Int)
  jobId!: number;

  @Field()
  jobTitle!: string;

  @Field({ nullable: true })
  message?: string;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  userId?: string; // Who triggered the notification
}

@ObjectType()
export class ApplicationNotification {
  @Field(() => NotificationType)
  type!: NotificationType;

  @Field(() => Int)
  applicationId!: number;

  @Field(() => Int)
  jobId!: number;

  @Field()
  jobTitle!: string;

  @Field()
  applicantId!: string;

  @Field({ nullable: true })
  applicantName?: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  message?: string;

  @Field()
  timestamp!: Date;
}
