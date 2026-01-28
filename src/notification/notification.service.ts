import { Inject, Injectable } from '@nestjs/common';
import { PubSub } from 'mercurius';
import { PUB_SUB, NOTIFICATION_EVENTS } from '../pubsub/pubsub.module';
import {
  JobNotification,
  ApplicationNotification,
  NotificationType,
} from './notification.entity';

@Injectable()
export class NotificationService {
  constructor(@Inject(PUB_SUB) private pubSub: PubSub) {}

  async notifyJobCreated(job: {
    id: number;
    title: string;
    posterId: string;
  }): Promise<void> {
    const notification: JobNotification = {
      type: NotificationType.JOB_CREATED,
      jobId: job.id,
      jobTitle: job.title,
      message: `New job posted: ${job.title}`,
      timestamp: new Date(),
      userId: job.posterId,
    };

    await this.pubSub.publish({
      topic: NOTIFICATION_EVENTS.JOB_CREATED,
      payload: { jobUpdates: notification },
    });
  }

  async notifyJobUpdated(job: {
    id: number;
    title: string;
    posterId: string;
  }): Promise<void> {
    const notification: JobNotification = {
      type: NotificationType.JOB_UPDATED,
      jobId: job.id,
      jobTitle: job.title,
      message: `Job updated: ${job.title}`,
      timestamp: new Date(),
      userId: job.posterId,
    };

    await this.pubSub.publish({
      topic: NOTIFICATION_EVENTS.JOB_UPDATED,
      payload: {
        jobUpdates: notification,
        jobUpdate: notification,
      },
    });
  }

  async notifyJobStatusChanged(job: {
    id: number;
    title: string;
    status: string;
    posterId: string;
  }): Promise<void> {
    const notification: JobNotification = {
      type: NotificationType.JOB_STATUS_CHANGED,
      jobId: job.id,
      jobTitle: job.title,
      status: job.status,
      message: `Job "${job.title}" is now ${job.status}`,
      timestamp: new Date(),
      userId: job.posterId,
    };

    await this.pubSub.publish({
      topic: NOTIFICATION_EVENTS.JOB_STATUS_CHANGED,
      payload: {
        jobUpdates: notification,
        jobUpdate: notification,
      },
    });
  }

  async notifyApplicationReceived(application: {
    id: number;
    jobId: number;
    jobTitle: string;
    applicantId: string;
    applicantName?: string;
    posterId: string;
  }): Promise<void> {
    const notification: ApplicationNotification = {
      type: NotificationType.APPLICATION_RECEIVED,
      applicationId: application.id,
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      applicantId: application.applicantId,
      applicantName: application.applicantName,
      status: 'PENDING',
      message: `New application received for "${application.jobTitle}"`,
      timestamp: new Date(),
    };

    // Add posterId for filtering
    const payload = {
      myJobApplications: { ...notification, posterId: application.posterId },
      jobApplicationUpdates: notification,
    };

    await this.pubSub.publish({
      topic: NOTIFICATION_EVENTS.APPLICATION_RECEIVED,
      payload,
    });
  }

  async notifyApplicationStatusChanged(application: {
    id: number;
    jobId: number;
    jobTitle: string;
    applicantId: string;
    applicantName?: string;
    status: string;
    posterId: string;
  }): Promise<void> {
    const notification: ApplicationNotification = {
      type: NotificationType.APPLICATION_STATUS_CHANGED,
      applicationId: application.id,
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      applicantId: application.applicantId,
      applicantName: application.applicantName,
      status: application.status,
      message: `Your application for "${application.jobTitle}" has been ${application.status.toLowerCase()}`,
      timestamp: new Date(),
    };

    // Add fields for filtering
    const payload = {
      myApplicationUpdates: notification,
      jobApplicationUpdates: notification,
    };

    await this.pubSub.publish({
      topic: NOTIFICATION_EVENTS.APPLICATION_STATUS_CHANGED,
      payload,
    });
  }
}
