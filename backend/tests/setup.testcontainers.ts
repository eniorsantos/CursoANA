import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { beforeAll, afterAll, beforeEach } from "vitest";
import { truncateAll } from "./truncate.js";

// Setup alternativo com Testcontainers (spec testes-e-cicd §1.2): sobe um Postgres 16
// real e isolado em Docker por execução. Uso: `npm run test:containers`.
// Requer Docker daemon rodando (não é o padrão local/CI com service postgres).
process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.APP_URL ??= "http://localhost:3000";
process.env.REDIS_URL = "";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16").start();
  process.env.DATABASE_URL = container.getConnectionUri();
  execSync("npx prisma migrate deploy", { env: process.env, stdio: "inherit" });
}, 120_000);

afterAll(async () => {
  await container?.stop();
});

beforeEach(async () => {
  await truncateAll();
});
