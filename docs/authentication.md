# Authentication

Bullpen is guarded by a single `CanActivate`. There are four ways to configure it. Mutations are also off by default (see [read-only](#read-only-by-default)).

## Quickest: hand it a guard

Any guard you already use works as a one-liner:

```ts
BullpenModule.forRoot({ auth: JwtAuthGuard });
BullpenModule.forRoot({ auth: [JwtAuthGuard, RolesGuard] }); // all must pass
```

## Roles and companion decorators

Guards like a `RolesGuard` read metadata that a decorator (`@Roles('admin')`) normally sets. Since you don't own Bullpen's controller, pass that metadata through `auth.metadata`. Bullpen attaches it to the dashboard controller so the guard resolves it:

```ts
BullpenModule.forRoot({
  auth: { type: 'guard', useGuard: RolesGuard, metadata: { roles: ['admin'] } },
});
```

## Recipe: JWT plus a RolesGuard

A full copy-paste setup: verify a Bearer token, attach the decoded user to the request, then check that user's roles against the ones you require for the dashboard. Both guards are plain `CanActivate` classes that you own. `@nestjs/jwt` is a companion you already have in a JWT app; Bullpen does not add it.

The first guard verifies the token and puts the user on the request:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string = request.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    try {
      request.user = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
```

The second guard reads the roles you passed through `auth.metadata` and compares them against `request.user.roles`. Bullpen writes each `metadata` entry under its own key (so `metadata: { roles: [...] }` is stored under the key `roles`) on the dashboard controller class, which is what the reflector reads here:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('roles', context.getClass());
    if (!required?.length) {
      return true;
    }
    const userRoles: string[] = context.switchToHttp().getRequest().user?.roles ?? [];
    const ok = required.some((role) => userRoles.includes(role));
    if (!ok) {
      throw new ForbiddenException();
    }
    return ok;
  }
}
```

Wire both guards and the required roles into `forRoot`. The guards run in order, so `JwtAuthGuard` populates `request.user` before `RolesGuard` reads it:

```ts
BullpenModule.forRoot({
  auth: {
    type: 'guard',
    useGuard: [JwtAuthGuard, RolesGuard],
    metadata: { roles: ['admin'] },
  },
});
```

Both guard classes must be resolvable: register them as providers (or import the module that does) so Nest can inject `JwtService` and `Reflector`. The guard-array shorthand (`auth: [JwtAuthGuard, RolesGuard]`) is the quickest form, but it has no place for `metadata`, so use the full object above when a guard needs roles.

This works because Bullpen runs only the guard(s) you hand it: a global `APP_GUARD` never applies to the dashboard, since the dashboard is served from middleware that runs before global guards. Bullpen attaches your `metadata` to the dashboard controller, so a reflector-based `RolesGuard` resolves its required roles from `context.getClass()` even though you do not own the controller or write an `@Roles()` decorator on it.

## HTTP basic

```ts
BullpenModule.forRoot({
  auth: {
    type: 'basic',
    credentials: [{ username: 'admin', password: 'secret' }],
    // or: validate: async (user, pass) => userService.check(user, pass),
  },
});
```

## Custom predicate

```ts
BullpenModule.forRoot({
  auth: { type: 'custom', authorize: (req) => Boolean((req as any).user?.isAdmin) },
});
```

## None (development only)

The default. Bullpen logs a warning at startup; don't ship it.

## Read-only by default

The dashboard does not allow mutations until you opt in. Every mutating endpoint (retry/remove/promote/pause/resume/clean/add) returns 403 and the write controls are hidden in the UI unless you set `writable: true` in `forRoot`. Even with writes enabled, you can lock individual queues with `@BullpenQueue({ readOnly: true })` or the `queues` map.

> Note on real-time updates: the live stream uses `EventSource`, which can't send custom headers. With header/token guards the stream falls back to polling automatically. Counts stay live either way.
