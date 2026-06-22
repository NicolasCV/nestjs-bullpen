# 🐂 Bullpen

A lightweight, **dark-mode-first**, **NestJS-native** dashboard for [BullMQ](https://docs.bullmq.io).

[![npm version](https://img.shields.io/npm/v/nestjs-bullpen.svg)](https://www.npmjs.com/package/nestjs-bullpen)
[![license](https://img.shields.io/npm/l/nestjs-bullpen.svg)](./LICENSE)

Bullpen auto-discovers every `@nestjs/bullmq` queue in your app and gives you a clean UI to inspect and manage them — counts, jobs, payloads, logs, stack traces, plus retry / promote / remove / pause / resume / clean. It is built entirely from NestJS primitives (a controller + a guard), so it runs on **Express and Fastify** with no adapter glue, and you wire it up in **one line**.

![Bullpen dashboard](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-dark.png)

## Why another board?

[`bull-board`](https://github.com/felixmosh/bull-board) is great, but it mounts platform-specific middleware and asks you to register every queue by hand. Bullpen takes a NestJS-first approach:

- **One line, zero queue wiring** — `BullpenModule.forRoot()` auto-discovers your queues through Nest's `DiscoveryService`. No per-queue `forFeature`.
- **Platform-agnostic** — it's just a NestJS controller guarded by a `CanActivate`. Works on Express _and_ Fastify identically, no adapter packages.
- **Auth is a first-class option** — none / HTTP basic / any existing NestJS guard (JWT, sessions…) / a custom predicate.
- **Configurable mount route** — drop it at `/admin/queues`, `/bullpen`, wherever.
- **Modern, lightweight UI** — a single self-contained ~36&nbsp;KB asset. Dark by default, light on request. No external fonts, no runtime CDN.
- **Read-only mode** — expose a safe, look-but-don't-touch board.

## Install

```bash
npm install nestjs-bullpen
```

`@nestjs/common`, `@nestjs/core`, and `bullmq` are peer dependencies (you already have them with `@nestjs/bullmq`).

## Quick start

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullpenModule } from 'nestjs-bullpen';

@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
    BullModule.registerQueue({ name: 'emails' }, { name: 'reports' }),

    // That's it — Bullpen finds both queues automatically.
    BullpenModule.forRoot(),
  ],
})
export class AppModule {}
```

Open `http://localhost:3000/bullpen`. Add auth and a custom route in the same options object:

```ts
BullpenModule.forRoot({
  route: '/admin/queues',
  auth: { type: 'basic', credentials: { username: 'admin', password: process.env.BULLPEN_PASS! } },
});
```

## Configuration

| Option     | Type                                  | Default     | Description                                             |
| ---------- | ------------------------------------- | ----------- | ------------------------------------------------------- |
| `route`    | `string`                              | `/bullpen`  | Path the dashboard is mounted at.                       |
| `auth`     | `BullpenAuthOptions`                  | `{type:'none'}` | Authentication strategy (see below).                |
| `readOnly` | `boolean`                             | `false`     | Block every mutating endpoint with `403`.               |
| `include`  | `string[]`                            | all         | Only expose these queues (by name).                     |
| `exclude`  | `string[]`                            | —           | Hide these queues (by name).                            |
| `title`    | `string`                              | `Bullpen`   | Dashboard title.                                        |
| `theme`    | `'dark' \| 'light'`                   | `dark`      | Default theme (users can toggle; choice is remembered). |

## Authentication

```ts
// 1. None — dev only; logs a warning.
BullpenModule.forRoot({ auth: { type: 'none' } });

// 2. HTTP basic — static credentials or a custom validator.
BullpenModule.forRoot({
  auth: {
    type: 'basic',
    credentials: [{ username: 'admin', password: 'secret' }],
    // or: validate: async (user, pass) => myUserService.check(user, pass),
  },
});

// 3. Reuse any existing NestJS guard (JWT, session, roles…).
BullpenModule.forRoot({ auth: { type: 'guard', useGuard: JwtAuthGuard } });

// 4. Custom predicate over the raw request.
BullpenModule.forRoot({
  auth: { type: 'custom', authorize: (req) => Boolean((req as any).user?.isAdmin) },
});
```

### Async configuration

When your options depend on `ConfigService` etc., use `forRootAsync`. The `route` stays synchronous (it has to be registered before routing), everything else is resolved by the factory:

```ts
BullpenModule.forRootAsync({
  route: '/admin/queues',
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    auth: { type: 'basic', credentials: { username: 'admin', password: config.get('BULLPEN_PASS')! } },
    readOnly: config.get('NODE_ENV') === 'production',
  }),
});
```

## Screenshots

| Job inspector (dark) | Light theme |
| --- | --- |
| ![Job detail](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-job.png) | ![Light theme](https://raw.githubusercontent.com/NicolasCV/nestjs-bullpen/main/assets/bullpen-light.png) |

## How it works

- **Discovery.** On application bootstrap, Bullpen scans the DI container with `DiscoveryService` and keeps every provider that is a BullMQ `Queue`. That's exactly what `@nestjs/bullmq`'s `registerQueue()` produces, so no manual registration is needed.
- **Routing.** `forRoot()` rewrites the controller's path metadata to your `route` before Nest maps routes — a single controller serves the UI shell at `route` and a small JSON API under `route/api/*`.
- **No platform coupling.** Everything is a controller + a `CanActivate` guard, so the same code runs on `@nestjs/platform-express` and `@nestjs/platform-fastify`.

## Local development

```bash
docker compose up -d redis     # Redis on :6379
npm install
npm run build                  # compile lib + bundle UI
npm run example                # demo app at http://localhost:3000/admin/queues (admin / admin)
npm run seed                   # enqueue a mix of jobs in every state
npm test                       # unit tests
```

`npm run example:fastify` boots the same demo on Fastify.

## License

[MIT](./LICENSE) © Nicolás Cárdenas Valdez
