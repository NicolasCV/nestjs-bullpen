import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { api, JobDetail, JobSummary, QueueSummary } from './api';
import { Badge, Chips, JobDrawer, JobsTable, QueueActionsBar, Sidebar } from './components';
import { config } from './config';
import { BullLogo, IconMoon, IconRefresh, IconSun } from './icons';

const PAGE_SIZE = 25;
type MutationAction = 'retry' | 'promote' | 'remove';

export function App() {
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(0);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('bullpen-theme') as 'dark' | 'light') ?? config.theme,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const current = useMemo(
    () => queues.find((q) => q.name === selected) ?? null,
    [queues, selected],
  );

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
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void refreshQueues();
      if (selected) void refreshJobs(selected, status, page);
    }, 4000);
    return () => window.clearInterval(id);
  }, [autoRefresh, selected, status, page, refreshQueues, refreshJobs]);

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
            class="bp-icon-btn"
            title={autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
            style={{ color: autoRefresh ? 'var(--accent)' : undefined }}
            onClick={() => setAutoRefresh((a) => !a)}
          >
            <IconRefresh size={18} class={autoRefresh ? 'bp-spin' : undefined} />
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
        <Sidebar queues={queues} selected={selected} onSelect={(n) => (setSelected(n), setPage(0))} />

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
                  readOnly={config.readOnly}
                  busy={busy}
                  onPauseToggle={pauseToggle}
                  onClean={cleanQueue}
                />
              </div>

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
                    readOnly={config.readOnly}
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
          readOnly={config.readOnly}
          busy={busy}
          onClose={() => setDetail(null)}
          onAction={drawerAction}
        />
      ) : null}
    </div>
  );
}
