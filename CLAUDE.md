# CLAUDE.md — Bullpen (`nestjs-bullpen`)

A NestJS-native dashboard for BullMQ. One line to mount, auto-discovers queues, runs on Express and Fastify, and maps each queue to its NestJS processor.

## Non-negotiable constraints

1. **Lightweight is a feature, not a nice-to-have.** It is central to this project's success.
   - The published package has **zero runtime dependencies** — `@nestjs/common`, `@nestjs/core`, `bullmq`, `rxjs`, `reflect-metadata` are all `peerDependencies`. Do not add a runtime `dependency` without a very strong reason.
   - The frontend stays tiny: **Preact, not React**, bundled to a single self-contained HTML via `vite-plugin-singlefile`. No UI runtime fetched from a CDN, no web fonts, no component libraries. After any UI change, run `npm run build` and check the printed `dist/ui/index.html` size — keep it small (it was ~40 KB).
   - Prefer no new dependency. If you reach for one, justify it and measure the size cost.

2. **Scale-safe by default.** Bullpen must stay responsive against very large BullMQ deployments.
   - Never load all jobs or all of a list unbounded. Job listing is **range-based pagination** (`queue.getJobs(type, start, end)`), which is O(range) in Redis.
   - Counts come from `queue.getJobCounts(...)` — do not count by fetching jobs.
   - Bulk operations and exports are **capped** and must **report when they hit the cap** (`log()` / a `capped` flag) — never truncate silently.
   - Find-by-id is a direct `queue.getJob(id)` (O(1)) — never scan to find a job.

3. **UI style:** dark-mode first, clean system font, **no glow** (no blurred colored shadows; use flat/elevation shadows only). NestJS red `#E0234E` accent.

4. **Comments:** write self-documenting code; only comment a non-obvious *why* (1–2 lines max).

## Architecture

- `src/` — the library (compiled to `dist/` by `tsc`).
  - `bullpen.module.ts` — `forRoot`/`forRootAsync`. Normalizes `auth` (guard class/array → canonical shape), attaches guard metadata (roles) to the controller, rewrites the controller `PATH_METADATA` to the configured `route`.
  - `bullpen.controller.ts` — platform-agnostic controller: serves the single-file UI, the JSON API, and the SSE stream. Guarded by `BullpenAuthGuard`.
  - `services/queue-discovery.service.ts` — finds `Queue` instances via `DiscoveryService` (`instanceof Queue` + duck-type fallback).
  - `services/queue-actions.service.ts` — wraps BullMQ reads/mutations.
  - `services/queue-topology.service.ts` — maps each queue to its `@Processor` class, concurrency, and `@OnWorkerEvent` handlers (the headline differentiator).
  - `auth/bullpen-auth.guard.ts` — one `CanActivate` dispatching none/basic/guard(s)/custom + read-only.
  - `decorators/bullpen-queue.decorator.ts` — `@BullpenQueue()` presentation metadata.
- `ui/` — Preact + Vite source, built into `dist/ui/index.html`. The controller injects `window.__BULLPEN__` config into the shell at request time.
- `example/` — runnable NestJS demo (Express + Fastify) with processors, `@OnWorkerEvent`, `@BullpenQueue`, and a seed script.
- `test/` — Jest unit specs (mocked; no Redis needed).

### Metadata coupling (important)

`queue-topology.service.ts` reads `@nestjs/bullmq`'s processor/worker metadata via keys mirrored in `src/constants.ts` (`BULLMQ_PROCESSOR_METADATA`, `BULLMQ_WORKER_METADATA`, `BULLMQ_ON_WORKER_EVENT_METADATA`, `BULLMQ_ON_QUEUE_EVENT_METADATA`). These mirror `@nestjs/bullmq`'s internal (unexported) `bull.constants.ts`. If a future `@nestjs/bullmq` changes them, update `src/constants.ts`.

## Commands

```bash
npm run build       # clean + tsc (lib) + vite singlefile (ui) -> dist/
npm run build:lib   # tsc only
npm run build:ui    # vite only
npm run typecheck   # tsc --noEmit
npm test            # jest unit suite
npm run example     # demo app (Express). PORT / REDIS_PORT env override.
npm run example:fastify
npm run seed        # enqueue a mix of jobs in every state
```

## Local E2E

Host Redis is usually on `:6379`. For local testing use an **isolated** Redis to avoid polluting it:

```bash
docker run -d --name bullpen-redis -p 6399:6379 redis:7-alpine redis-server --save "" --appendonly no
REDIS_PORT=6399 PORT=3777 npm run example
REDIS_PORT=6399 npm run seed
```

UI verification uses Playwright; save screenshots/logs to `.playwright-mcp/` (git-ignored). The committed product shots live in `assets/`.

## Adding a feature

1. Keep it scale-safe and lightweight (see constraints).
2. Add/extend a Jest spec.
3. If it changes the UI, rebuild and verify in a real browser (screenshot).
4. Document it under `docs/` and, if user-facing, in the README.
5. Platform-agnostic only — no Express- or Fastify-specific code in the library.
