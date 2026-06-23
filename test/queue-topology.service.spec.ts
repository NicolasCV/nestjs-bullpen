import { MetadataScanner, Reflector } from '@nestjs/core';
import {
  BULLMQ_ON_WORKER_EVENT_METADATA,
  BULLMQ_PROCESSOR_METADATA,
  BULLMQ_WORKER_METADATA,
  BULLPEN_QUEUE_METADATA,
} from '../src/constants';
import { QueueTopologyService } from '../src/services/queue-topology.service';

class DemoProcessor {
  onCompleted() {}
  onFailed() {}
}
Reflect.defineMetadata(BULLMQ_PROCESSOR_METADATA, { name: 'emails' }, DemoProcessor);
Reflect.defineMetadata(BULLMQ_WORKER_METADATA, { concurrency: 5 }, DemoProcessor);
Reflect.defineMetadata(
  BULLPEN_QUEUE_METADATA,
  { group: 'Comms', description: 'mail' },
  DemoProcessor,
);
Reflect.defineMetadata(
  BULLMQ_ON_WORKER_EVENT_METADATA,
  { eventName: 'completed' },
  DemoProcessor.prototype.onCompleted,
);
Reflect.defineMetadata(
  BULLMQ_ON_WORKER_EVENT_METADATA,
  { eventName: 'failed' },
  DemoProcessor.prototype.onFailed,
);

function makeService(options: any = { queues: {} }) {
  const discovery = {
    getProviders: () => [{ instance: new DemoProcessor(), metatype: DemoProcessor }],
  } as any;
  return new QueueTopologyService(discovery, new MetadataScanner(), new Reflector(), options);
}

describe('QueueTopologyService', () => {
  it('maps a queue to its processor class, concurrency, and worker events', () => {
    const topology = makeService().getTopology('emails');
    expect(topology.processor).toBe('DemoProcessor');
    expect(topology.concurrency).toBe(5);
    expect(topology.meta).toEqual({ group: 'Comms', description: 'mail' });
    expect(topology.events).toEqual(
      expect.arrayContaining([
        { scope: 'worker', event: 'completed', handler: 'onCompleted' },
        { scope: 'worker', event: 'failed', handler: 'onFailed' },
      ]),
    );
  });

  it('returns empty topology for an unknown queue, falling back to the queues option', () => {
    const service = makeService({
      queues: {
        reports: {
          group: 'Analytics',
          readOnly: true,
          defaultJobOptions: { removeOnComplete: { count: 10 } },
        },
      },
    });
    const topology = service.getTopology('reports');
    expect(topology.processor).toBeNull();
    expect(topology.events).toEqual([]);
    expect(service.getMeta('reports')).toEqual({
      group: 'Analytics',
      readOnly: true,
      defaultJobOptions: { removeOnComplete: { count: 10 } },
    });
  });
});
