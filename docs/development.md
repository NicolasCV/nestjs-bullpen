# Development

## Setup

```bash
git clone https://github.com/NicolasCV/nestjs-bullpen
cd nestjs-bullpen
npm install
```

## Commands

```bash
npm run build      # tsc (library) + vite single-file (UI) -> dist/
npm run typecheck  # tsc --noEmit
npm test           # jest unit suite
npm run build:ui   # rebuild just the UI bundle
```

## Run the demo

The demo needs a Redis. If your machine already runs one on 6379, use an isolated instance so you don't mix test jobs into it:

```bash
docker run -d --name bullpen-redis -p 6399:6379 redis:7-alpine redis-server --save "" --appendonly no
REDIS_PORT=6399 PORT=3777 npm run example      # http://localhost:3777/admin/queues (admin / admin)
REDIS_PORT=6399 npm run seed                   # enqueue jobs in every state
REDIS_PORT=6399 PORT=3778 npm run example:fastify   # same app on Fastify
```

## Layout

```
src/          library (compiled to dist/)
ui/           Preact + Vite UI (built into dist/ui/index.html)
example/      runnable NestJS demo + seed
test/         Jest specs (mocked, no Redis needed)
docs/         these docs
```

## Conventions

Keep it lightweight (no runtime deps, small UI bundle), scale-safe (paginate, cap bulk/export), and platform-agnostic (no Express/Fastify-specific code in the library). See [CLAUDE.md](../CLAUDE.md) for the full list and [CONTRIBUTING.md](../CONTRIBUTING.md) before opening a PR.
