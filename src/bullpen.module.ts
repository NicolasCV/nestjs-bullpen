import { DynamicModule, Module } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule } from '@nestjs/core';
import { BullpenAuthGuard } from './auth/bullpen-auth.guard';
import { BullpenController } from './bullpen.controller';
import { BULLPEN_OPTIONS, DEFAULT_ROUTE } from './constants';
import type {
  BullpenModuleAsyncOptions,
  BullpenModuleOptions,
} from './interfaces/bullpen-options.interface';
import { QueueActionsService } from './services/queue-actions.service';
import { QueueDiscoveryService } from './services/queue-discovery.service';

@Module({})
export class BullpenModule {
  static forRoot(options: BullpenModuleOptions = {}): DynamicModule {
    const route = normalizeRoute(options.route ?? DEFAULT_ROUTE);
    Reflect.defineMetadata(PATH_METADATA, route, BullpenController);
    return {
      module: BullpenModule,
      imports: [DiscoveryModule],
      controllers: [BullpenController],
      providers: [
        { provide: BULLPEN_OPTIONS, useValue: { ...options, route } },
        QueueDiscoveryService,
        QueueActionsService,
        BullpenAuthGuard,
      ],
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
          useFactory: async (...args: any[]) => {
            const resolved = await options.useFactory(...args);
            return { ...resolved, route };
          },
          inject: options.inject ?? [],
        },
        QueueDiscoveryService,
        QueueActionsService,
        BullpenAuthGuard,
      ],
    };
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
