import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Promptotype',
      fileName: 'promptotype',
      formats: ['iife'],
    },
    outDir: 'dist',
    minify: false,
    // Don't wipe dist/ — the esbuild CLI bundle (dist/cli.mjs) lives here too
    // and `build:ext` must not remove it.
    emptyOutDir: false,
  },
  server: {
    port: 3333,
  },
});
