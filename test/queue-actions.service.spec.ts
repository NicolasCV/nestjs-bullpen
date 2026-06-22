import { NotFoundException } from '@nestjs/common';
import { QueueActionsService } from '../src/services/queue-actions.service';

function fakeJob(overrides: Record<string, any> = {}) {
  return {
    id: '1',
    name: 'send',
    data: { to: 'a@b.c' },
    opts: { attempts: 3 },
    returnvalue: null,
    stacktrace: ['at x'],
    progress: 0,
    attemptsMade: 1,
    timestamp: 1000,
    processedOn: 1100,
    finishedOn: 1200,
    delay: 0,
    failedReason: 'boom',
    getState: jest.fn().mockResolvedValue('failed'),
    retry: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    promote: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fakeQueue() {
  return {
    name: 'emails',
    getJobCounts: jest.fn().mockResolvedValue({ active: 1, waiting: 2, completed: 3 }),
    isPaused: jest.fn().mockResolvedValue(false),
    getJobs: jest.fn().mockResolvedValue([fakeJob()]),
    getJob: jest.fn().mockResolvedValue(fakeJob()),
    getJobLogs: jest.fn().mockResolvedValue({ logs: ['log line'], count: 1 }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue(['a', 'b']),
  };
}

function makeService(queue = fakeQueue()) {
  const discovery = {
    getQueues: () => [queue],
    getQueue: (name: string) => (name === 'emails' ? queue : undefined),
  } as any;
  return { service: new QueueActionsService(discovery), queue };
}

describe('QueueActionsService', () => {
  it('summarizes queues with total + paused state', async () => {
    const { service } = makeService();
    const [summary] = await service.listQueues();
    expect(summary.name).toBe('emails');
    expect(summary.counts).toEqual({ active: 1, waiting: 2, completed: 3 });
    expect(summary.total).toBe(6);
    expect(summary.isPaused).toBe(false);
  });

  it('maps jobs to summaries using the requested status as state', async () => {
    const { service } = makeService();
    const [job] = await service.listJobs('emails', 'failed', 0, 10);
    expect(job.id).toBe('1');
    expect(job.state).toBe('failed');
    expect(job.failedReason).toBe('boom');
  });

  it('returns full detail including logs and stacktrace', async () => {
    const { service } = makeService();
    const detail = await service.getJob('emails', '1');
    expect(detail.state).toBe('failed');
    expect(detail.data).toEqual({ to: 'a@b.c' });
    expect(detail.logs).toEqual(['log line']);
    expect(detail.stacktrace).toEqual(['at x']);
  });

  it('throws NotFound for missing queue and job', async () => {
    const { service, queue } = makeService();
    await expect(service.getQueueSummary('ghost')).rejects.toBeInstanceOf(NotFoundException);
    queue.getJob.mockResolvedValueOnce(undefined);
    await expect(service.getJob('emails', '999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates mutations to BullMQ', async () => {
    const { service, queue } = makeService();
    const job = await queue.getJob();
    await service.retryJob('emails', '1');
    await service.promoteJob('emails', '1');
    await service.removeJob('emails', '1');
    expect(job.retry).toHaveBeenCalled();
    expect(job.promote).toHaveBeenCalled();
    expect(job.remove).toHaveBeenCalled();

    await service.pauseQueue('emails');
    await service.resumeQueue('emails');
    expect(queue.pause).toHaveBeenCalled();
    expect(queue.resume).toHaveBeenCalled();

    const removed = await service.cleanQueue('emails', 'completed', 0, 1000);
    expect(removed).toBe(2);
    expect(queue.clean).toHaveBeenCalledWith(0, 1000, 'completed');
  });
});
