import { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { JobDetail, JobSummary, QueueSummary, QueueTopology } from './api';
import { duration, pretty, relTime, stateColor } from './format';
import {
  IconBroom,
  IconClose,
  IconCpu,
  IconDownload,
  IconLock,
  IconPause,
  IconPlay,
  IconPlus,
  IconPromote,
  IconRetry,
  IconSearch,
  IconTrash,
  IconWarning,
} from './icons';

export function Badge({ state }: { state: string }): JSX.Element {
  return (
    <span class="bp-badge" style={{ color: stateColor(state) }}>
      <span class="dot" style={{ background: stateColor(state) }} />
      {state}
    </span>
  );
}

function StateBar({ counts }: { counts: Record<string, number> }): JSX.Element {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0) || 1;
  return (
    <div class="bp-queue-bar">
      {entries.map(([state, n]) => (
        <span
          key={state}
          style={{ width: `${(n / total) * 100}%`, background: stateColor(state) }}
          title={`${state}: ${n}`}
        />
      ))}
    </div>
  );
}

function QueueCard({
  queue,
  selected,
  onSelect,
}: {
  queue: QueueSummary;
  selected: string | null;
  onSelect: (name: string) => void;
}): JSX.Element {
  const hasTags = queue.processor || queue.danger || queue.readOnly;
  return (
    <button
      class={`bp-queue${queue.name === selected ? ' active' : ''}`}
      onClick={() => onSelect(queue.name)}
      title={queue.description || undefined}
    >
      <div class="bp-queue-head">
        <span class="bp-queue-name">{queue.name}</span>
        <span class="bp-queue-total">
          {queue.isPaused ? '⏸ ' : ''}
          {queue.total}
        </span>
      </div>
      <StateBar counts={queue.counts} />
      {hasTags ? (
        <div class="bp-queue-tags">
          {queue.processor ? (
            <span
              class="bp-qtag"
              title={`Processor: ${queue.processor}${
                queue.concurrency ? ` · concurrency ${queue.concurrency}` : ''
              }`}
            >
              <IconCpu size={11} />
              {queue.processor}
            </span>
          ) : null}
          {queue.danger ? (
            <span class="bp-qtag danger" title="Dangerous queue">
              <IconWarning size={11} />
            </span>
          ) : null}
          {queue.readOnly ? (
            <span class="bp-qtag" title="Read-only">
              <IconLock size={11} />
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

export function Sidebar({
  groups,
  queueCount,
  selected,
  onSelect,
}: {
  groups: { group: string; items: QueueSummary[] }[];
  queueCount: number;
  selected: string | null;
  onSelect: (name: string) => void;
}): JSX.Element {
  const showHeadings = groups.length > 1 || (groups[0] && groups[0].group !== 'Queues');
  return (
    <aside class="bp-sidebar">
      <div class="bp-sidebar-title">Queues · {queueCount}</div>
      {groups.map(({ group, items }) => (
        <div class="bp-group" key={group}>
          {showHeadings ? <div class="bp-group-title">{group}</div> : null}
          {items.map((queue) => (
            <QueueCard key={queue.name} queue={queue} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      ))}
    </aside>
  );
}

function fmtKeep(v: unknown): string | null {
  if (v == null) return null;
  if (v === true) return 'remove';
  if (v === false) return 'keep all';
  if (typeof v === 'number') return `last ${v}`;
  if (typeof v === 'object') {
    const o = v as { age?: number; count?: number };
    const parts = [
      o.count != null ? `last ${o.count}` : null,
      o.age != null ? `age ${o.age}s` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : 'keep';
  }
  return null;
}

function fmtRetention(d: Record<string, unknown>): string {
  const parts: string[] = [];
  const complete = fmtKeep(d.removeOnComplete);
  if (complete) parts.push(`complete ${complete}`);
  const fail = fmtKeep(d.removeOnFail);
  if (fail) parts.push(`fail ${fail}`);
  if (d.attempts != null) parts.push(`attempts ${d.attempts}`);
  return parts.join(' · ');
}

export function WorkerPanel({ topology }: { topology: QueueTopology | null }): JSX.Element | null {
  if (!topology || (!topology.processor && !topology.defaultJobOptions)) return null;
  const retention = topology.defaultJobOptions ? fmtRetention(topology.defaultJobOptions) : '';
  return (
    <div class="bp-worker">
      {topology.processor ? (
        <span class="bp-worker-item">
          <IconCpu size={14} />
          <b>{topology.processor}</b>
        </span>
      ) : null}
      {topology.concurrency != null ? (
        <span class="bp-worker-item bp-dim">concurrency {topology.concurrency}</span>
      ) : null}
      {retention ? <span class="bp-worker-item bp-dim">retention: {retention}</span> : null}
      {topology.events.length ? (
        <span class="bp-worker-events">
          {topology.events.map((e) => (
            <span class="bp-event" key={`${e.scope}:${e.event}:${e.handler}`} title={`${e.handler}()`}>
              @{e.event}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

export function Chips({
  statuses,
  counts,
  active,
  onSelect,
}: {
  statuses: string[];
  counts: Record<string, number>;
  active: string;
  onSelect: (s: string) => void;
}): JSX.Element {
  return (
    <div class="bp-chips">
      {statuses.map((s) => (
        <button
          key={s}
          class={`bp-chip${s === active ? ' active' : ''}`}
          onClick={() => onSelect(s)}
        >
          <span class="dot" style={{ background: stateColor(s) }} />
          {s}
          <span class="count">{counts[s] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

type RowAction = (action: 'retry' | 'promote' | 'remove', job: JobSummary) => void;

function rowActions(state: string): Array<'retry' | 'promote' | 'remove'> {
  const actions: Array<'retry' | 'promote' | 'remove'> = [];
  if (state === 'failed') actions.push('retry');
  if (state === 'delayed') actions.push('promote');
  actions.push('remove');
  return actions;
}

export function JobsTable({
  jobs,
  readOnly,
  onOpen,
  onAction,
}: {
  jobs: JobSummary[];
  readOnly: boolean;
  onOpen: (job: JobSummary) => void;
  onAction: RowAction;
}): JSX.Element {
  return (
    <table class="bp-table">
      <thead>
        <tr>
          <th style={{ width: '90px' }}>ID</th>
          <th>Name</th>
          <th style={{ width: '120px' }}>State</th>
          <th style={{ width: '110px' }}>Created</th>
          <th style={{ width: '80px' }}>Attempts</th>
          <th style={{ width: readOnly ? '0' : '120px' }} />
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} onClick={() => onOpen(job)}>
            <td class="bp-jobid">#{job.id}</td>
            <td>
              <div class="bp-jobname">{job.name || '(unnamed)'}</div>
              {job.failedReason ? <div class="bp-reason">{job.failedReason}</div> : null}
            </td>
            <td>
              <Badge state={job.state} />
            </td>
            <td class="bp-dim">{relTime(job.timestamp)}</td>
            <td class="bp-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {job.attemptsMade}
            </td>
            <td onClick={(e: MouseEvent) => e.stopPropagation()}>
              {!readOnly && (
                <div class="bp-row-actions">
                  {rowActions(job.state).map((action) => (
                    <button
                      key={action}
                      class={`bp-icon-btn${action === 'remove' ? ' danger' : ''}`}
                      title={action}
                      onClick={() => onAction(action, job)}
                    >
                      {action === 'retry' ? (
                        <IconRetry size={16} />
                      ) : action === 'promote' ? (
                        <IconPromote size={16} />
                      ) : (
                        <IconTrash size={16} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Toolbar({
  status,
  readOnly,
  busy,
  onFind,
  onAdd,
  onExport,
  onBulk,
}: {
  status: string;
  readOnly: boolean;
  busy: boolean;
  onFind: (id: string) => void;
  onAdd: () => void;
  onExport: () => void;
  onBulk: (action: 'retry' | 'promote') => void;
}): JSX.Element {
  const bulk =
    status === 'failed'
      ? { label: 'Retry all', action: 'retry' as const }
      : status === 'delayed'
        ? { label: 'Promote all', action: 'promote' as const }
        : null;
  return (
    <div class="bp-toolbar2">
      <form
        class="bp-find"
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget as HTMLFormElement).elements.namedItem(
            'jobid',
          ) as HTMLInputElement;
          const value = input.value.trim();
          if (value) onFind(value);
        }}
      >
        <IconSearch size={15} class="bp-find-icon" />
        <input name="jobid" class="bp-input" placeholder="Find job by ID…" autocomplete="off" />
      </form>
      <div class="bp-toolbar2-actions">
        {bulk && !readOnly ? (
          <button class="bp-btn" disabled={busy} onClick={() => onBulk(bulk.action)}>
            <IconRetry size={15} /> {bulk.label}
          </button>
        ) : null}
        <button class="bp-btn" onClick={onExport}>
          <IconDownload size={15} /> Export
        </button>
        {!readOnly ? (
          <button class="bp-btn primary" onClick={onAdd}>
            <IconPlus size={15} /> Add job
          </button>
        ) : null}
      </div>
    </div>
  );
}

type RemoveMode = 'default' | 'true' | 'false' | 'count' | 'age';

function removeValue(
  mode: RemoveMode,
  value: string,
): boolean | { count: number } | { age: number } | undefined {
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  if (mode === 'count') return { count: Number(value) || 0 };
  if (mode === 'age') return { age: Number(value) || 0 };
  return undefined;
}

export function AddJobModal({
  queue,
  busy,
  onClose,
  onSubmit,
}: {
  queue: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; data: unknown; opts?: Record<string, unknown> }) => void;
}): JSX.Element {
  const [name, setName] = useState('job');
  const [data, setData] = useState('{\n  "example": true\n}');
  const [attempts, setAttempts] = useState('');
  const [priority, setPriority] = useState('');
  const [delay, setDelay] = useState('');
  const [backoffType, setBackoffType] = useState<'none' | 'fixed' | 'exponential'>('none');
  const [backoffDelay, setBackoffDelay] = useState('1000');
  const [rocMode, setRocMode] = useState<RemoveMode>('default');
  const [rocValue, setRocValue] = useState('100');
  const [rofMode, setRofMode] = useState<RemoveMode>('default');
  const [rofValue, setRofValue] = useState('1000');
  const [extra, setExtra] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    let parsedData: unknown;
    try {
      parsedData = data.trim() ? JSON.parse(data) : {};
    } catch {
      setErr('Data is not valid JSON');
      return;
    }
    const opts: Record<string, unknown> = {};
    const int = (v: string) => (v.trim() === '' ? undefined : Number.parseInt(v, 10));
    const a = int(attempts);
    if (a != null && !Number.isNaN(a)) opts.attempts = a;
    const p = int(priority);
    if (p != null && !Number.isNaN(p)) opts.priority = p;
    const d = int(delay);
    if (d != null && !Number.isNaN(d)) opts.delay = d;
    if (backoffType !== 'none') opts.backoff = { type: backoffType, delay: int(backoffDelay) ?? 1000 };
    const roc = removeValue(rocMode, rocValue);
    if (roc !== undefined) opts.removeOnComplete = roc;
    const rof = removeValue(rofMode, rofValue);
    if (rof !== undefined) opts.removeOnFail = rof;
    if (extra.trim()) {
      try {
        Object.assign(opts, JSON.parse(extra));
      } catch {
        setErr('Extra options is not valid JSON');
        return;
      }
    }
    onSubmit({
      name: name || 'job',
      data: parsedData,
      opts: Object.keys(opts).length ? opts : undefined,
    });
  };

  const removeRow = (
    label: string,
    mode: RemoveMode,
    setMode: (m: RemoveMode) => void,
    value: string,
    setValue: (v: string) => void,
  ) => (
    <div class="bp-field">
      <label>{label}</label>
      <div class="bp-opt-inline">
        <select
          class="bp-input"
          value={mode}
          onChange={(e) => setMode((e.target as HTMLSelectElement).value as RemoveMode)}
        >
          <option value="default">queue default</option>
          <option value="true">remove immediately</option>
          <option value="false">keep all</option>
          <option value="count">keep last N</option>
          <option value="age">keep for age (s)</option>
        </select>
        {mode === 'count' || mode === 'age' ? (
          <input
            class="bp-input"
            type="number"
            value={value}
            onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div class="bp-overlay" onClick={onClose} />
      <div class="bp-modal" role="dialog" aria-modal="true">
        <div class="bp-drawer-head">
          <div class="bp-drawer-title">Add job · {queue}</div>
          <button class="bp-icon-btn" onClick={onClose} title="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div class="bp-drawer-body">
          {err ? <div class="bp-banner">{err}</div> : null}
          <div class="bp-field">
            <label>Name</label>
            <input
              class="bp-input wide"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="bp-field">
            <label>Data (JSON)</label>
            <textarea
              class="bp-textarea"
              value={data}
              onInput={(e) => setData((e.target as HTMLTextAreaElement).value)}
            />
          </div>

          <div class="bp-opt-grid">
            <div class="bp-field">
              <label>Attempts</label>
              <input
                class="bp-input"
                type="number"
                placeholder="1"
                value={attempts}
                onInput={(e) => setAttempts((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="bp-field">
              <label>Priority</label>
              <input
                class="bp-input"
                type="number"
                placeholder="0"
                value={priority}
                onInput={(e) => setPriority((e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="bp-field">
              <label>Delay (ms)</label>
              <input
                class="bp-input"
                type="number"
                placeholder="0"
                value={delay}
                onInput={(e) => setDelay((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>

          <div class="bp-field">
            <label>Backoff on retry</label>
            <div class="bp-opt-inline">
              <select
                class="bp-input"
                value={backoffType}
                onChange={(e) =>
                  setBackoffType((e.target as HTMLSelectElement).value as typeof backoffType)
                }
              >
                <option value="none">none</option>
                <option value="fixed">fixed</option>
                <option value="exponential">exponential</option>
              </select>
              {backoffType !== 'none' ? (
                <input
                  class="bp-input"
                  type="number"
                  value={backoffDelay}
                  onInput={(e) => setBackoffDelay((e.target as HTMLInputElement).value)}
                />
              ) : null}
            </div>
          </div>

          {removeRow('Remove on complete', rocMode, setRocMode, rocValue, setRocValue)}
          {removeRow('Remove on fail', rofMode, setRofMode, rofValue, setRofValue)}

          <div class="bp-field">
            <label>Extra options (JSON, optional)</label>
            <textarea
              class="bp-textarea short"
              value={extra}
              placeholder={'{ "jobId": "custom-id" }'}
              onInput={(e) => setExtra((e.target as HTMLTextAreaElement).value)}
            />
          </div>
        </div>
        <div class="bp-drawer-actions">
          <button class="bp-btn primary" disabled={busy} onClick={submit}>
            <IconPlus size={15} /> Add job
          </button>
          <button class="bp-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export function QueueActionsBar({
  queue,
  readOnly,
  busy,
  onPauseToggle,
  onClean,
}: {
  queue: QueueSummary;
  readOnly: boolean;
  busy: boolean;
  onPauseToggle: () => void;
  onClean: () => void;
}): JSX.Element {
  if (readOnly) {
    return (
      <span class="bp-tag-readonly">
        <IconLock size={13} /> read-only
      </span>
    );
  }
  return (
    <div class="bp-main-actions">
      <button class="bp-btn" disabled={busy} onClick={onPauseToggle}>
        {queue.isPaused ? <IconPlay size={15} /> : <IconPause size={15} />}
        {queue.isPaused ? 'Resume' : 'Pause'}
      </button>
      <button class="bp-btn danger" disabled={busy} onClick={onClean}>
        <IconBroom size={15} /> Clean
      </button>
    </div>
  );
}

function Code({ value, error }: { value: unknown; error?: boolean }): JSX.Element {
  return <pre class={`bp-code${error ? ' error' : ''}`}>{pretty(value)}</pre>;
}

export function JobDrawer({
  job,
  readOnly,
  busy,
  onClose,
  onAction,
}: {
  job: JobDetail;
  readOnly: boolean;
  busy: boolean;
  onClose: () => void;
  onAction: (action: 'retry' | 'promote' | 'remove') => void;
}): JSX.Element {
  return (
    <>
      <div class="bp-overlay" onClick={onClose} />
      <div class="bp-drawer" role="dialog" aria-modal="true">
        <div class="bp-drawer-head">
          <div class="bp-drawer-title">
            <span class="bp-jobid">#{job.id}</span>
            {job.name || '(unnamed)'}
            <Badge state={job.state} />
          </div>
          <button class="bp-icon-btn" onClick={onClose} title="Close">
            <IconClose size={18} />
          </button>
        </div>

        <div class="bp-drawer-body">
          <div class="bp-field">
            <div class="bp-meta-grid">
              <div>
                <label>Attempts</label>
                <div class="v">{job.attemptsMade}</div>
              </div>
              <div>
                <label>Created</label>
                <div class="v">{relTime(job.timestamp)}</div>
              </div>
              <div>
                <label>Duration</label>
                <div class="v">{duration(job.processedOn, job.finishedOn)}</div>
              </div>
              <div>
                <label>Delay</label>
                <div class="v">{job.delay ? `${job.delay}ms` : '—'}</div>
              </div>
            </div>
          </div>

          {job.failedReason ? (
            <div class="bp-field">
              <label>Failed reason</label>
              <Code value={job.failedReason} error />
            </div>
          ) : null}

          {job.stacktrace?.length ? (
            <div class="bp-field">
              <label>Stack trace</label>
              <Code value={job.stacktrace.join('\n')} error />
            </div>
          ) : null}

          <div class="bp-field">
            <label>Data</label>
            <Code value={job.data} />
          </div>

          {job.returnValue != null ? (
            <div class="bp-field">
              <label>Return value</label>
              <Code value={job.returnValue} />
            </div>
          ) : null}

          {job.logs?.length ? (
            <div class="bp-field">
              <label>Logs</label>
              <Code value={job.logs.join('\n')} />
            </div>
          ) : null}

          <div class="bp-field">
            <label>Options</label>
            <Code value={job.opts} />
          </div>
        </div>

        {!readOnly && (
          <div class="bp-drawer-actions">
            {job.state === 'failed' && (
              <button class="bp-btn primary" disabled={busy} onClick={() => onAction('retry')}>
                <IconRetry size={15} /> Retry
              </button>
            )}
            {job.state === 'delayed' && (
              <button class="bp-btn" disabled={busy} onClick={() => onAction('promote')}>
                <IconPromote size={15} /> Promote
              </button>
            )}
            <button class="bp-btn danger" disabled={busy} onClick={() => onAction('remove')}>
              <IconTrash size={15} /> Remove
            </button>
          </div>
        )}
      </div>
    </>
  );
}
