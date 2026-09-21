import { beforeEach } from "vitest";
import { truncateAll } from "./truncate.js";

// Banco Postgres real e isolado (spec testes-e-cicd §1.2). Nunca usar o banco de dev.
// O CI cria esse banco via service + `prisma migrate deploy`; localmente:
//   CREATE DATABASE cursosana_test; DATABASE_URL=..._test npx prisma migrate deploy
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://postgres:password@localhost:5432/cursosana_test";
process.env.JWT_SECRET ??= "test-secret";
process.env.APP_URL ??= "http://localhost:3000";
// Sem Redis nos testes: string vazia ativa o fallback em memória das filas
// (dotenv não sobrescreve variável já setada; `delete` não bastaria).
process.env.REDIS_URL = "";
// Chaves de TESTE com atribuição direta (não `??=`): o Vite injeta o `.env`
// (valores vazios) antes do setup, e os testes precisam do caminho REAL de
// validação de assinatura — nunca do mock, nunca de chaves de produção.
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";

beforeEach(async () => {
  await truncateAll();
});
