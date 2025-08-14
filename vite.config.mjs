// vite.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // ensures relative paths for assets
  build: {
    outDir: 'dist'
  }
});
