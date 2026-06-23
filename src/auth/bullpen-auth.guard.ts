import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { isObservable, lastValueFrom } from 'rxjs';
import { BULLPEN_OPTIONS } from '../constants';
import type { ResolvedAuth, ResolvedBullpenOptions } from '../interfaces/bullpen-options.interface';

@Injectable()
export class BullpenAuthGuard implements CanActivate {
  private readonly logger = new Logger('Bullpen');
  private warnedNoAuth = false;

  constructor(
    @Inject(BULLPEN_OPTIONS) private readonly options: ResolvedBullpenOptions,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Record<string, any>>();
    const response = http.getResponse<Record<string, any>>();

    const method = String(request.method ?? 'GET').toUpperCase();
    if (!this.options.writable && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new ForbiddenException('Bullpen is read-only. Set `writable: true` to enable mutations.');
    }

    const auth: ResolvedAuth = this.options.auth ?? { type: 'none' };
    switch (auth.type) {
      case 'none':
        if (!this.warnedNoAuth) {
          this.logger.warn(
            'Bullpen has NO authentication configured. Do not expose it publicly — set `auth` in BullpenModule.forRoot().',
          );
          this.warnedNoAuth = true;
        }
        return true;
      case 'basic':
        return this.checkBasic(auth, request, response);
      case 'custom':
        if (await auth.authorize(request)) {
          return true;
        }
        throw new UnauthorizedException();
      case 'guard':
        return this.runGuards(auth.useGuard, context);
    }
  }

  private async runGuards(
    guards: Type<CanActivate>[],
    context: ExecutionContext,
  ): Promise<boolean> {
    for (const GuardClass of guards) {
      let guard: CanActivate;
      try {
        guard = this.moduleRef.get(GuardClass, { strict: false });
      } catch {
        guard = await this.moduleRef.create(GuardClass);
      }
      const outcome = guard.canActivate(context);
      const passed = isObservable(outcome) ? await lastValueFrom(outcome) : await outcome;
      if (!passed) {
        throw new UnauthorizedException();
      }
    }
    return true;
  }

  private async checkBasic(
    auth: Extract<ResolvedAuth, { type: 'basic' }>,
    request: Record<string, any>,
    response: Record<string, any>,
  ): Promise<boolean> {
    const header: unknown = request.headers?.authorization ?? request.headers?.Authorization;
    if (typeof header === 'string' && header.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      const username = separator >= 0 ? decoded.slice(0, separator) : decoded;
      const password = separator >= 0 ? decoded.slice(separator + 1) : '';
      if (await this.validateBasic(auth, username, password)) {
        return true;
      }
    }
    const realm = auth.realm ?? 'Bullpen';
    this.setHeader(response, 'WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    throw new UnauthorizedException('Authentication required.');
  }

  private async validateBasic(
    auth: Extract<ResolvedAuth, { type: 'basic' }>,
    username: string,
    password: string,
  ): Promise<boolean> {
    if (auth.validate) {
      return Boolean(await auth.validate(username, password));
    }
    const list = Array.isArray(auth.credentials)
      ? auth.credentials
      : auth.credentials
        ? [auth.credentials]
        : [];
    return list.some(
      (cred) => this.safeEqual(cred.username, username) && this.safeEqual(cred.password, password),
    );
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(String(a));
    const right = Buffer.from(String(b));
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }

  private setHeader(response: Record<string, any>, key: string, value: string): void {
    if (!response) return;
    if (typeof response.header === 'function') response.header(key, value);
    else if (typeof response.set === 'function') response.set(key, value);
    else if (typeof response.setHeader === 'function') response.setHeader(key, value);
  }
}
