import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
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
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    }
  },
});
