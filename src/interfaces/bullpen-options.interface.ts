import type { CanActivate, Type } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';
import type { BullpenAuthType } from '../constants';

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

export type GuardClass = Type<CanActivate>;
export type GuardOrGuards = GuardClass | GuardClass[];

/**
 * Authentication strategy. Use the built-in basic prompt, delegate to any existing NestJS
 * guard(s), or supply a custom predicate. `type` accepts the `BullpenAuthType` enum or its string.
 */
export type BullpenAuthOptions =
  | { type: BullpenAuthType.None | 'none' }
  | {
      type: BullpenAuthType.Basic | 'basic';
      credentials?: BasicAuthCredentials | BasicAuthCredentials[];
      validate?: (username: string, password: string) => boolean | Promise<boolean>;
      realm?: string;
    }
  | {
      type: BullpenAuthType.Guard | 'guard';
      /** One guard or a chain (all must pass). */
      useGuard: GuardOrGuards;
      /** Metadata attached to the dashboard controller so reflector guards (e.g. RolesGuard) resolve, e.g. `{ roles: ['admin'] }`. */
      metadata?: Record<string, unknown>;
    }
  | {
      type: BullpenAuthType.Custom | 'custom';
      authorize: (request: unknown) => boolean | Promise<boolean>;
    };

/** Per-queue presentation, set via `@BullpenQueue()` or the `queues` option map. */
export interface BullpenQueueOptions {
  description?: string;
  group?: string;
  readOnly?: boolean;
  danger?: boolean;
  /** Default BullMQ job options (retention/retry) applied to jobs added from the dashboard. */
  defaultJobOptions?: JobsOptions;
}

export interface BullpenModuleOptions {
  /** Mount path for the dashboard. Default: `/bullpen`. */
  route?: string;
  /**
   * Authentication. Pass a guard class (or array) directly for the quickest setup, or a full
   * `BullpenAuthOptions` object. Default: no auth (logs a dev-only warning).
   */
  auth?: BullpenAuthOptions | GuardOrGuards;
  /** Block every mutating endpoint (retry/remove/promote/pause/resume/clean) with 403. Default: `false`. */
  readOnly?: boolean;
  /** Only expose these queues (by name). Default: every discovered queue. */
  include?: string[];
  /** Hide these queues (by name). */
  exclude?: string[];
  /** Per-queue presentation for queues without a `@BullpenQueue()`-decorated processor. */
  queues?: Record<string, BullpenQueueOptions>;
  /** Default BullMQ job options (retention/retry) for jobs added from the dashboard. Per-queue overrides this. */
  defaultJobOptions?: JobsOptions;
  /** Dashboard title. Default: `Bullpen`. */
  title?: string;
  /** Default UI theme. Default: `dark`. */
  theme?: 'dark' | 'light';
}

export interface BullpenModuleAsyncOptions {
  /** Mount path. Must be static (resolved synchronously so the route can be registered). Default: `/bullpen`. */
  route?: string;
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => BullpenModuleOptions | Promise<BullpenModuleOptions>;
}

/** Internal canonical auth shape consumed by the guard after the module normalizes user input. */
export type ResolvedAuth =
  | { type: 'none' }
  | {
      type: 'basic';
      credentials?: BasicAuthCredentials | BasicAuthCredentials[];
      validate?: (username: string, password: string) => boolean | Promise<boolean>;
      realm?: string;
    }
  | { type: 'guard'; useGuard: GuardClass[]; metadata?: Record<string, unknown> }
  | { type: 'custom'; authorize: (request: unknown) => boolean | Promise<boolean> };

/** Options after the module has normalized `auth`. Stored under the BULLPEN_OPTIONS token. */
export interface ResolvedBullpenOptions extends Omit<BullpenModuleOptions, 'auth'> {
  route: string;
  auth: ResolvedAuth;
}
