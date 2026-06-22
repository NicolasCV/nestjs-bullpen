import { JSX } from 'preact';
import { JobDetail, JobSummary, QueueSummary } from './api';
import { duration, pretty, relTime, stateColor } from './format';
import {
  BullLogo,
  IconBroom,
  IconChevron,
  IconClose,
  IconLock,
  IconPause,
  IconPlay,
  IconPromote,
  IconRetry,
  IconTrash,
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

export function Sidebar({
  queues,
  selected,
  onSelect,
}: {
  queues: QueueSummary[];
  selected: string | null;
  onSelect: (name: string) => void;
}): JSX.Element {
  return (
    <aside class="bp-sidebar">
      <div class="bp-sidebar-title">Queues · {queues.length}</div>
      {queues.map((q) => (
        <button
          key={q.name}
          class={`bp-queue${q.name === selected ? ' active' : ''}`}
          onClick={() => onSelect(q.name)}
        >
          <div class="bp-queue-head">
            <span class="bp-queue-name">{q.name}</span>
            <span class="bp-queue-total">
              {q.isPaused ? '⏸ ' : ''}
              {q.total}
            </span>
          </div>
          <StateBar counts={q.counts} />
        </button>
      ))}
    </aside>
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

export { BullLogo, IconChevron };
