import { PATH_METADATA } from '@nestjs/common/constants';
import { BullpenController } from '../src/bullpen.controller';
import { BullpenModule } from '../src/bullpen.module';
import { BULLPEN_OPTIONS } from '../src/constants';

function optionProvider(dm: { providers?: any[] }) {
  return (dm.providers as any[]).find((p) => p && p.provide === BULLPEN_OPTIONS);
}

describe('BullpenModule', () => {
  it('forRoot normalizes the route onto the controller and wires providers', () => {
    const dm = BullpenModule.forRoot({ route: 'admin/queues/' });
    expect(Reflect.getMetadata(PATH_METADATA, BullpenController)).toBe('/admin/queues');
    expect(dm.controllers).toContain(BullpenController);
    expect(optionProvider(dm).useValue.route).toBe('/admin/queues');
  });

  it('forRoot defaults the route to /bullpen', () => {
    BullpenModule.forRoot();
    expect(Reflect.getMetadata(PATH_METADATA, BullpenController)).toBe('/bullpen');
  });

  it('forRootAsync exposes an async options factory and pins the route', async () => {
    const dm = BullpenModule.forRootAsync({ route: '/q', useFactory: () => ({ readOnly: true }) });
    expect(Reflect.getMetadata(PATH_METADATA, BullpenController)).toBe('/q');
    const resolved = await optionProvider(dm).useFactory();
    expect(resolved).toEqual({ readOnly: true, route: '/q', auth: { type: 'none' } });
  });
});
