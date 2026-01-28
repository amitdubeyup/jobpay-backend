import { Inject } from '@nestjs/common';
import { Args, Int, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'mercurius';
import { PUB_SUB, NOTIFICATION_EVENTS } from '../pubsub/pubsub.module';
import { JobNotification, ApplicationNotification } from './notification.entity';

@Resolver()
export class NotificationResolver {
  constructor(@Inject(PUB_SUB) private pubSub: PubSub) {}

  // Subscribe to all job updates (for job seekers browsing)
  @Subscription(() => JobNotification, {
    name: 'jobUpdates',
    description: 'Subscribe to all job creation and updates',
  })
  jobUpdates() {
    return this.pubSub.subscribe([
      NOTIFICATION_EVENTS.JOB_CREATED,
      NOTIFICATION_EVENTS.JOB_UPDATED,
      NOTIFICATION_EVENTS.JOB_STATUS_CHANGED,
    ]);
  }

  // Subscribe to updates for a specific job
  @Subscription(() => JobNotification, {
    name: 'jobUpdate',
    description: 'Subscribe to updates for a specific job',
    filter: (payload, variables) => {
      return payload.jobUpdate.jobId === variables.jobId;
    },
  })
  jobUpdate(@Args('jobId', { type: () => Int }) jobId: number) {
    return this.pubSub.subscribe([
      NOTIFICATION_EVENTS.JOB_UPDATED,
      NOTIFICATION_EVENTS.JOB_STATUS_CHANGED,
    ]);
  }

  // Subscribe to applications for jobs I posted (for employers)
  @Subscription(() => ApplicationNotification, {
    name: 'myJobApplications',
    description: 'Subscribe to new applications on my jobs',
    filter: (payload, variables, context) => {
      // Only notify the job poster
      return payload.myJobApplications.posterId === context.user?.id;
    },
  })
  myJobApplications() {
    return this.pubSub.subscribe(NOTIFICATION_EVENTS.APPLICATION_RECEIVED);
  }

  // Subscribe to my application status changes (for applicants)
  @Subscription(() => ApplicationNotification, {
    name: 'myApplicationUpdates',
    description: 'Subscribe to status updates on my applications',
    filter: (payload, variables, context) => {
      // Only notify the applicant
      return payload.myApplicationUpdates.applicantId === context.user?.id;
    },
  })
  myApplicationUpdates() {
    return this.pubSub.subscribe(NOTIFICATION_EVENTS.APPLICATION_STATUS_CHANGED);
  }

  // Subscribe to application updates for a specific job (for employers)
  @Subscription(() => ApplicationNotification, {
    name: 'jobApplicationUpdates',
    description: 'Subscribe to all application activity for a specific job',
    filter: (payload, variables) => {
      return payload.jobApplicationUpdates.jobId === variables.jobId;
    },
  })
  jobApplicationUpdates(@Args('jobId', { type: () => Int }) jobId: number) {
    return this.pubSub.subscribe([
      NOTIFICATION_EVENTS.APPLICATION_RECEIVED,
      NOTIFICATION_EVENTS.APPLICATION_STATUS_CHANGED,
    ]);
  }
}
