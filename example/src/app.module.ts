import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullpenModule } from 'nestjs-bullpen';
import { EmailsProcessor, MediaProcessor } from './processors';
import { connection } from './redis';

@Module({
  imports: [
    BullModule.forRoot({ connection }),
    BullModule.registerQueue({ name: 'emails' }, { name: 'media' }, { name: 'reports' }),

    // The whole dashboard — one line. Auto-discovers every queue above.
    BullpenModule.forRoot({
      route: '/admin/queues',
      title: 'Bullpen Demo',
      theme: 'dark',
      auth: { type: 'basic', credentials: { username: 'admin', password: 'admin' } },
    }),
  ],
  providers: [EmailsProcessor, MediaProcessor],
})
export class AppModule {}
