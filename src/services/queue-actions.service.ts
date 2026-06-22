import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job, JobType, Queue } from 'bullmq';
import { JOB_STATUSES, JobStatus } from '../constants';
import type { JobDetail, JobSummary, QueueSummary } from '../interfaces/dto.interface';
import { QueueDiscoveryService } from './queue-discovery.service';

@Injectable()
export class QueueActionsService {
  constructor(private readonly discovery: QueueDiscoveryService) {}

  async listQueues(): Promise<QueueSummary[]> {
    return Promise.all(this.discovery.getQueues().map((queue) => this.summarize(queue)));
  }

  async getQueueSummary(name: string): Promise<QueueSummary> {
    return this.summarize(this.requireQueue(name));
  }

  async listJobs(name: string, status: JobStatus, start: number, end: number): Promise<JobSummary[]> {
    const jobs = await this.requireQueue(name).getJobs([status as JobType], start, end, false);
    return jobs.filter((job): job is Job => Boolean(job)).map((job) => this.toSummary(job, status));
  }

  async getJob(name: string, id: string): Promise<JobDetail> {
    const queue = this.requireQueue(name);
    const job = (await queue.getJob(id)) as Job | undefined;
    if (!job) {
      throw new NotFoundException(`Job "${id}" not found in queue "${name}"`);
    }
    const [state, logs] = await Promise.all([
      job.getState().catch(() => 'unknown'),
      queue.getJobLogs(id).then((r) => r.logs).catch(() => [] as string[]),
    ]);
    return {
      ...this.toSummary(job, state),
      data: job.data ?? null,
      opts: job.opts ?? null,
      returnValue: job.returnvalue ?? null,
      stacktrace: job.stacktrace ?? [],
      logs,
    };
  }

  async retryJob(name: string, id: string): Promise<void> {
    await (await this.requireJob(name, id)).retry();
  }

  async promoteJob(name: string, id: string): Promise<void> {
    await (await this.requireJob(name, id)).promote();
  }

  async removeJob(name: string, id: string): Promise<void> {
    await (await this.requireJob(name, id)).remove();
  }

  async pauseQueue(name: string): Promise<void> {
    await this.requireQueue(name).pause();
  }

  async resumeQueue(name: string): Promise<void> {
    await this.requireQueue(name).resume();
  }

  async cleanQueue(name: string, status: JobStatus, grace: number, limit: number): Promise<number> {
    const removed = await this.requireQueue(name).clean(
      grace,
      limit,
      status as Parameters<Queue['clean']>[2],
    );
    return removed.length;
  }

  private async summarize(queue: Queue): Promise<QueueSummary> {
    const [counts, isPaused] = await Promise.all([
      queue.getJobCounts(...([...JOB_STATUSES] as JobType[])),
      queue.isPaused(),
    ]);
    const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
    return { name: queue.name, counts, total, isPaused };
  }

  private toSummary(job: Job, state: string): JobSummary {
    return {
      id: job.id ?? null,
      name: job.name,
      state,
      progress: (job.progress as number | object | null) ?? null,
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp ?? null,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      delay: job.delay ?? null,
      failedReason: job.failedReason ?? null,
    };
  }

  private requireQueue(name: string): Queue {
    const queue = this.discovery.getQueue(name);
    if (!queue) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }
    return queue;
  }

  private async requireJob(name: string, id: string): Promise<Job> {
    const job = (await this.requireQueue(name).getJob(id)) as Job | undefined;
    if (!job) {
      throw new NotFoundException(`Job "${id}" not found in queue "${name}"`);
    }
    return job;
  }
}
