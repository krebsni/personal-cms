import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: "./workers/index.ts",
        miniflare: {
          compatibilityDate: "2024-01-01",
          // Override wrangler.toml to exclude Durable Objects (not implemented yet)
          d1Databases: ["DB"],
          r2Buckets: ["R2_BUCKET"],
          bindings: {
            JWT_SECRET: "test-secret-key-for-testing-only",
            ENVIRONMENT: "test",
          },
        },
      },
    },
  },
});
