import {
  CallHandler,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

// Set BULLPEN_DEMO_GLOBALS=1 to register these app-wide and prove Bullpen ignores them.

@Injectable()
export class WrapInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => ({ data, wrapped: true })));
  }
}

@Injectable()
export class HeaderGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    return ctx.switchToHttp().getRequest().headers['x-allow'] === 'yes';
  }
}

@Controller('ping')
export class PingController {
  @Get()
  ping(): string {
    return 'pong';
  }
}
