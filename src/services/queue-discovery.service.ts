import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Queue } from 'bullmq';
import { BULLPEN_OPTIONS } from '../constants';
import type { ResolvedBullpenOptions } from '../interfaces/bullpen-options.interface';

@Injectable()
export class QueueDiscoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Bullpen');
  private readonly queues = new Map<string, Queue>();

  constructor(
    private readonly discovery: DiscoveryService,
    @Inject(BULLPEN_OPTIONS) private readonly options: ResolvedBullpenOptions,
  ) {}

  onApplicationBootstrap(): void {
    const { include, exclude } = this.options;
    for (const wrapper of this.discovery.getProviders()) {
      let instance: unknown;
      try {
        instance = wrapper.instance;
      } catch {
        continue;
      }
      if (!this.isQueue(instance)) {
        continue;
      }
      const name = instance.name;
      if (!name) continue;
      if (include && !include.includes(name)) continue;
      if (exclude && exclude.includes(name)) continue;
      this.queues.set(name, instance);
    }

    if (this.queues.size === 0) {
      this.logger.warn(
        'No BullMQ queues discovered. Register queues with @nestjs/bullmq in a module loaded by your app.',
      );
    } else {
      this.logger.log(`Discovered ${this.queues.size} queue(s): ${this.getQueueNames().join(', ')}`);
    }
  }

  getQueueNames(): string[] {
    return [...this.queues.keys()].sort();
  }

  getQueues(): Queue[] {
    return [...this.queues.values()];
  }

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  private isQueue(instance: unknown): instance is Queue {
    if (instance instanceof Queue) {
      return true;
    }
    // Duck-type fallback guards against a duplicated `bullmq` in the dependency tree
    // where `instanceof` would fail across module realms.
    const candidate = instance as Record<string, unknown> | null;
    return (
      !!candidate &&
      typeof candidate.name === 'string' &&
      typeof candidate.getJobCounts === 'function' &&
      typeof candidate.getJobs === 'function' &&
      typeof candidate.add === 'function'
    );
  }
}
