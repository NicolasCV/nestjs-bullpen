# Bullpen docs

A NestJS-native BullMQ dashboard. Start here, then dig into whatever you need.

- [Getting started](./getting-started.md) — install, mount, run.
- [Configuration](./configuration.md) — every option, plus `@BullpenQueue`.
- [Authentication](./authentication.md) — none / basic / guard(s) / custom, roles, and the read-only-by-default write gate.
- [NestJS integration](./nestjs-integration.md) — auto-discovery and the topology view.
- [Scaling](./scaling.md) — how Bullpen stays fast on large deployments, and the find/add/export/bulk tools.
- [Development](./development.md) — build, test, run the demo, contribute.

Design goals, in order: stay lightweight (the frontend especially), be NestJS-first, and keep working when a deployment has a lot of queues and a lot of jobs.
