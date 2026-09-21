import { defineConfig } from "vitest/config";

// Variante Testcontainers: mesmo suite, banco efêmero em Docker.
// Uso: npm run test:containers (requer Docker daemon rodando).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.testcontainers.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
  },
});
