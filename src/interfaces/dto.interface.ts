export interface QueueSummary {
  name: string;
  counts: Record<string, number>;
  total: number;
  isPaused: boolean;
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
