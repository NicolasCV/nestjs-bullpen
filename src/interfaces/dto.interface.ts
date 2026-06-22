import type { BullpenQueueOptions } from './bullpen-options.interface';

export interface QueueSummary {
  name: string;
  counts: Record<string, number>;
  total: number;
  isPaused: boolean;
  /** v0.2 presentation enrichment (from `@BullpenQueue` / `queues` option). */
  group?: string | null;
  description?: string | null;
  readOnly?: boolean;
  danger?: boolean;
  /** v0.2 NestJS topology. */
  processor?: string | null;
  concurrency?: number | null;
}

export interface QueueTopology {
  processor: string | null;
  concurrency: number | null;
  events: { scope: 'worker' | 'queue'; event: string; handler: string }[];
  meta: BullpenQueueOptions;
}

export interface JobSummary {
  id: string | null;
  name: string;
  state: string;
  progress: number | object | null;
  attemptsMade: number;
  timestamp: number | null;
  processedOn: number | null;
  finishedOn: number | null;
  delay: number | null;
  failedReason: string | null;
}

export interface JobDetail extends JobSummary {
  data: unknown;
  opts: unknown;
  returnValue: unknown;
  stacktrace: string[];
  logs: string[];
}

export interface DashboardMeta {
  title: string;
  theme: 'dark' | 'light';
  readOnly: boolean;
  basePath: string;
  queues: string[];
  statuses: readonly string[];
}
