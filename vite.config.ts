import { defineConfig } from 'vitest/config';

// shortcut: base path assumes Capacitor's webDir serves from app root; revisit if hosting on a sub-path.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    environment: 'node',
  },
});
