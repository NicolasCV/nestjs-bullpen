import { Injectable, NotFoundException } from '@nestjs/common';
import type { Job, JobType, Queue } from 'bullmq';
import { BULK_CAP, EXPORT_CAP, JOB_STATUSES, JobStatus } from '../constants';
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
    const jobs = await this.requireQueue(name).getJobs([String(status) as JobType], start, end, false);
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
      String(status) as Parameters<Queue['clean']>[2],
    );
    return removed.length;
  }

  /** Make: enqueue a new job. */
  async addJob(
    name: string,
    jobName: string,
    data: unknown,
    opts?: Record<string, unknown>,
  ): Promise<{ id: string | null; name: string }> {
    const job = await this.requireQueue(name).add(jobName || 'job', data ?? {}, opts as never);
    return { id: job.id ?? null, name: job.name };
  }

  /** Extract: dump up to EXPORT_CAP jobs of a state (with payloads). Reports when capped. */
  async exportJobs(
    name: string,
    status: JobStatus,
    limit: number,
  ): Promise<{ count: number; capped: boolean; jobs: Record<string, unknown>[] }> {
    const cap = Math.min(Math.max(1, limit), EXPORT_CAP);
    const jobs = await this.fetchBatch(name, status, cap);
    const mapped = jobs.map((job) => ({
      id: job.id ?? null,
      name: job.name,
      state: String(status),
      data: job.data ?? null,
      opts: job.opts ?? null,
      returnValue: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp ?? null,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
    }));
    return { count: mapped.length, capped: mapped.length >= cap, jobs: mapped };
  }

  /** Manage at scale: retry/promote a whole state in one batch (capped, reports truncation). */
  async bulkAction(
    name: string,
    action: 'retry' | 'promote',
    status: JobStatus,
    limit: number,
  ): Promise<{ processed: number; capped: boolean }> {
    const cap = Math.min(Math.max(1, limit), BULK_CAP);
    const jobs = await this.fetchBatch(name, status, cap);
    let processed = 0;
    for (const job of jobs) {
      try {
        if (action === 'promote') await job.promote();
        else await job.retry();
        processed += 1;
      } catch {
        /* skip jobs that changed state mid-batch */
      }
    }
    return { processed, capped: jobs.length >= cap };
  }

  private async fetchBatch(name: string, status: JobStatus, cap: number): Promise<Job[]> {
    const jobs = await this.requireQueue(name).getJobs([String(status) as JobType], 0, cap - 1, false);
    return jobs.filter((job): job is Job => Boolean(job));
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
