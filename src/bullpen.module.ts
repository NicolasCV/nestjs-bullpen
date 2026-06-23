import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { BullpenAuthGuard } from './auth/bullpen-auth.guard';
import { BullpenMiddleware } from './bullpen.middleware';
import { BULLPEN_OPTIONS, DEFAULT_ROUTE } from './constants';
import type {
  BullpenModuleAsyncOptions,
  BullpenModuleOptions,
  ResolvedAuth,
  ResolvedBullpenOptions,
} from './interfaces/bullpen-options.interface';
import { QueueActionsService } from './services/queue-actions.service';
import { QueueDiscoveryService } from './services/queue-discovery.service';
import { QueueTopologyService } from './services/queue-topology.service';

const PROVIDERS = [
  QueueDiscoveryService,
  QueueActionsService,
  QueueTopologyService,
  BullpenAuthGuard,
  BullpenMiddleware,
];

@Module({})
export class BullpenModule implements NestModule {
  private static route: string = DEFAULT_ROUTE;

  static forRoot(options: BullpenModuleOptions = {}): DynamicModule {
    const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
    BullpenModule.route = route;
    const auth = normalizeAuth(options.auth);
    attachGuardMetadata(auth);
    const resolved: ResolvedBullpenOptions = { ...options, route, auth };
    return {
      module: BullpenModule,
      imports: [DiscoveryModule],
      providers: [{ provide: BULLPEN_OPTIONS, useValue: resolved }, ...PROVIDERS],
    };
  }

  static forRootAsync(options: BullpenModuleAsyncOptions): DynamicModule {
    const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
    BullpenModule.route = route;
    return {
      module: BullpenModule,
      imports: [DiscoveryModule, ...(options.imports ?? [])],
      providers: [
        {
          provide: BULLPEN_OPTIONS,
          useFactory: async (...args: any[]): Promise<ResolvedBullpenOptions> => {
            const userOptions = await options.useFactory(...args);
            const auth = normalizeAuth(userOptions.auth);
            attachGuardMetadata(auth);
            return { ...userOptions, route, auth };
          },
          inject: options.inject ?? [],
        },
        ...PROVIDERS,
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const route = BullpenModule.route;
    // Two entries: the exact mount (the UI shell) and a named wildcard for every sub-path
    // (the API). Express 5 / Fastify middie need the `{*path}` form for nested matches.
    consumer.apply(BullpenMiddleware).forRoutes(
      { path: route, method: RequestMethod.ALL },
      { path: `${route}/{*path}`, method: RequestMethod.ALL },
    );
  }
}

function normalizeAuth(auth: BullpenModuleOptions['auth']): ResolvedAuth {
  if (!auth) return { type: 'none' };
  if (typeof auth === 'function') return { type: 'guard', useGuard: [auth] };
  if (Array.isArray(auth)) return { type: 'guard', useGuard: auth };

  const type = String(auth.type);
  if (type === 'basic') {
    const a = auth as Record<string, any>;
    return { type: 'basic', credentials: a.credentials, validate: a.validate, realm: a.realm };
  }
  if (type === 'guard') {
    const a = auth as Record<string, any>;
    return {
      type: 'guard',
      useGuard: Array.isArray(a.useGuard) ? a.useGuard : [a.useGuard],
      metadata: a.metadata,
    };
  }
  if (type === 'custom') {
    return { type: 'custom', authorize: (auth as Record<string, any>).authorize };
  }
  return { type: 'none' };
}

function attachGuardMetadata(auth: ResolvedAuth): void {
  if (auth.type === 'guard' && auth.metadata) {
    for (const [key, value] of Object.entries(auth.metadata)) {
      Reflect.defineMetadata(key, value, BullpenMiddleware);
    }
  }
}

function normalizeRoute(route: string): string {
  let normalized = (route ?? '').trim().replace(/\/{2,}/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/+$/, '');
  return normalized || '/';
}
