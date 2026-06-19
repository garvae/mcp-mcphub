import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: [
      'tests/package/**/*.test.ts',
      'tests/real/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
  },
});
