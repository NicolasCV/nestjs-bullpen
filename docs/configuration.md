# Configuration

`BullpenModule.forRoot(options)` and `BullpenModule.forRootAsync(options)`.

| Option     | Type                                  | Default    | Notes                                                  |
| ---------- | ------------------------------------- | ---------- | ------------------------------------------------------ |
| `route`    | `string`                              | `/bullpen` | Where the dashboard mounts.                            |
| `auth`     | guard / guard[] / `BullpenAuthOptions`| no auth    | See [authentication](./authentication.md).             |
| `writable` | `boolean`                             | `false`    | Enable mutations (retry/remove/add/...); read-only until set. |
| `include`  | `string[]`                            | all        | Whitelist queues by name.                              |
| `exclude`  | `string[]`                            | —          | Hide queues by name.                                   |
| `queues`   | `Record<string, BullpenQueueOptions>` | —          | Per-queue presentation for queues without a processor. |
| `title`    | `string`                              | `Bullpen`  | Dashboard title.                                       |
| `theme`    | `'dark' \| 'light'`                   | `dark`     | Default theme (users can toggle; remembered locally).  |

## Async configuration

`route` stays synchronous (it has to be registered before routing); the rest comes from the factory:

```ts
BullpenModule.forRootAsync({
  route: '/admin/queues',
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    writable: config.get('NODE_ENV') !== 'production', // mutations off in prod
    auth: { type: 'basic', credentials: { username: 'admin', password: config.get('BULLPEN_PASS') } },
  }),
});
```

## `@BullpenQueue`

Enrich how a queue appears. Put it on the queue's processor:

```ts
import { BullpenQueue } from 'nestjs-bullpen';

@BullpenQueue({ description: 'Outbound email', group: 'Comms', danger: true, readOnly: false })
@Processor('emails')
export class EmailsProcessor extends WorkerHost {}
```

| Field         | Effect                                                |
| ------------- | ----------------------------------------------------- |
| `description` | Shown under the queue title.                          |
| `group`       | Groups the queue in the sidebar.                      |
| `readOnly`    | Disables mutations for just this queue.               |
| `danger`      | Marks the queue with a warning badge.                 |

For queues that have no processor class, set the same fields through the `queues` option map instead.

## Default job options (retention and retry)

Set BullMQ job options that Bullpen applies to jobs **added from the dashboard**. Useful for retention (`removeOnComplete` / `removeOnFail`) and retry (`attempts` / `backoff`). They merge in this order, last wins: module `defaultJobOptions`, then the per-queue value, then whatever the Add Job form sends.

```ts
BullpenModule.forRoot({
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 1000 }, // keep 1h or last 1000
    removeOnFail: { age: 86400 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
  queues: {
    payments: { defaultJobOptions: { removeOnComplete: false } }, // keep everything for this queue
  },
});
```

`removeOnComplete` / `removeOnFail` accept `true` (remove right away), `false` (keep all), a number (keep the last N), or `{ age, count }`. This mirrors BullMQ exactly, since the value is passed straight through to `queue.add`.

The dashboard also shows each queue's own retention policy (the `defaultJobOptions` you set on `registerQueue`) in the worker panel, and the Add Job form has fields for attempts, priority, delay, backoff, and both removal policies.
