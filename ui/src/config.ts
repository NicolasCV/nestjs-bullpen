export interface BullpenConfig {
  basePath: string;
  title: string;
  theme: 'dark' | 'light';
  readOnly: boolean;
  statuses: string[];
}

declare global {
  interface Window {
    __BULLPEN__?: Partial<BullpenConfig>;
  }
}

const injected = window.__BULLPEN__ ?? {};

export const config: BullpenConfig = {
  basePath: (injected.basePath ?? window.location.pathname).replace(/\/+$/, ''),
  title: injected.title ?? 'Bullpen',
  theme: injected.theme === 'light' ? 'light' : 'dark',
  readOnly: Boolean(injected.readOnly),
  statuses: injected.statuses ?? [
    'active',
    'waiting',
    'prioritized',
    'delayed',
    'completed',
    'failed',
    'paused',
  ],
};
