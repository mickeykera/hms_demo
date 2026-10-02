// Browser end-to-end suite. Kept out of `npm test` (see vitest.config.js) because
// it needs a built frontend bundle and a Chromium binary. Run with `npm run test:e2e`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.js'],
    testTimeout: 90_000,
    hookTimeout: 120_000,
    teardownTimeout: 30_000,
    // Chromium instances are heavyweight; serialising avoids port/profile clashes
    // and keeps CI output readable.
    fileParallelism: false,
    singleThread: true,
  },
});