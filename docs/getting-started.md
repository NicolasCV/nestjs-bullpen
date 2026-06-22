# Getting started

## Install

```bash
npm install nestjs-bullpen
```

`@nestjs/common`, `@nestjs/core`, and `bullmq` are peer dependencies — you already have them through `@nestjs/bullmq`.

## Mount it

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullpenModule } from 'nestjs-bullpen';

@Module({
  imports: [
    BullModule.forRoot({ connection: { host: 'localhost', port: 6379 } }),
    BullModule.registerQueue({ name: 'emails' }, { name: 'reports' }),
    BullpenModule.forRoot(),
  ],
})
export class AppModule {}
```

Open `http://localhost:3000/bullpen`. Both queues show up automatically — there is no per-queue registration step.

## Add a route and auth

Everything lives in one options object:

```ts
BullpenModule.forRoot({
  route: '/admin/queues',
  auth: JwtAuthGuard, // any NestJS guard works as a one-liner
});
```

See [configuration](./configuration.md) and [authentication](./authentication.md) for the rest.
