import { Global, Module } from '@nestjs/common';
import { PubSub } from 'mercurius';

export const PUB_SUB = 'PUB_SUB';

// Event types for type safety
export const NOTIFICATION_EVENTS = {
  JOB_CREATED: 'jobCreated',
  JOB_UPDATED: 'jobUpdated',
  JOB_STATUS_CHANGED: 'jobStatusChanged',
  APPLICATION_RECEIVED: 'applicationReceived',
  APPLICATION_STATUS_CHANGED: 'applicationStatusChanged',
  NEW_BOOKMARK: 'newBookmark',
} as const;

@Global()
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useFactory: () => {
        return new PubSub();
      },
    },
  ],
  exports: [PUB_SUB],
})
export class PubSubModule {}
