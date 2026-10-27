import { defineConfig } from 'vitest/config'

// Database tests: need PostgreSQL (see supabase/tests/reset-local-db.sh).
export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
