import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: "./workers/index.ts",
      miniflare: {
          compatibilityDate: "2024-01-01",
          d1Databases: ["DB"],
          r2Buckets: ["R2_BUCKET"],
          durableObjects: {
            COLLABORATION_ROOM: "CollaborationRoom",
          },
          bindings: {
            JWT_SECRET: "test-secret-key-for-testing-only",
            ENVIRONMENT: "test",
          },
        },
      },
    },
  },
});
