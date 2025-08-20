import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
coverage: {
provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          statements: 80,
          lines: 80,
        },
      },
      all: true,
      exclude: [
        'dist/**',
        'node_modules/**',
        'test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.test.*',
        '**/*.spec.*',
        '.next/**',
        '**/.next/**',
      ],
    },
  },
});
