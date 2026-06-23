import {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { BullpenAuthGuard } from './auth/bullpen-auth.guard';
import { BULLPEN_OPTIONS, DEFAULT_TITLE, JOB_STATUSES, JobStatus } from './constants';
import type { ResolvedBullpenOptions } from './interfaces/bullpen-options.interface';
import type { QueueSummary } from './interfaces/dto.interface';
import { QueueActionsService } from './services/queue-actions.service';
import { QueueDiscoveryService } from './services/queue-discovery.service';
import { QueueTopologyService } from './services/queue-topology.service';

type Req = Record<string, any>;
type Res = Record<string, any>;

/**
 * Bullpen runs as middleware, not a controller, on purpose: middleware executes BEFORE the host
 * app's global guards and interceptors, so the dashboard always returns raw HTML/JSON (never wrapped
 * by a response interceptor) and is protected ONLY by its own configured guard.
 */
@Injectable()
export class BullpenMiddleware implements NestMiddleware {
  private cachedUi: string | null = null;

  constructor(
    @Inject(BULLPEN_OPTIONS) private readonly options: ResolvedBullpenOptions,
    private readonly actions: QueueActionsService,
    private readonly discovery: QueueDiscoveryService,
    private readonly topology: QueueTopologyService,
    private readonly authGuard: BullpenAuthGuard,
  ) {}

  async use(req: Req, res: Res, next: (err?: unknown) => void): Promise<void> {
    const base = this.options.route;
    const path = String(req.originalUrl ?? req.url ?? '').split('?')[0];
    const prefix = base.endsWith('/') ? base : `${base}/`;
    if (path !== base && !path.startsWith(prefix)) {
      return next();
    }

    try {
      await this.authGuard.canActivate(this.context(req, res));
    } catch (err) {
      return this.fail(res, err);
    }

    try {
      await this.dispatch(req, res, path.slice(base.length) || '/');
    } catch (err) {
      this.fail(res, err);
    }
  }

  private context(req: Req, res: Res): ExecutionContext {
    const handler = () => undefined;
    return {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res, getNext: () => undefined }),
      getType: () => 'http',
      getClass: () => BullpenMiddleware as never,
      getHandler: () => handler as never,
      getArgs: () => [req, res] as never,
      getArgByIndex: (i: number) => [req, res][i],
      switchToRpc: () => ({}) as never,
      switchToWs: () => ({}) as never,
    } as ExecutionContext;
  }

  private async dispatch(req: Req, res: Res, sub: string): Promise<void> {
    const method = String(req.method ?? 'GET').toUpperCase();
    const path = sub === '/' ? '/' : sub.replace(/\/+$/, '');
    const seg = path.split('/').filter(Boolean);
    const query = new URL(req.url ?? sub, 'http://localhost').searchParams;

    if (method === 'GET' && (path === '/' || path === '')) {
      return this.html(res, this.renderShell(this.basePath(req)));
    }
    if (seg[0] !== 'api') return this.notFound(res);

    if (method === 'GET' && seg[1] === 'meta' && seg.length === 2) {
      return this.json(res, this.meta());
    }
    if (method === 'GET' && seg[1] === 'stream' && seg.length === 2) {
      return this.stream(req, res);
    }
    if (seg[1] !== 'queues') return this.notFound(res);

    const name = seg[2] ? decodeURIComponent(seg[2]) : undefined;

    if (method === 'GET' && seg.length === 2) {
      return this.json(res, await this.enrichedQueues());
    }
    if (!name) return this.notFound(res);

    if (seg.length === 3 && method === 'GET') {
      return this.json(res, this.enrich(await this.actions.getQueueSummary(name)));
    }

    const tail = seg[3];
    if (seg.length === 4 && method === 'GET' && tail === 'topology') {
      if (!this.discovery.getQueue(name)) return this.notFound(res, `Queue "${name}" not found`);
      const queue = this.discovery.getQueue(name) as { opts?: { defaultJobOptions?: unknown } };
      return this.json(res, {
        ...this.topology.getTopology(name),
        defaultJobOptions: queue.opts?.defaultJobOptions ?? null,
      });
    }
    if (seg.length === 4 && method === 'GET' && tail === 'export') {
      return this.json(
        res,
        await this.actions.exportJobs(name, this.status(query.get('status')), clampInt(query.get('limit'), 1000, 1, 5000)),
      );
    }
    if (seg.length === 4 && method === 'GET' && tail === 'jobs') {
      const size = clampInt(query.get('pageSize'), 25, 1, 100);
      const page = clampInt(query.get('page'), 0, 0, 1_000_000);
      return this.json(
        res,
        await this.actions.listJobs(name, this.status(query.get('status')), page * size, page * size + size - 1),
      );
    }
    if (seg.length === 5 && method === 'GET' && tail === 'jobs') {
      return this.json(res, await this.actions.getJob(name, decodeURIComponent(seg[4])));
    }

    // ---- mutations (global writable already enforced by the guard) ----
    if (method === 'POST' && seg.length === 4 && tail === 'jobs') {
      this.assertQueueWritable(name);
      const body = await readBody(req);
      const opts = {
        ...this.options.defaultJobOptions,
        ...this.topology.getMeta(name).defaultJobOptions,
        ...body.opts,
      };
      return this.json(res, { ok: true, ...(await this.actions.addJob(name, body.name ?? 'job', body.data, opts)) });
    }
    if (method === 'POST' && seg.length === 4 && (tail === 'pause' || tail === 'resume')) {
      this.assertQueueWritable(name);
      await (tail === 'pause' ? this.actions.pauseQueue(name) : this.actions.resumeQueue(name));
      return this.json(res, { ok: true });
    }
    if (method === 'POST' && seg.length === 4 && tail === 'clean') {
      this.assertQueueWritable(name);
      const body = await readBody(req);
      const removed = await this.actions.cleanQueue(
        name,
        this.status(body.status),
        typeof body.grace === 'number' ? body.grace : 0,
        typeof body.limit === 'number' ? body.limit : 1000,
      );
      return this.json(res, { ok: true, removed });
    }
    if (method === 'POST' && seg.length === 4 && tail === 'bulk') {
      this.assertQueueWritable(name);
      const body = await readBody(req);
      return this.json(res, {
        ok: true,
        ...(await this.actions.bulkAction(name, body.action === 'promote' ? 'promote' : 'retry', this.status(body.status), 1000)),
      });
    }
    if (seg.length === 6 && method === 'POST' && tail === 'jobs') {
      this.assertQueueWritable(name);
      const id = decodeURIComponent(seg[4]);
      const action = seg[5];
      if (action === 'retry') await this.actions.retryJob(name, id);
      else if (action === 'promote') await this.actions.promoteJob(name, id);
      else return this.notFound(res);
      return this.json(res, { ok: true });
    }
    if (seg.length === 5 && method === 'DELETE' && tail === 'jobs') {
      this.assertQueueWritable(name);
      await this.actions.removeJob(name, decodeURIComponent(seg[4]));
      return this.json(res, { ok: true });
    }

    return this.notFound(res);
  }

  private meta() {
    return {
      title: this.options.title ?? DEFAULT_TITLE,
      theme: this.options.theme ?? 'dark',
      readOnly: !this.options.writable,
      live: true,
      queues: this.discovery.getQueueNames(),
      statuses: JOB_STATUSES,
    };
  }

  private async enrichedQueues(): Promise<QueueSummary[]> {
    return (await this.actions.listQueues()).map((summary) => this.enrich(summary));
  }

  private enrich(summary: QueueSummary): QueueSummary {
    const topology = this.topology.getTopology(summary.name);
    const meta = { ...this.options.queues?.[summary.name], ...topology.meta };
    return {
      ...summary,
      group: meta.group ?? null,
      description: meta.description ?? null,
      readOnly: Boolean(meta.readOnly),
      danger: Boolean(meta.danger),
      processor: topology.processor,
      concurrency: topology.concurrency,
    };
  }

  private assertQueueWritable(name: string): void {
    if (this.topology.getMeta(name).readOnly) {
      throw new ForbiddenException(`Queue "${name}" is read-only.`);
    }
  }

  private status(value: string | null | undefined): JobStatus {
    return (JOB_STATUSES as readonly string[]).includes(value ?? '')
      ? (value as JobStatus)
      : (JOB_STATUSES[1] as JobStatus);
  }

  private stream(req: Req, res: Res): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const tick = async () => {
      try {
        res.write(`data: ${JSON.stringify(await this.enrichedQueues())}\n\n`);
      } catch {
        /* client gone */
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 2000);
    const stop = () => clearInterval(interval);
    req.on?.('close', stop);
    res.on?.('close', stop);
  }

  private basePath(req: Req): string {
    return String(req.originalUrl ?? req.url ?? '').split('?')[0].replace(/\/+$/, '') || '/';
  }

  private renderShell(basePath: string): string {
    const config = {
      basePath,
      title: this.options.title ?? DEFAULT_TITLE,
      theme: this.options.theme ?? 'dark',
      readOnly: !this.options.writable,
      statuses: JOB_STATUSES,
    };
    const snippet = `<script>window.__BULLPEN__=${JSON.stringify(config).replace(/</g, '\\u003c')}</script>`;
    const html = this.loadUi();
    return html.includes('<!--BULLPEN_CONFIG-->')
      ? html.replace('<!--BULLPEN_CONFIG-->', snippet)
      : html.replace('</head>', `${snippet}</head>`);
  }

  private loadUi(): string {
    if (this.cachedUi !== null) return this.cachedUi;
    for (const candidate of [join(__dirname, 'ui', 'index.html'), join(__dirname, '..', 'ui', 'dist', 'index.html')]) {
      if (existsSync(candidate)) {
        this.cachedUi = readFileSync(candidate, 'utf8');
        return this.cachedUi;
      }
    }
    this.cachedUi = FALLBACK_HTML;
    return this.cachedUi;
  }

  private html(res: Res, body: string): void {
    if (res.headersSent) return;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(body);
  }

  private json(res: Res, body: unknown, status = 200): void {
    if (res.headersSent) return;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }

  private notFound(res: Res, message = 'Not found'): void {
    this.json(res, { statusCode: 404, message }, 404);
  }

  private fail(res: Res, err: unknown): void {
    if (res.headersSent) return;
    let status = 500;
    let body: unknown = { statusCode: 500, message: 'Internal error' };
    if (err instanceof HttpException) {
      status = err.getStatus();
      const response = err.getResponse();
      body = typeof response === 'string' ? { statusCode: status, message: response } : response;
    }
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  }
}

function clampInt(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readBody(req: Req): Promise<Record<string, any>> {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    let done = false;
    const finish = (value: Record<string, any>) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    if (typeof req.on !== 'function') return finish({});
    req.on('data', (chunk: unknown) => {
      raw += chunk;
      if (raw.length > 1_000_000) finish({});
    });
    req.on('end', () => {
      try {
        finish(raw ? JSON.parse(raw) : {});
      } catch {
        finish({});
      }
    });
    req.on('error', () => finish({}));
    setTimeout(() => finish((req.body as Record<string, any>) ?? {}), 1500);
  });
}

const FALLBACK_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bullpen</title><!--BULLPEN_CONFIG--></head><body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0b0d12;color:#e6e9ef;padding:24px"><h1 style="margin:0 0 4px">Bullpen</h1><p style="color:#8b93a7;margin:0 0 16px">UI bundle not built yet — showing raw queue data from the API.</p><pre id="out" style="background:#11141c;border:1px solid #1f2533;border-radius:8px;padding:16px;overflow:auto">loading…</pre><script>(function(){var cfg=window.__BULLPEN__||{basePath:''};fetch(cfg.basePath+'/api/queues').then(function(r){return r.json()}).then(function(d){document.getElementById('out').textContent=JSON.stringify(d,null,2)}).catch(function(e){document.getElementById('out').textContent='error: '+e})})();</script></body></html>`;
