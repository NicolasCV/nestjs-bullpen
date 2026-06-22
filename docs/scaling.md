# Scaling

Bullpen is meant to stay usable when a deployment has many queues and a lot of jobs. The rule throughout: never load an unbounded amount of data.

## How reads stay cheap

- **Counts** come from `queue.getJobCounts(...)`, not from fetching jobs.
- **Job lists** are range-paginated — `queue.getJobs(state, start, end)` maps to a bounded Redis range, so page size is what you fetch, regardless of how many jobs exist.
- **Find by ID** is a direct `queue.getJob(id)` (O(1)). Use the search box in the toolbar; it never scans.
- **Live updates** stream queue counts over SSE (a small payload every couple of seconds), falling back to polling when the auth mode doesn't allow `EventSource`.

## Operations

The toolbar above the job table gives you:

- **Find** — jump straight to a job by id.
- **Add** — enqueue a job (name + JSON data + optional `delay`/`priority`/`attempts`).
- **Export** — download the current state's jobs (with payloads) as JSON.
- **Retry all / Promote all** — bulk-process the visible state.
- **Clean** — remove a whole state (uses BullMQ's `clean`).

## Caps (and why they're loud)

Export and bulk operations are capped so a single click can't try to pull or mutate millions of jobs:

- `EXPORT_CAP` = 1000
- `BULK_CAP` = 1000

When a call hits the cap, Bullpen tells you in the UI (e.g. "Retried 1000 jobs (cap reached — run again for the rest)") instead of silently doing part of the work. Run the action again to continue, or use **Clean** for whole-state removal.

## Per-queue safety

Mark high-risk queues `readOnly` (via `@BullpenQueue({ readOnly: true })` or the `queues` map) so the dashboard shows their jobs but refuses mutations, while the rest stay fully operational.
