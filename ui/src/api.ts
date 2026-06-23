import { config } from './config';

export interface QueueSummary {
  name: string;
  counts: Record<string, number>;
  total: number;
  isPaused: boolean;
  group?: string | null;
  description?: string | null;
  readOnly?: boolean;
  danger?: boolean;
  processor?: string | null;
  concurrency?: number | null;
}

export interface QueueTopology {
  processor: string | null;
  concurrency: number | null;
  events: { scope: 'worker' | 'queue'; event: string; handler: string }[];
  meta: { description?: string; group?: string; readOnly?: boolean; danger?: boolean };
  defaultJobOptions?: Record<string, unknown> | null;
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
  dataPreview: string | null;
}

export interface JobDetail extends JobSummary {
  data: unknown;
  opts: unknown;
  returnValue: unknown;
  stacktrace: string[];
  logs: string[];
}

const enc = encodeURIComponent;
const base = () => window.location.origin + config.basePath;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(base() + path, { headers: { accept: 'application/json' }, ...init });
  if (!response.ok) {
    let message = response.statusText;
    try {
      message = (await response.json()).message ?? message;
    } catch {
      /* keep statusText */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listQueues: () => request<QueueSummary[]>('/api/queues'),
  getQueue: (name: string) => request<QueueSummary>(`/api/queues/${enc(name)}`),
  topology: (name: string) => request<QueueTopology>(`/api/queues/${enc(name)}/topology`),
  listJobs: (name: string, status: string, page: number, pageSize: number) =>
    request<JobSummary[]>(
      `/api/queues/${enc(name)}/jobs?status=${enc(status)}&page=${page}&pageSize=${pageSize}`,
    ),
  getJob: (name: string, id: string) =>
    request<JobDetail>(`/api/queues/${enc(name)}/jobs/${enc(id)}`),
  retry: (name: string, id: string) =>
    request(`/api/queues/${enc(name)}/jobs/${enc(id)}/retry`, { method: 'POST' }),
  promote: (name: string, id: string) =>
    request(`/api/queues/${enc(name)}/jobs/${enc(id)}/promote`, { method: 'POST' }),
  remove: (name: string, id: string) =>
    request(`/api/queues/${enc(name)}/jobs/${enc(id)}`, { method: 'DELETE' }),
  pause: (name: string) => request(`/api/queues/${enc(name)}/pause`, { method: 'POST' }),
  resume: (name: string) => request(`/api/queues/${enc(name)}/resume`, { method: 'POST' }),
  clean: (name: string, status: string) =>
    request(`/api/queues/${enc(name)}/clean`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, grace: 0, limit: 1000 }),
    }),
  addJob: (name: string, payload: { name?: string; data?: unknown; opts?: Record<string, unknown> }) =>
    request<{ ok: boolean; id: string | null }>(`/api/queues/${enc(name)}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  exportJobs: (name: string, status: string, limit = 1000) =>
    request<{ count: number; capped: boolean; jobs: Record<string, unknown>[] }>(
      `/api/queues/${enc(name)}/export?status=${enc(status)}&limit=${limit}`,
    ),
  bulk: (name: string, action: 'retry' | 'promote', status: string) =>
    request<{ ok: boolean; processed: number; capped: boolean }>(`/api/queues/${enc(name)}/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, status }),
    }),
};

/** Opens the live SSE stream of queue summaries. Returns the EventSource (or null if unsupported). */
export function openQueueStream(
  onData: (queues: QueueSummary[]) => void,
  onError: () => void,
): EventSource | null {
  if (typeof EventSource === 'undefined') {
    onError();
    return null;
  }
  try {
    const source = new EventSource(base() + '/api/stream', { withCredentials: true });
    source.onmessage = (event) => {
      try {
        onData(JSON.parse(event.data));
      } catch {
        /* ignore malformed frame */
      }
    };
    source.onerror = () => onError();
    return source;
  } catch {
    onError();
    return null;
  }
}
