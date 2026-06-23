<div align="center">

<img src="https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/logo.png" alt="Bullpen" width="128" />

# Bullpen

**A NestJS-native dashboard for [BullMQ](https://docs.bullmq.io).** One line to mount, no per-queue wiring, and it actually understands your NestJS app.

[![CI](https://github.com/NicolasCV/nestjs-bullpen/actions/workflows/ci.yml/badge.svg)](https://github.com/NicolasCV/nestjs-bullpen/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/nestjs-bullpen.svg)](https://www.npmjs.com/package/nestjs-bullpen)
[![install size](https://packagephobia.com/badge?p=nestjs-bullpen)](https://packagephobia.com/result?p=nestjs-bullpen)
[![runtime deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen.svg)](#small-and-staying-that-way)
[![UI bundle](https://img.shields.io/badge/UI-~16%20kB%20gzip-brightgreen.svg)](#small-and-staying-that-way)
[![license](https://img.shields.io/github/license/NicolasCV/nestjs-bullpen.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-E0234E.svg)](./CONTRIBUTING.md)

![Bullpen dashboard](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-dark.png)

</div>

## Why Bullpen

Most queue dashboards treat BullMQ as a pile of Redis keys. Bullpen is built from NestJS primitives, so it can show the processor behind each queue, its concurrency, and its event handlers. It also mounts in a single line, because it finds your queues through Nest's DI container instead of asking you to register them again.

The goal is to stay out of your way: easy to drop in, configurable when you need it, and light enough that it isn't a tax on your app.

## Quick start

```bash
npm install nestjs-bullpen
```

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullpenModule } from 'nestjs-bullpen';

@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
    BullModule.registerQueue({ name: 'emails' }, { name: 'reports' }),
    BullpenModule.forRoot(), // every queue above shows up automatically
  ],
})
export class AppModule {}
```

Open `<your-app-url>/bullpen`. Want a route and auth? Same options object:

```ts
BullpenModule.forRoot({ route: '/admin/queues', auth: JwtAuthGuard });
```

That `auth: JwtAuthGuard` is the whole setup. Any guard you already use works. See [the auth docs](./docs/authentication.md) for basic, custom, and roles.

The dashboard is **read-only by default**. To enable retry/remove/add and the other mutations, opt in with `writable: true`.

## What you get

- **Your NestJS topology, not just Redis.** Each queue shows its `@Processor` class, worker concurrency, and `@OnWorkerEvent` handlers. ([how it works](./docs/nestjs-integration.md))
- **Auth that fits your app.** Hand it a guard (or several), HTTP basic, or a custom predicate. Role metadata is passed through so a `RolesGuard` resolves normally.
- **Runs anywhere NestJS does.** It's a controller plus a guard, so Express and Fastify both work with no adapter packages.
- **Built for big deployments.** Range-based pagination, counts that never fetch jobs, find-by-id, plus exports and bulk actions that are capped and tell you when they hit the cap. ([scaling](./docs/scaling.md))
- **Real-time.** Live counts over SSE, falling back to polling when the auth mode can't stream.
- **Job management, opt-in.** Retry, promote, remove, pause/resume, clean, add jobs, export to JSON. Off by default (set `writable: true`), with an optional per-queue read-only lock.
- **Dark-first UI** shipped as one self-contained file. No CDN calls and no web-font downloads.

## Small, and staying that way

Lightweight isn't a tagline here. It's a project rule, checked on every build. Current numbers:

| | Bullpen |
| --- | --- |
| Runtime dependencies | **0** (everything is a peer dep) |
| UI bundle | one self-contained file, **~16 KB gzipped** |
| Published package | **~32 KB** |

## Documentation

[Getting started](./docs/getting-started.md) · [Configuration](./docs/configuration.md) · [Authentication](./docs/authentication.md) · [NestJS integration](./docs/nestjs-integration.md) · [Scaling](./docs/scaling.md) · [Development](./docs/development.md)

## Screenshots

| Add a job | Light theme |
| --- | --- |
| ![Add job](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-addjob.png) | ![Light](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-light.png) |

## Roadmap

It's early, and feedback shapes what comes next. On the radar:

- Flow / parent-child job views
- Per-queue throughput and latency charts
- Job search by name and payload, not just id
- A `nest g` schematic for one-command setup

Found a bug or want a feature? [Open an issue](https://github.com/NicolasCV/nestjs-bullpen/issues). Good first issues are tagged.

## Contributing

PRs are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CLAUDE.md](./CLAUDE.md) for the conventions. The two that matter most: keep it lightweight, and keep it scale-safe.

## License

[MIT](./LICENSE) © Nicolás Cárdenas Valdez
