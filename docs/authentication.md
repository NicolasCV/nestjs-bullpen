# Authentication

Bullpen is guarded by a single `CanActivate`. There are four ways to configure it, plus a read-only switch.

## Quickest: hand it a guard

Any guard you already use works as a one-liner:

```ts
BullpenModule.forRoot({ auth: JwtAuthGuard });
BullpenModule.forRoot({ auth: [JwtAuthGuard, RolesGuard] }); // all must pass
```

## Roles and companion decorators

Guards like a `RolesGuard` read metadata that a decorator (`@Roles('admin')`) normally sets. Since you don't own Bullpen's controller, pass that metadata through `auth.metadata` — Bullpen attaches it to the dashboard controller so the guard resolves it:

```ts
BullpenModule.forRoot({
  auth: { type: 'guard', useGuard: RolesGuard, metadata: { roles: ['admin'] } },
});
```

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

## Read-only

`readOnly: true` blocks every mutation (retry/remove/promote/pause/resume/clean/add) with a 403, app-wide. You can also make a single queue read-only with `@BullpenQueue({ readOnly: true })` or the `queues` map.

> Note on real-time updates: the live stream uses `EventSource`, which can't send custom headers. With header/token guards the stream falls back to polling automatically — counts stay live either way.
