# Changelog

## 0.2.0

First public release.

### Core

- `BullpenModule.forRoot()` / `forRootAsync()` with zero-config queue auto-discovery via Nest's `DiscoveryService`.
- Platform-agnostic: a single controller plus guard that runs on Express and Fastify with no adapter packages.
- Configurable mount route, queue `include` / `exclude`, dashboard title and default theme.

### NestJS integration

- Topology view: each queue maps to its `@Processor` class, worker concurrency, and `@OnWorkerEvent` / `@OnQueueEvent` handlers.
- `@BullpenQueue()` decorator for per-queue description, grouping, danger, and read-only.

### Auth

- Pass a guard class (or array) straight to `auth` for one-line setup.
- Built-in HTTP basic, a custom predicate, and metadata pass-through so reflector guards (like a `RolesGuard`) resolve.
- Global and per-queue read-only mode.

### Scale and operations

- Range-based job pagination and count-only summaries.
- Find a job by id, add jobs, export a state to JSON, and bulk retry/promote. Exports and bulk actions are capped and report when they hit the cap.
- Default job options (retention/retry) at the module and per-queue level, first-class fields in the Add Job form, and each queue's retention policy shown in the worker panel.
- Real-time queue counts over SSE, with automatic polling fallback.

### UI

- Dark-first, single self-contained file (~16 KB gzipped), light theme, sidebar grouping, and live indicator.

### Typing

- `JobState` and `BullpenAuthType` enums exported alongside string literals.
