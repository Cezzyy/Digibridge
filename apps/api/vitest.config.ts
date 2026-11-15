import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      // Pure functions in lib/, with no database.
      { test: { name: 'unit', include: ['src/lib/**/*.test.ts'] } },
      // Requests through the app, against an in-memory Postgres (src/test/setup.ts). The files
      // share each worker's modules, and so its database: starting PGlite and running the
      // migrations once per worker instead of once per file keeps the run fast. Each test
      // cleans up after itself (clearAccounts, useQuestionBank), so no file sees another's rows.
      {
        test: {
          name: 'routes',
          isolate: false,
          include: ['src/test/**/*.test.ts'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
})
