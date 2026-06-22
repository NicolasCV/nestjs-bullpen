import { config } from './config';

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

const enc = encodeURIComponent;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Build an absolute, credential-free same-origin URL. A relative fetch would inherit any
  // userinfo present in the document URL, which browsers reject.
  const url = window.location.origin + config.basePath + path;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.message ?? message;
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
};
