import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'DesignAnnotator',
      fileName: 'design-annotator',
      formats: ['iife'],
    },
    outDir: 'dist',
    minify: false,
  },
  server: {
    port: 3333,
  },
});
