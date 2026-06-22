import { Inject, Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  BULLMQ_ON_QUEUE_EVENT_METADATA,
  BULLMQ_ON_WORKER_EVENT_METADATA,
  BULLMQ_PROCESSOR_METADATA,
  BULLMQ_WORKER_METADATA,
  BULLPEN_OPTIONS,
  BULLPEN_QUEUE_METADATA,
} from '../constants';
import type {
  BullpenQueueOptions,
  ResolvedBullpenOptions,
} from '../interfaces/bullpen-options.interface';
import type { QueueTopology } from '../interfaces/dto.interface';

@Injectable()
export class QueueTopologyService {
  private readonly topologies = new Map<string, QueueTopology>();
  private built = false;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(BULLPEN_OPTIONS) private readonly options: ResolvedBullpenOptions,
  ) {}

  getTopology(queueName: string): QueueTopology {
    this.ensureBuilt();
    return this.topologies.get(queueName) ?? this.empty(queueName);
  }

  /** Per-queue presentation, merging `@BullpenQueue()` metadata over the `queues` option map. */
  getMeta(queueName: string): BullpenQueueOptions {
    return { ...this.options.queues?.[queueName], ...this.getTopology(queueName).meta };
  }

  private ensureBuilt(): void {
    if (this.built) return;
    for (const wrapper of this.discovery.getProviders()) {
      const metatype = wrapper.metatype as (Function & { name?: string }) | null;
      let instance: unknown;
      try {
        instance = wrapper.instance;
      } catch {
        continue;
      }
      if (!metatype || !instance) continue;

      const processorMeta = this.reflector.get<{ name?: string }>(
        BULLMQ_PROCESSOR_METADATA,
        metatype,
      );
      if (!processorMeta) continue;

      const queueName = processorMeta.name ?? 'default';
      const workerMeta =
        this.reflector.get<{ concurrency?: number }>(BULLMQ_WORKER_METADATA, metatype) ?? {};
      const queueMeta =
        this.reflector.get<BullpenQueueOptions>(BULLPEN_QUEUE_METADATA, metatype) ?? {};

      this.topologies.set(queueName, {
        processor: metatype.name ?? null,
        concurrency: workerMeta.concurrency ?? null,
        events: this.collectEvents(instance),
        meta: queueMeta,
      });
    }
    this.built = true;
  }

  private collectEvents(instance: object): QueueTopology['events'] {
    const prototype = Object.getPrototypeOf(instance);
    const events: QueueTopology['events'] = [];
    for (const method of this.scanner.getAllMethodNames(prototype)) {
      const handler = (prototype as Record<string, unknown>)[method];
      if (typeof handler !== 'function') continue;
      const worker = this.reflector.get<{ eventName?: string }>(
        BULLMQ_ON_WORKER_EVENT_METADATA,
        handler,
      );
      if (worker?.eventName) events.push({ scope: 'worker', event: worker.eventName, handler: method });
      const queue = this.reflector.get<{ eventName?: string }>(
        BULLMQ_ON_QUEUE_EVENT_METADATA,
        handler,
      );
      if (queue?.eventName) events.push({ scope: 'queue', event: queue.eventName, handler: method });
    }
    return events;
  }

  private empty(queueName: string): QueueTopology {
    return {
      processor: null,
      concurrency: null,
      events: [],
      meta: this.options.queues?.[queueName] ?? {},
    };
  }
}
