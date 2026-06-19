import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.js';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        enabled: true,
        provider: 'v8',
        reportsDirectory: './coverage',
        reporter: ['text', 'html', 'json-summary'],
      },
    },
  }),
);
