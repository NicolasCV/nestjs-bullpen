import { QueueDiscoveryService } from '../src/services/queue-discovery.service';

function fakeQueue(name: string) {
  return { name, getJobCounts: jest.fn(), getJobs: jest.fn(), add: jest.fn() };
}

function discoveryWith(instances: unknown[]) {
  return { getProviders: () => instances.map((instance) => ({ instance })) } as any;
}

describe('QueueDiscoveryService', () => {
  it('discovers only BullMQ-shaped providers (duck-typed)', () => {
    const discovery = discoveryWith([
      fakeQueue('emails'),
      fakeQueue('media'),
      { notAQueue: true },
      undefined,
      'a string',
    ]);
    const service = new QueueDiscoveryService(discovery, {} as any);
    service.onApplicationBootstrap();
    expect(service.getQueueNames()).toEqual(['emails', 'media']);
    expect(service.getQueue('emails')).toBeDefined();
    expect(service.getQueue('nope')).toBeUndefined();
  });

  it('respects the include allow-list', () => {
    const discovery = discoveryWith([fakeQueue('emails'), fakeQueue('media')]);
    const service = new QueueDiscoveryService(discovery, { include: ['emails'] } as any);
    service.onApplicationBootstrap();
    expect(service.getQueueNames()).toEqual(['emails']);
  });

  it('respects the exclude deny-list', () => {
    const discovery = discoveryWith([fakeQueue('emails'), fakeQueue('media')]);
    const service = new QueueDiscoveryService(discovery, { exclude: ['media'] } as any);
    service.onApplicationBootstrap();
    expect(service.getQueueNames()).toEqual(['emails']);
  });

  it('skips providers whose instance getter throws', () => {
    const throwing = {
      get instance() {
        throw new Error('not resolvable');
      },
    };
    const discovery = { getProviders: () => [throwing, { instance: fakeQueue('ok') }] } as any;
    const service = new QueueDiscoveryService(discovery, {} as any);
    expect(() => service.onApplicationBootstrap()).not.toThrow();
    expect(service.getQueueNames()).toEqual(['ok']);
  });
});
