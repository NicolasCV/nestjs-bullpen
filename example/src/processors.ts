import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Processor('emails', { concurrency: 5 })
export class EmailsProcessor extends WorkerHost {
  async process(job: Job): Promise<unknown> {
    await sleep(300);
    if (job.data?.fail) {
      throw new Error(`SMTP rejected recipient ${job.data?.to ?? 'unknown'}`);
    }
    return { sent: true, to: job.data?.to };
  }
}

@Processor('media', { concurrency: 1 })
export class MediaProcessor extends WorkerHost {
  async process(): Promise<unknown> {
    // Deliberately long-running so a job sits in the "active" state while you view the dashboard.
    await sleep(120_000);
    return { transcoded: true };
  }
}
