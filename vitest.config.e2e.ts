import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Crea la base de pruebas y migra una vez; cada worker carga .env.test.
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/env.ts'],
    // Todos los archivos comparten una sola base: en serie para que el
    // TRUNCATE de uno no pise los datos del otro.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
