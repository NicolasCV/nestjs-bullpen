# Configuration

`BullpenModule.forRoot(options)` and `BullpenModule.forRootAsync(options)`.

| Option     | Type                                  | Default    | Notes                                                  |
| ---------- | ------------------------------------- | ---------- | ------------------------------------------------------ |
| `route`    | `string`                              | `/bullpen` | Where the dashboard mounts.                            |
| `auth`     | guard / guard[] / `BullpenAuthOptions`| no auth    | See [authentication](./authentication.md).             |
| `readOnly` | `boolean`                             | `false`    | Blocks every mutation with 403.                        |
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
    readOnly: config.get('NODE_ENV') === 'production',
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
