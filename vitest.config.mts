import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const vscodeStubPath = fileURLToPath(new URL('./test/support/vscode-stub.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      vscode: vscodeStubPath,
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/infrastructure/git/git-api.d.ts'],
      reporter: ['text'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
