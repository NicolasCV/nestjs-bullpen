import { DynamicModule, Module } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule } from '@nestjs/core';
import { BullpenAuthGuard } from './auth/bullpen-auth.guard';
import { BullpenController } from './bullpen.controller';
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
];

@Module({})
export class BullpenModule {
  static forRoot(options: BullpenModuleOptions = {}): DynamicModule {
    const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
    const auth = normalizeAuth(options.auth);
    Reflect.defineMetadata(PATH_METADATA, route, BullpenController);
    attachGuardMetadata(auth);
    const resolved: ResolvedBullpenOptions = { ...options, route, auth };
    return {
      module: BullpenModule,
      imports: [DiscoveryModule],
      controllers: [BullpenController],
      providers: [{ provide: BULLPEN_OPTIONS, useValue: resolved }, ...PROVIDERS],
    };
  }

  static forRootAsync(options: BullpenModuleAsyncOptions): DynamicModule {
    const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
    Reflect.defineMetadata(PATH_METADATA, route, BullpenController);
    return {
      module: BullpenModule,
      imports: [DiscoveryModule, ...(options.imports ?? [])],
      controllers: [BullpenController],
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
}

function normalizeAuth(auth: BullpenModuleOptions['auth']): ResolvedAuth {
  if (!auth) return { type: 'none' };
  if (typeof auth === 'function') return { type: 'guard', useGuard: [auth] };
  if (Array.isArray(auth)) return { type: 'guard', useGuard: auth };

  const type = String(auth.type);
  if (type === 'basic') {
    const a = auth as Extract<typeof auth, { type: 'basic' | any }> & Record<string, any>;
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
      Reflect.defineMetadata(key, value, BullpenController);
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
