import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullpenModule } from 'nestjs-bullpen';
import { EmailsProcessor, MediaProcessor } from './processors';
import { connection } from './redis';

@Module({
  imports: [
    BullModule.forRoot({ connection }),
    BullModule.registerQueue(
      {
        name: 'emails',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86_400 },
        },
      },
      { name: 'media' },
      { name: 'reports' },
    ),

    // The whole dashboard — one line. Auto-discovers every queue, reads @BullpenQueue metadata,
    // and maps each queue to its NestJS processor + worker events.
    BullpenModule.forRoot({
      route: '/admin/queues',
      title: 'Bullpen Demo',
      theme: 'dark',
      auth: { type: 'basic', credentials: { username: 'admin', password: 'admin' } },
      // Writes are off by default; opt in to enable retry/remove/add/etc. ('reports' stays read-only below).
      // Toggle with BULLPEN_WRITABLE=false to see the read-only dashboard.
      writable: process.env.BULLPEN_WRITABLE !== 'false',
      // Default options Bullpen applies to jobs added from the dashboard (per-queue can override).
      defaultJobOptions: { removeOnComplete: { count: 500 } },
      // 'reports' has no processor class, so enrich it here instead of with @BullpenQueue.
      queues: {
        reports: { description: 'Scheduled analytics reports', group: 'Analytics', readOnly: true },
      },
    }),
  ],
  providers: [EmailsProcessor, MediaProcessor],
})
export class AppModule {}
