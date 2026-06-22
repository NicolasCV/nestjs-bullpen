import { Queue } from 'bullmq';
import { connection } from './redis';

async function main() {
  const emails = new Queue('emails', { connection });
  const media = new Queue('media', { connection });
  const reports = new Queue('reports', { connection });

  // emails has a worker → produces completed + failed jobs.
  for (let i = 0; i < 12; i++) {
    await emails.add('send-welcome', { to: `user${i}@acme.test`, fail: i % 3 === 0 });
  }

  // media worker is slow (concurrency 1) → 1 active, the rest queued; we pause it below.
  for (let i = 0; i < 3; i++) {
    await media.add('transcode', { file: `clip-${i}.mov` });
  }

  // reports has no worker → jobs stay waiting / delayed / prioritized.
  for (let i = 0; i < 6; i++) await reports.add('daily', { day: i });
  for (let i = 0; i < 4; i++) await reports.add('scheduled', { day: i }, { delay: 3_600_000 });
  for (let i = 0; i < 3; i++) await reports.add('urgent', { day: i }, { priority: i + 1 });

  // Give the media worker a moment to pick up one job, then pause to show the paused state.
  await new Promise((r) => setTimeout(r, 800));
  await media.pause();

  console.log('Seeded: emails(12, ~8 completed / ~4 failed), media(3, paused), reports(13).');
  await Promise.all([emails.close(), media.close(), reports.close()]);
  process.exit(0);
}

void main();
