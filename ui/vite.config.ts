import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Built from the repo root via `vite build --config ui/vite.config.ts`.
// Everything is inlined into a single dist/ui/index.html that the Nest controller serves.
export default defineConfig({
  root: 'ui',
  base: './',
  plugins: [preact(), viteSingleFile()],
  build: {
    outDir: '../dist/ui',
    emptyOutDir: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4096,
    reportCompressedSize: false,
  },
});
