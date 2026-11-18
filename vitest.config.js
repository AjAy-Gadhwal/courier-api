import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: { LOG_LEVEL: 'silent', NODE_ENV: 'test' },
    testTimeout: 15000,
  },
});
