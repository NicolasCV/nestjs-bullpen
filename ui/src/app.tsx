import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { api, JobDetail, JobSummary, openQueueStream, QueueSummary, QueueTopology } from './api';
import {
  AddJobModal,
  Badge,
  Chips,
  JobDrawer,
  JobsTable,
  QueueActionsBar,
  Sidebar,
  Toolbar,
  WorkerPanel,
} from './components';
import { config } from './config';
import { BullLogo, IconBolt, IconMoon, IconSun } from './icons';

const PAGE_SIZE = 25;
type MutationAction = 'retry' | 'promote' | 'remove';
type LiveMode = 'sse' | 'poll' | 'off';

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(0);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [topology, setTopology] = useState<QueueTopology | null>(null);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('bullpen-theme') as 'dark' | 'light') ?? config.theme,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [live, setLive] = useState(true);
  const [liveMode, setLiveMode] = useState<LiveMode>('off');
  const [showAdd, setShowAdd] = useState(false);

  const current = useMemo(
    () => queues.find((q) => q.name === selected) ?? null,
    [queues, selected],
  );
  const effectiveReadOnly = config.readOnly || Boolean(current?.readOnly);

  const groups = useMemo(() => {
    const map = new Map<string, QueueSummary[]>();
    for (const queue of queues) {
      const key = queue.group || 'Queues';
      const bucket = map.get(key);
      if (bucket) bucket.push(queue);
      else map.set(key, [queue]);
    }
    return [...map.entries()].map(([group, items]) => ({ group, items }));
  }, [queues]);

  const refreshQueues = useCallback(async () => {
    try {
      const next = await api.listQueues();
      setQueues(next);
      setSelected((prev) => prev ?? next[0]?.name ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshJobs = useCallback(async (name: string, st: string, pg: number) => {
    setLoadingJobs(true);
    try {
      setJobs(await api.listJobs(name, st, pg, PAGE_SIZE));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueues();
  }, [refreshQueues]);

  useEffect(() => {
    if (selected) void refreshJobs(selected, status, page);
  }, [selected, status, page, refreshJobs]);

  useEffect(() => {
    if (!selected) {
      setTopology(null);
      return;
    }
    api.topology(selected).then(setTopology).catch(() => setTopology(null));
  }, [selected]);

  // Live updates: prefer SSE, fall back to polling. A short timer keeps the open job list fresh.
  useEffect(() => {
    if (!live) {
      setLiveMode('off');
      return;
    }
    let source: EventSource | null = null;
    let queuePoll: number | null = null;
    let cancelled = false;

    const fallbackToPolling = () => {
      if (queuePoll != null) return;
      setLiveMode('poll');
      void refreshQueues();
      queuePoll = window.setInterval(() => void refreshQueues(), 4000);
    };

    source = openQueueStream(
      (next) => {
        if (cancelled) return;
        setQueues(next);
        setSelected((prev) => prev ?? next[0]?.name ?? null);
        setLiveMode('sse');
      },
      () => {
        if (source) {
          source.close();
          source = null;
        }
        fallbackToPolling();
      },
    );
    if (!source) fallbackToPolling();

    const jobsTimer = window.setInterval(() => {
      if (selected) void refreshJobs(selected, status, page);
    }, 5000);

    return () => {
      cancelled = true;
      if (source) source.close();
      if (queuePoll != null) window.clearInterval(queuePoll);
      window.clearInterval(jobsTimer);
    };
  }, [live, selected, status, page, refreshQueues, refreshJobs]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bullpen-theme', theme);
  }, [theme]);

  const runMutation = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
    await refreshQueues();
    if (selected) await refreshJobs(selected, status, page);
  };

  const callJobAction = (name: string, action: MutationAction, id: string) =>
    (api[action] as (n: string, jobId: string) => Promise<unknown>)(name, id);

  const handleRowAction = (action: MutationAction, job: JobSummary) => {
    if (!selected || !job.id) return;
    if (action === 'remove' && !window.confirm(`Remove job #${job.id}?`)) return;
    void runMutation(() => callJobAction(selected, action, job.id as string));
  };

  const openJob = async (job: JobSummary) => {
    if (!selected || !job.id) return;
    try {
      setDetail(await api.getJob(selected, job.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const drawerAction = async (action: MutationAction) => {
    if (!selected || !detail?.id) return;
    if (action === 'remove' && !window.confirm(`Remove job #${detail.id}?`)) return;
    await runMutation(() => callJobAction(selected, action, detail.id as string));
    setDetail(null);
  };

  const pauseToggle = () => {
    if (!current) return;
    void runMutation(() =>
      current.isPaused ? api.resume(current.name) : api.pause(current.name),
    );
  };

  const cleanQueue = () => {
    if (!current) return;
    if (!window.confirm(`Clean all "${status}" jobs from "${current.name}"?`)) return;
    void runMutation(() => api.clean(current.name, status));
  };

  const findById = async (id: string) => {
    if (!selected) return;
    try {
      setDetail(await api.getJob(selected, id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const exportJobs = async () => {
    if (!selected) return;
    try {
      const result = await api.exportJobs(selected, status);
      downloadJson(`${selected}-${status}.json`, result.jobs);
      if (result.capped) setError(`Export reached the ${result.count}-job cap — narrow the state or raise the cap.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const bulk = (action: 'retry' | 'promote') => {
    if (!current) return;
    const verb = action === 'retry' ? 'Retry' : 'Promote';
    if (!window.confirm(`${verb} all "${status}" jobs in "${current.name}"?`)) return;
    void runMutation(async () => {
      const result = await api.bulk(current.name, action, status);
      if (result.capped) {
        setError(`${verb}d ${result.processed} jobs (cap reached — run again for the rest).`);
      }
    });
  };

  const addJob = (payload: { name: string; data: unknown; opts?: Record<string, unknown> }) => {
    if (!selected) return;
    void runMutation(() => api.addJob(selected, payload)).then(() => setShowAdd(false));
  };

  const liveLabel = liveMode === 'sse' ? 'live' : liveMode === 'poll' ? 'polling' : 'paused';
  const liveColor =
    liveMode === 'sse' ? 'var(--accent)' : liveMode === 'poll' ? '#f59e0b' : 'var(--text-faint)';

  return (
    <div class="bp-app">
      <header class="bp-topbar">
        <div class="bp-brand">
          <BullLogo class="bp-logo" size={26} />
          {config.title}
          <small>BullMQ</small>
        </div>
        <div class="bp-topbar-actions">
          <button
            class="bp-live"
            title={live ? 'Live updates on' : 'Live updates off'}
            style={{ color: liveColor }}
            onClick={() => setLive((v) => !v)}
          >
            <IconBolt size={14} />
            {liveLabel}
          </button>
          <button
            class="bp-icon-btn"
            title="Toggle theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </button>
        </div>
      </header>

      {error ? <div class="bp-banner">{error}</div> : null}

      <div class="bp-body">
        <Sidebar
          groups={groups}
          queueCount={queues.length}
          selected={selected}
          onSelect={(n) => (setSelected(n), setPage(0))}
        />

        <main class="bp-main">
          {current ? (
            <>
              <div class="bp-toolbar">
                <div class="bp-main-title">
                  {current.name}
                  {current.isPaused ? <Badge state="paused" /> : null}
                </div>
                <QueueActionsBar
                  queue={current}
                  readOnly={effectiveReadOnly}
                  busy={busy}
                  onPauseToggle={pauseToggle}
                  onClean={cleanQueue}
                />
              </div>

              {current.description ? <div class="bp-desc">{current.description}</div> : null}
              <WorkerPanel topology={topology} />

              <Toolbar
                status={status}
                readOnly={effectiveReadOnly}
                busy={busy}
                onFind={findById}
                onAdd={() => setShowAdd(true)}
                onExport={exportJobs}
                onBulk={bulk}
              />

              <Chips
                statuses={config.statuses}
                counts={current.counts}
                active={status}
                onSelect={(s) => (setStatus(s), setPage(0))}
              />

              <div class="bp-scroll">
                {loadingJobs && jobs.length === 0 ? (
                  <div class="bp-loading">Loading…</div>
                ) : jobs.length === 0 ? (
                  <div class="bp-empty">No {status} jobs</div>
                ) : (
                  <JobsTable
                    jobs={jobs}
                    readOnly={effectiveReadOnly}
                    onOpen={openJob}
                    onAction={handleRowAction}
                  />
                )}
              </div>

              <div class="bp-pager">
                <span>Page {page + 1}</span>
                <button
                  class="bp-icon-btn"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  ‹
                </button>
                <button
                  class="bp-icon-btn"
                  disabled={jobs.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            </>
          ) : (
            <div class="bp-empty">
              <BullLogo size={42} />
              <div>No queues discovered</div>
              <div class="bp-dim">Register a queue with @nestjs/bullmq and refresh.</div>
            </div>
          )}
        </main>
      </div>

      {detail ? (
        <JobDrawer
          job={detail}
          readOnly={effectiveReadOnly}
          busy={busy}
          onClose={() => setDetail(null)}
          onAction={drawerAction}
        />
      ) : null}

      {showAdd && current ? (
        <AddJobModal
          queue={current.name}
          busy={busy}
          onClose={() => setShowAdd(false)}
          onSubmit={addJob}
        />
      ) : null}
    </div>
  );
}
