export const STATE_COLORS: Record<string, string> = {
  active: '#3b82f6',
  waiting: '#94a3b8',
  prioritized: '#a855f7',
  delayed: '#f59e0b',
  completed: '#22c55e',
  failed: '#ef4444',
  paused: '#64748b',
  'waiting-children': '#64748b',
  unknown: '#64748b',
};

export function stateColor(state: string): string {
  return STATE_COLORS[state] ?? '#64748b';
}

export function relTime(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const s = Math.round(abs / 1000);
  if (s < 60) return future ? `in ${s}s` : `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return future ? `in ${m}m` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return future ? `in ${h}h` : `${h}h ago`;
  const d = Math.round(h / 24);
  return future ? `in ${d}d` : `${d}d ago`;
}

export function duration(from: number | null, to: number | null): string {
  if (!from || !to || to < from) return '—';
  const ms = to - from;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function pretty(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
