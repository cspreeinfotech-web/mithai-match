import { defineConfig } from 'vitest/config';
import pkg from './package.json';

// shortcut: base path assumes Capacitor's webDir serves from app root; revisit if hosting on a sub-path.
export default defineConfig({
  base: './',
  define: {
    // Single source of truth for the displayed app version (Settings screen) — same
    // package.json version android/app/build.gradle reads for versionName.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  test: {
    environment: 'node',
  },
});
