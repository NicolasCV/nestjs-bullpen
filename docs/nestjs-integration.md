# NestJS integration

Bullpen is built from NestJS primitives, so it knows things a generic dashboard can't.

## Auto-discovery

On startup Bullpen walks the DI container with `DiscoveryService` and keeps every provider that is a BullMQ `Queue` (with a duck-typed fallback in case `bullmq` is duplicated in the tree). That's exactly what `@nestjs/bullmq`'s `registerQueue()` produces, so you never register queues with the dashboard by hand. `include` / `exclude` narrow the set.

## Topology

For each queue, Bullpen also finds the NestJS pieces behind it and exposes them at `GET {route}/api/queues/:name/topology`:

```json
{
  "processor": "EmailsProcessor",
  "concurrency": 5,
  "events": [
    { "scope": "worker", "event": "completed", "handler": "onCompleted" },
    { "scope": "worker", "event": "failed", "handler": "onFailed" }
  ],
  "meta": { "group": "Communications", "description": "..." }
}
```

It reads:

- the `@Processor()` class bound to the queue,
- the worker `concurrency`,
- every `@OnWorkerEvent` / `@OnQueueEvent` handler and the method that implements it.

The UI shows this as a worker strip above the job table. A plain Redis-backed dashboard can't produce it because it has no view of your DI graph.

## Metadata coupling

The topology reader matches `@nestjs/bullmq`'s metadata keys, mirrored in `src/constants.ts` (`BULLMQ_PROCESSOR_METADATA`, `BULLMQ_WORKER_METADATA`, `BULLMQ_ON_WORKER_EVENT_METADATA`, `BULLMQ_ON_QUEUE_EVENT_METADATA`). They've been stable across `@nestjs/bullmq` 10 and 11. If a future version renames them, update that file.

## Platform-agnostic

Everything is a controller plus a guard, so the same build runs on `@nestjs/platform-express` and `@nestjs/platform-fastify` with no adapter packages.
