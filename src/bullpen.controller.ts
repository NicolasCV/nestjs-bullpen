import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Observable, from, interval, map, startWith, switchMap } from 'rxjs';
import { BullpenAuthGuard } from './auth/bullpen-auth.guard';
import { BULLPEN_OPTIONS, DEFAULT_TITLE, JOB_STATUSES, JobStatus } from './constants';
import type { ResolvedBullpenOptions } from './interfaces/bullpen-options.interface';
import type { QueueSummary } from './interfaces/dto.interface';
import { QueueActionsService } from './services/queue-actions.service';
import { QueueDiscoveryService } from './services/queue-discovery.service';
import { QueueTopologyService } from './services/queue-topology.service';

@UseGuards(BullpenAuthGuard)
@Controller()
export class BullpenController {
  private cachedUi: string | null = null;

  constructor(
    private readonly actions: QueueActionsService,
    private readonly discovery: QueueDiscoveryService,
    private readonly topology: QueueTopologyService,
    @Inject(BULLPEN_OPTIONS) private readonly options: ResolvedBullpenOptions,
  ) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(@Req() request: Record<string, any>): string {
    return this.renderShell(this.computeBasePath(request));
  }

  @Get('api/meta')
  meta() {
    return {
      title: this.options.title ?? DEFAULT_TITLE,
      theme: this.options.theme ?? 'dark',
      readOnly: Boolean(this.options.readOnly),
      live: true,
      queues: this.discovery.getQueueNames(),
      statuses: JOB_STATUSES,
    };
  }

  @Get('api/queues')
  listQueues(): Promise<QueueSummary[]> {
    return this.enrichedQueues();
  }

  @Get('api/queues/:name')
  async queueSummary(@Param('name') name: string): Promise<QueueSummary> {
    return this.enrich(await this.actions.getQueueSummary(name));
  }

  @Get('api/queues/:name/topology')
  topologyFor(@Param('name') name: string) {
    if (!this.discovery.getQueue(name)) {
      throw new NotFoundException(`Queue "${name}" not found`);
    }
    return this.topology.getTopology(name);
  }

  @Get('api/queues/:name/jobs')
  listJobs(
    @Param('name') name: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const size = clampInt(pageSize, 25, 1, 100);
    const pageIndex = clampInt(page, 0, 0, 1_000_000);
    const start = pageIndex * size;
    return this.actions.listJobs(name, this.resolveStatus(status), start, start + size - 1);
  }

  @Get('api/queues/:name/jobs/:id')
  getJob(@Param('name') name: string, @Param('id') id: string) {
    return this.actions.getJob(name, id);
  }

  @Post('api/queues/:name/jobs/:id/retry')
  async retry(@Param('name') name: string, @Param('id') id: string) {
    this.assertWritable(name);
    await this.actions.retryJob(name, id);
    return { ok: true };
  }

  @Post('api/queues/:name/jobs/:id/promote')
  async promote(@Param('name') name: string, @Param('id') id: string) {
    this.assertWritable(name);
    await this.actions.promoteJob(name, id);
    return { ok: true };
  }

  @Delete('api/queues/:name/jobs/:id')
  async remove(@Param('name') name: string, @Param('id') id: string) {
    this.assertWritable(name);
    await this.actions.removeJob(name, id);
    return { ok: true };
  }

  @Post('api/queues/:name/pause')
  async pause(@Param('name') name: string) {
    this.assertWritable(name);
    await this.actions.pauseQueue(name);
    return { ok: true };
  }

  @Post('api/queues/:name/resume')
  async resume(@Param('name') name: string) {
    this.assertWritable(name);
    await this.actions.resumeQueue(name);
    return { ok: true };
  }

  @Post('api/queues/:name/clean')
  async clean(
    @Param('name') name: string,
    @Body() body: { status?: string; grace?: number; limit?: number } = {},
  ) {
    this.assertWritable(name);
    const removed = await this.actions.cleanQueue(
      name,
      this.resolveStatus(body.status),
      typeof body.grace === 'number' ? body.grace : 0,
      typeof body.limit === 'number' ? body.limit : 1000,
    );
    return { ok: true, removed };
  }

  @Post('api/queues/:name/jobs')
  async addJob(
    @Param('name') name: string,
    @Body() body: { name?: string; data?: unknown; opts?: Record<string, unknown> } = {},
  ) {
    this.assertWritable(name);
    return { ok: true, ...(await this.actions.addJob(name, body.name ?? 'job', body.data, body.opts)) };
  }

  @Get('api/queues/:name/export')
  exportJobs(
    @Param('name') name: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.actions.exportJobs(name, this.resolveStatus(status), clampInt(limit, 1000, 1, 5000));
  }

  @Post('api/queues/:name/bulk')
  async bulk(
    @Param('name') name: string,
    @Body() body: { action?: 'retry' | 'promote'; status?: string; limit?: number } = {},
  ) {
    this.assertWritable(name);
    const result = await this.actions.bulkAction(
      name,
      body.action === 'promote' ? 'promote' : 'retry',
      this.resolveStatus(body.status),
      typeof body.limit === 'number' ? body.limit : 1000,
    );
    return { ok: true, ...result };
  }

  @Sse('api/stream')
  stream(): Observable<{ data: string }> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => from(this.enrichedQueues())),
      map((queues) => ({ data: JSON.stringify(queues) })),
    );
  }

  private async enrichedQueues(): Promise<QueueSummary[]> {
    const summaries = await this.actions.listQueues();
    return summaries.map((summary) => this.enrich(summary));
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

  private assertWritable(name: string): void {
    if (this.topology.getMeta(name).readOnly) {
      throw new ForbiddenException(`Queue "${name}" is read-only.`);
    }
  }

  private resolveStatus(status?: string): JobStatus {
    return (JOB_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as JobStatus)
      : (JOB_STATUSES[1] as JobStatus);
  }

  private computeBasePath(request: Record<string, any>): string {
    const raw = String(request?.originalUrl ?? request?.url ?? '').split('?')[0];
    return raw.replace(/\/+$/, '') || '/';
  }

  private renderShell(basePath: string): string {
    const config = {
      basePath,
      title: this.options.title ?? DEFAULT_TITLE,
      theme: this.options.theme ?? 'dark',
      readOnly: Boolean(this.options.readOnly),
      statuses: JOB_STATUSES,
    };
    const snippet = `<script>window.__BULLPEN__=${JSON.stringify(config).replace(
      /</g,
      '\\u003c',
    )}</script>`;
    const html = this.loadUi();
    return html.includes('<!--BULLPEN_CONFIG-->')
      ? html.replace('<!--BULLPEN_CONFIG-->', snippet)
      : html.replace('</head>', `${snippet}</head>`);
  }

  private loadUi(): string {
    if (this.cachedUi !== null) {
      return this.cachedUi;
    }
    const candidates = [
      join(__dirname, 'ui', 'index.html'),
      join(__dirname, '..', 'ui', 'dist', 'index.html'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.cachedUi = readFileSync(candidate, 'utf8');
        return this.cachedUi;
      }
    }
    this.cachedUi = FALLBACK_HTML;
    return this.cachedUi;
  }
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

const FALLBACK_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bullpen</title><!--BULLPEN_CONFIG--></head><body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0b0d12;color:#e6e9ef;padding:24px"><h1 style="margin:0 0 4px">Bullpen</h1><p style="color:#8b93a7;margin:0 0 16px">UI bundle not built yet — showing raw queue data from the API.</p><pre id="out" style="background:#11141c;border:1px solid #1f2533;border-radius:8px;padding:16px;overflow:auto">loading…</pre><script>(function(){var cfg=window.__BULLPEN__||{basePath:''};fetch(cfg.basePath+'/api/queues').then(function(r){return r.json()}).then(function(d){document.getElementById('out').textContent=JSON.stringify(d,null,2)}).catch(function(e){document.getElementById('out').textContent='error: '+e})})();</script></body></html>`;
