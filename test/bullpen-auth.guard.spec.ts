import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { BullpenAuthGuard } from '../src/auth/bullpen-auth.guard';
import type { BullpenModuleOptions } from '../src/interfaces/bullpen-options.interface';

function ctx(req: any, res: any = {}): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as any;
}

function makeGuard(options: BullpenModuleOptions, moduleRef: any = {}) {
  return new BullpenAuthGuard(options, moduleRef);
}

const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

describe('BullpenAuthGuard', () => {
  it('allows all requests when auth is none', async () => {
    const guard = makeGuard({ auth: { type: 'none' } });
    await expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).resolves.toBe(true);
  });

  it('blocks mutations in read-only mode but allows reads', async () => {
    const guard = makeGuard({ readOnly: true, auth: { type: 'none' } });
    await expect(guard.canActivate(ctx({ method: 'POST', headers: {} }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).resolves.toBe(true);
  });

  describe('basic auth', () => {
    const options: BullpenModuleOptions = {
      auth: { type: 'basic', credentials: { username: 'admin', password: 's3cret' } },
    };

    it('accepts valid credentials', async () => {
      const guard = makeGuard(options);
      const req = { method: 'GET', headers: { authorization: basic('admin', 's3cret') } };
      await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    });

    it('rejects wrong credentials and challenges with WWW-Authenticate', async () => {
      const guard = makeGuard(options);
      const res = { setHeader: jest.fn() };
      const req = { method: 'GET', headers: { authorization: basic('admin', 'nope') } };
      await expect(guard.canActivate(ctx(req, res))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(res.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Basic realm='),
      );
    });

    it('challenges when the header is absent (fastify-style reply.header)', async () => {
      const guard = makeGuard(options);
      const res = { header: jest.fn() };
      await expect(
        guard.canActivate(ctx({ method: 'GET', headers: {} }, res)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(res.header).toHaveBeenCalled();
    });

    it('supports a custom validate function', async () => {
      const validate = jest.fn().mockResolvedValue(true);
      const guard = makeGuard({ auth: { type: 'basic', validate } });
      const req = { method: 'GET', headers: { authorization: basic('x', 'y') } };
      await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
      expect(validate).toHaveBeenCalledWith('x', 'y');
    });
  });

  it('supports a custom authorize predicate', async () => {
    const yes = makeGuard({ auth: { type: 'custom', authorize: () => true } });
    await expect(yes.canActivate(ctx({ method: 'GET', headers: {} }))).resolves.toBe(true);
    const no = makeGuard({ auth: { type: 'custom', authorize: () => false } });
    await expect(no.canActivate(ctx({ method: 'GET', headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('delegates to an existing NestJS guard', async () => {
    class JwtGuard {
      canActivate() {
        return true;
      }
    }
    const moduleRef = { get: jest.fn(() => new JwtGuard()), create: jest.fn() };
    const guard = makeGuard({ auth: { type: 'guard', useGuard: JwtGuard as any } }, moduleRef);
    await expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).resolves.toBe(true);
    expect(moduleRef.get).toHaveBeenCalledWith(JwtGuard, { strict: false });
  });

  it('rejects when the delegated guard denies', async () => {
    class DenyGuard {
      canActivate() {
        return false;
      }
    }
    const moduleRef = { get: jest.fn(() => new DenyGuard()), create: jest.fn() };
    const guard = makeGuard({ auth: { type: 'guard', useGuard: DenyGuard as any } }, moduleRef);
    await expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
