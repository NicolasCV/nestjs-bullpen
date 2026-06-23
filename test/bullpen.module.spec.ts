import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { BullpenMiddleware } from '../src/bullpen.middleware';
import { BullpenModule } from '../src/bullpen.module';
import { BULLPEN_OPTIONS } from '../src/constants';

function optionProvider(dm: { providers?: any[] }) {
  return (dm.providers as any[]).find((p) => p && p.provide === BULLPEN_OPTIONS);
}

describe('BullpenModule', () => {
  it('forRoot normalizes the route and wires the middleware provider', () => {
    const dm = BullpenModule.forRoot({ route: 'admin/queues/' });
    expect(optionProvider(dm).useValue.route).toBe('/admin/queues');
    expect(dm.providers).toContain(BullpenMiddleware);
    expect(dm.controllers).toBeUndefined();
  });

  it('forRoot defaults the route to /bullpen', () => {
    const dm = BullpenModule.forRoot();
    expect(optionProvider(dm).useValue.route).toBe('/bullpen');
  });

  it('forRootAsync exposes an async options factory and pins the route', async () => {
    const dm = BullpenModule.forRootAsync({ route: '/q', useFactory: () => ({ writable: true }) });
    const resolved = await optionProvider(dm).useFactory();
    expect(resolved).toEqual({ writable: true, route: '/q', auth: { type: 'none' } });
  });

  it('mounts the middleware on the configured route (not a controller)', () => {
    BullpenModule.forRoot({ route: '/admin/queues' });
    const applied: any[] = [];
    const routes: any[] = [];
    const consumer = {
      apply: (...mw: any[]) => {
        applied.push(...mw);
        return { forRoutes: (...r: any[]) => routes.push(...r) };
      },
    } as unknown as MiddlewareConsumer;
    new BullpenModule().configure(consumer);
    expect(applied).toContain(BullpenMiddleware);
    expect(routes).toContainEqual({ path: '/admin/queues', method: RequestMethod.ALL });
    expect(routes).toContainEqual({ path: '/admin/queues/{*path}', method: RequestMethod.ALL });
  });
});
