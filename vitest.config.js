import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', 'src/config/', 'vitest.config.js'],
    },
    setupFiles: ['./tests/setup.js'],
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