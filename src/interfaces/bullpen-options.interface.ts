import type { CanActivate, Type } from '@nestjs/common';

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

/**
 * Authentication strategy for the dashboard. Pick the one that matches your app —
 * a built-in basic prompt, any existing NestJS guard (JWT/session/...), or a custom predicate.
 */
export type BullpenAuthOptions =
  | { type: 'none' }
  | {
      type: 'basic';
      credentials?: BasicAuthCredentials | BasicAuthCredentials[];
      validate?: (username: string, password: string) => boolean | Promise<boolean>;
      realm?: string;
    }
  | { type: 'guard'; useGuard: Type<CanActivate> }
  | { type: 'custom'; authorize: (request: unknown) => boolean | Promise<boolean> };

export interface BullpenModuleOptions {
  /** Mount path for the dashboard. Default: `/bullpen`. */
  route?: string;
  /** Auth strategy. Default: `{ type: 'none' }` (logs a dev-only warning). */
  auth?: BullpenAuthOptions;
  /** Block every mutating endpoint (retry/remove/promote/pause/resume/clean) with 403. Default: `false`. */
  readOnly?: boolean;
  /** Only expose these queues (by name). Default: every discovered queue. */
  include?: string[];
  /** Hide these queues (by name). */
  exclude?: string[];
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
