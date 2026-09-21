import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Banco de teste compartilhado: arquivos em sequência, nunca em paralelo
    // (o beforeEach faz TRUNCATE e apagaria fixtures de outro arquivo).
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    // Suite de integração com bcrypt + Postgres real (+ overhead do coverage):
    // 5s padrão é curto demais e gera truncates no meio do voo.
    testTimeout: 30000,
  },
});
