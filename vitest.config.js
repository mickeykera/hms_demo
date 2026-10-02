import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// End-to-end (browser) tests.
//
// These are deliberately excluded from `npm test`. They need three things the
// in-process integration suite should not depend on: a built frontend bundle, a
// Chromium binary, and a real HTTP server. Keeping them separate means
// `npm test` stays fast and hermetic, while `npm run test:e2e` remains a
// single command that proves the app actually renders and throws no console or
// page errors.
//
// Browser tests live in tests/e2e and are driven by vitest.config.e2e.js.
// ---------------------------------------------------------------------------
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Browser tests need a built bundle + Chromium; they run via `npm run test:e2e`.
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'src/config/', 'vitest.config.js'],
    },
    // test-env.js must come first: it sets DB_PATH, which src/models/index.js reads
    // at import time.
    setupFiles: ['./tests/test-env.js', './tests/setup.js'],
    testTimeout: 10000,
    sequence: {
      hooks: 'list',
    },
    singleThread: true,
    transformMode: {
      web: [/\.[jt]sx?$/],
    },
  },
});