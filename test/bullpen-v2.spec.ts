import { BullpenMiddleware } from '../src/bullpen.middleware';
import { BullpenModule } from '../src/bullpen.module';
import { BULLPEN_QUEUE_METADATA, BULLPEN_OPTIONS } from '../src/constants';
import { BullpenQueue } from '../src/decorators/bullpen-queue.decorator';

class JwtGuard {
  canActivate() {
    return true;
  }
}
class RolesGuard {
  canActivate() {
    return true;
  }
}

function resolvedAuth(dm: { providers?: any[] }) {
  return (dm.providers as any[]).find((p) => p && p.provide === BULLPEN_OPTIONS).useValue.auth;
}

describe('v0.2 ergonomics', () => {
  it('accepts a single guard class as the auth shorthand', () => {
    expect(resolvedAuth(BullpenModule.forRoot({ auth: JwtGuard }))).toEqual({
      type: 'guard',
      useGuard: [JwtGuard],
      metadata: undefined,
    });
  });

  it('accepts an array of guards', () => {
    expect(resolvedAuth(BullpenModule.forRoot({ auth: [JwtGuard, RolesGuard] })).useGuard).toEqual([
      JwtGuard,
      RolesGuard,
    ]);
  });

  it('normalizes a single useGuard into an array', () => {
    const auth = resolvedAuth(
      BullpenModule.forRoot({ auth: { type: 'guard', useGuard: JwtGuard } }),
    );
    expect(auth.useGuard).toEqual([JwtGuard]);
  });

  it('attaches guard metadata (roles) to the dashboard middleware', () => {
    BullpenModule.forRoot({
      auth: { type: 'guard', useGuard: RolesGuard, metadata: { roles: ['admin'] } },
    });
    expect(Reflect.getMetadata('roles', BullpenMiddleware)).toEqual(['admin']);
  });

  it('@BullpenQueue stores presentation metadata', () => {
    @BullpenQueue({ group: 'Media', danger: true, description: 'x' })
    class P {}
    expect(Reflect.getMetadata(BULLPEN_QUEUE_METADATA, P)).toEqual({
      group: 'Media',
      danger: true,
      description: 'x',
    });
  });
});
