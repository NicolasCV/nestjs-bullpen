export const BULLPEN_OPTIONS = 'BULLPEN_OPTIONS';

export const DEFAULT_ROUTE = '/bullpen';
export const DEFAULT_TITLE = 'Bullpen';

export enum JobState {
  Active = 'active',
  Waiting = 'waiting',
  Prioritized = 'prioritized',
  Delayed = 'delayed',
  Completed = 'completed',
  Failed = 'failed',
  Paused = 'paused',
}

export enum BullpenAuthType {
  None = 'none',
  Basic = 'basic',
  Guard = 'guard',
  Custom = 'custom',
}

export const JOB_STATUSES = [
  'active',
  'waiting',
  'prioritized',
  'delayed',
  'completed',
  'failed',
  'paused',
] as const;

/** A job state, accepted as the `JobState` enum or its raw string value. */
export type JobStatus = JobState | `${JobState}`;

/** Hard caps for bulk/export operations — keeps Bullpen responsive against very large queues. */
export const EXPORT_CAP = 1000;
export const BULK_CAP = 1000;

/** Metadata key Bullpen sets on the dashboard controller so reflector-based guards can read roles. */
export const BULLPEN_ROLES_KEY = 'bullpen:roles';

/** Metadata key written by the `@BullpenQueue()` decorator. */
export const BULLPEN_QUEUE_METADATA = 'bullpen:queue';

// Metadata keys that @nestjs/bullmq stamps on processor classes/methods. Mirrored here so we
// don't depend on its internal (unexported) constants; stable across @nestjs/bullmq 10 & 11.
export const BULLMQ_PROCESSOR_METADATA = 'bullmq:processor_metadata';
export const BULLMQ_WORKER_METADATA = 'bullmq:worker_metadata';
export const BULLMQ_ON_WORKER_EVENT_METADATA = 'bullmq:worker_events_metadata';
export const BULLMQ_ON_QUEUE_EVENT_METADATA = 'bullmq:queue_events_metadata';
