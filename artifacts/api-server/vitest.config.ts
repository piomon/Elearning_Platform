import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/helpers/test-db-url";

// The whole suite runs against an isolated `<db>_test` database (created and
// migrated once in tests/global-setup.ts) and in a single fork so the
// per-test TRUNCATE in tests/setup.ts can never race across files.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl(),
      CLERK_SECRET_KEY: "sk_test_clerk_secret_key_for_tests_000000",
      CLERK_PUBLISHABLE_KEY: "pk_test_clerk_publishable_key_for_tests",
      SESSION_SECRET: "test_session_secret_min_32_chars_long_0000",
      LOG_LEVEL: "silent",
    },
  },
});
