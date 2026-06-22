export const BULLPEN_OPTIONS = 'BULLPEN_OPTIONS';

export const DEFAULT_ROUTE = '/bullpen';
export const DEFAULT_TITLE = 'Bullpen';

export const JOB_STATUSES = [
  'active',
  'waiting',
  'prioritized',
  'delayed',
  'completed',
  'failed',
  'paused',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
