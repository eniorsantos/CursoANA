# Testes Automatizados + Deploy e CI/CD

## PARTE 1 — Testes Automatizados

### 1.1 Setup base (Vitest)

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
npm install -D @testing-library/react @testing-library/jest-dom
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

### 1.2 Estratégia de banco para testes

Testar contra o banco de produção (ou até dev) é receita de desastre. O padrão é usar um **banco Postgres isolado para testes**, resetado a cada execução.

```bash
npm install -D @testcontainers/postgresql
```

```typescript
// tests/setup.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "child_process";
import { beforeAll, afterAll, beforeEach } from "vitest";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  // Sobe um Postgres real em Docker, isolado, só para os testes
  container = await new PostgreSqlContainer("postgres:16").start();
  process.env.DATABASE_URL = container.getConnectionUri();

  // Aplica o schema atual nesse banco limpo
  execSync("npx prisma migrate deploy", { env: process.env });
}, 60_000);

afterAll(async () => {
  await container.stop();
});

beforeEach(async () => {
  // Limpa as tabelas entre testes, mantendo o schema
  const { prisma } = await import("@/lib/prisma");
  const tables = ["lesson_progress", "enrollments", "payments", "lessons", "modules", "courses", "users"];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
});
```

> Usar Postgres real via Testcontainers (em vez de SQLite ou mocks) é importante aqui porque o schema usa `enum`, `@@unique` composto e transações — comportamentos que um banco "fake" simula de forma imprecisa e podem esconder bugs reais.

### 1.3 Testes unitários — Server Actions críticas

**Teste de `createCourse` (validação + autorização):**

```typescript
// tests/actions/course.test.ts
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCourse } from "@/app/(admin)/admin/cursos/actions";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "user_1", role: "INSTRUCTOR" }),
}));

describe("createCourse", () => {
  it("cria um curso com dados válidos", async () => {
    const formData = new FormData();
    formData.set("title", "Curso de TypeScript");
    formData.set("description", "Aprenda TypeScript do zero ao avançado");
    formData.set("priceCents", "9900");

    const result = await createCourse(formData);

    expect(result.success).toBe(true);
    const course = await prisma.course.findUnique({ where: { id: result.courseId } });
    expect(course?.slug).toBe("curso-de-typescript");
    expect(course?.status).toBe("DRAFT"); // todo curso novo nasce como rascunho
  });

  it("rejeita título muito curto", async () => {
    const formData = new FormData();
    formData.set("title", "Ab");
    formData.set("description", "Descrição válida com mais de 10 caracteres");
    formData.set("priceCents", "9900");

    const result = await createCourse(formData);

    expect(result.error?.title).toContain("Título muito curto");
  });

  it("rejeita preço negativo", async () => {
    const formData = new FormData();
    formData.set("title", "Curso Válido");
    formData.set("description", "Descrição válida com mais de 10 caracteres");
    formData.set("priceCents", "-100");

    const result = await createCourse(formData);
    expect(result.error?.priceCents).toBeDefined();
  });
});
```

**Teste de `assertOwnsCourse` (o ponto mais importante de autorização):**

```typescript
// tests/actions/course-ownership.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateCourse } from "@/app/(admin)/admin/cursos/actions";
import { vi } from "vitest";

describe("proteção de propriedade de curso", () => {
  it("instrutor não pode editar curso de outro instrutor", async () => {
    const instructorA = await prisma.user.create({
      data: { name: "A", email: "a@test.com", role: "INSTRUCTOR" },
    });
    const instructorB = await prisma.user.create({
      data: { name: "B", email: "b@test.com", role: "INSTRUCTOR" },
    });
    const course = await prisma.course.create({
      data: {
        title: "Curso do A",
        slug: "curso-do-a",
        description: "desc",
        priceCents: 1000,
        instructorId: instructorA.id,
      },
    });

    vi.mock("@/lib/auth", () => ({
      requireRole: vi.fn().mockResolvedValue(instructorB),
    }));

    const formData = new FormData();
    formData.set("title", "Tentando editar");
    formData.set("description", "descrição qualquer com mais de 10 caracteres");
    formData.set("priceCents", "2000");

    await expect(updateCourse(course.id, formData)).rejects.toThrow(
      "Você não tem permissão para editar este curso"
    );
  });
});
```

**Teste de `resetPassword` (token de uso único e expiração):**

```typescript
// tests/actions/password-reset.test.ts
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetPassword } from "@/app/(auth)/redefinir-senha/actions";
import bcrypt from "bcryptjs";

describe("resetPassword", () => {
  it("redefine a senha com token válido", async () => {
    const user = await prisma.user.create({
      data: { name: "Teste", email: "teste@test.com", passwordHash: "hash-antigo" },
    });
    const token = await prisma.passwordResetToken.create({
      data: { userId: user.id, token: "token-valido", expiresAt: new Date(Date.now() + 60000) },
    });

    const result = await resetPassword("token-valido", "novaSenha123");

    expect(result.success).toBe(true);
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    const senhaValida = await bcrypt.compare("novaSenha123", updated!.passwordHash!);
    expect(senhaValida).toBe(true);
  });

  it("rejeita token expirado", async () => {
    const user = await prisma.user.create({ data: { name: "T", email: "t2@test.com" } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token: "token-expirado", expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await resetPassword("token-expirado", "novaSenha123");
    expect(result.error).toBe("Link inválido ou expirado. Solicite um novo.");
  });

  it("rejeita reutilização do mesmo token", async () => {
    const user = await prisma.user.create({ data: { name: "T", email: "t3@test.com" } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: "token-usado",
        expiresAt: new Date(Date.now() + 60000),
        usedAt: new Date(), // já foi usado antes
      },
    });

    const result = await resetPassword("token-usado", "outraSenha");
    expect(result.error).toBeDefined();
  });
});
```

### 1.4 Testes de integração — Webhooks de pagamento

Essa é a parte mais crítica de testar, porque bug aqui significa **cobrar o aluno sem liberar o curso** ou pior, **liberar sem cobrar**.

**Testando o webhook da Stripe (com assinatura simulada):**

```typescript
// tests/webhooks/stripe.test.ts
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { POST } from "@/app/api/webhooks/stripe/route";

describe("webhook Stripe - checkout.session.completed", () => {
  it("cria pagamento e matrícula quando o pagamento é confirmado", async () => {
    const user = await prisma.user.create({ data: { name: "Aluno", email: "aluno@test.com" } });
    const instructor = await prisma.user.create({ data: { name: "Prof", email: "prof@test.com", role: "INSTRUCTOR" } });
    const course = await prisma.course.create({
      data: { title: "Curso X", slug: "curso-x", description: "d", priceCents: 5000, instructorId: instructor.id },
    });

    // Monta um evento no formato real da Stripe
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          amount_total: 5000,
          metadata: { userId: user.id, courseId: course.id },
        },
      },
    };

    // Mocka a validação de assinatura para retornar o evento fake direto
    vi.spyOn(stripe.webhooks, "constructEvent").mockReturnValue(fakeEvent as any);

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(fakeEvent),
      headers: { "stripe-signature": "fake-signature" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { gatewayChargeId: "cs_test_123" } });
    expect(payment?.status).toBe("PAID");

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("é idempotente — processar o mesmo evento duas vezes não duplica o pagamento", async () => {
    const user = await prisma.user.create({ data: { name: "Aluno2", email: "aluno2@test.com" } });
    const instructor = await prisma.user.create({ data: { name: "Prof2", email: "prof2@test.com", role: "INSTRUCTOR" } });
    const course = await prisma.course.create({
      data: { title: "Curso Y", slug: "curso-y", description: "d", priceCents: 5000, instructorId: instructor.id },
    });

    const fakeEvent = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_456", amount_total: 5000, metadata: { userId: user.id, courseId: course.id } } },
    };
    vi.spyOn(stripe.webhooks, "constructEvent").mockReturnValue(fakeEvent as any);

    const makeRequest = () =>
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify(fakeEvent),
        headers: { "stripe-signature": "fake-signature" },
      });

    await POST(makeRequest()); // primeira chamada
    await POST(makeRequest()); // reenvio (a Stripe faz isso com frequência)

    const payments = await prisma.payment.findMany({ where: { gatewayChargeId: "cs_test_456" } });
    expect(payments).toHaveLength(1); // não duplicou
  });

  it("rejeita webhook com assinatura inválida", async () => {
    vi.spyOn(stripe.webhooks, "constructEvent").mockImplementation(() => {
      throw new Error("Assinatura inválida");
    });

    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "payload malicioso",
      headers: { "stripe-signature": "assinatura-forjada" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400); // nunca deve processar sem validar a assinatura
  });
});
```

**Testando o webhook do Mercado Pago (busca o pagamento real na API):**

```typescript
// tests/webhooks/mercadopago.test.ts
import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/mercadopago/route";
import * as mpModule from "mercadopago";

describe("webhook Mercado Pago", () => {
  it("só libera acesso quando o status do pagamento é 'approved'", async () => {
    const user = await prisma.user.create({ data: { name: "Aluno MP", email: "mp@test.com" } });
    const instructor = await prisma.user.create({ data: { name: "Prof MP", email: "profmp@test.com", role: "INSTRUCTOR" } });
    const course = await prisma.course.create({
      data: { title: "Curso MP", slug: "curso-mp", description: "d", priceCents: 3000, instructorId: instructor.id },
    });

    // Mocka a resposta da API do MP como "ainda pendente"
    vi.spyOn(mpModule.Payment.prototype, "get").mockResolvedValue({
      id: 987654,
      status: "pending",
      transaction_amount: 30,
      payment_type_id: "pix",
      metadata: { userId: user.id, courseId: course.id },
    } as any);

    const req = new Request("http://localhost/api/webhooks/mercadopago", {
      method: "POST",
      body: JSON.stringify({ type: "payment", data: { id: "987654" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Não deveria ter criado matrícula ainda — pagamento Pix pendente
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    expect(enrollment).toBeNull();
  });
});
```

### 1.5 O que testar prioritariamente (nem tudo precisa de teste)

| Prioridade | O quê | Por quê |
|---|---|---|
| Crítica | Webhooks de pagamento (idempotência, validação de assinatura) | Erro aqui = perda financeira direta |
| Crítica | Autorização (`assertOwnsCourse`, `requireRole`) | Erro aqui = vazamento de dados entre usuários |
| Alta | Fluxo de reset de senha (expiração, uso único) | Erro aqui = brecha de conta |
| Média | Validações de formulário (Zod schemas) | Erros aqui já ficam visíveis rápido em uso normal |
| Baixa | Componentes puramente visuais | Baixo risco, alto custo de manutenção do teste |

### 1.6 Scripts no package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## PARTE 2 — Deploy e CI/CD

### 2.1 Arquitetura de ambientes

```
main (produção)     → Vercel (produção) + Railway (produção: Postgres, Redis, Workers)
develop (staging)   → Vercel (preview fixo) + Railway (staging: Postgres, Redis, Workers)
feature/* (PRs)     → Vercel (preview automático por PR) + banco de staging compartilhado
```

> O frontend (Next.js) vai para Vercel. O backend "always-on" — Postgres, Redis, os workers do BullMQ — vai para Railway ou Render, porque esses precisam de processos persistentes que a Vercel (serverless) não oferece.

### 2.2 Pipeline: Pull Request (testes + preview)

```yaml
# .github/workflows/pr.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Executar migrations no banco de teste
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db

      - name: Rodar testes
        run: npm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          MP_ACCESS_TOKEN: ${{ secrets.MP_TEST_ACCESS_TOKEN }}

      - name: Build
        run: npm run build
```

> A Vercel já gera automaticamente uma **preview URL por Pull Request** sem configuração extra — não precisa de um job de deploy manual aqui, só garantir que os testes/build passam antes do merge (proteja a branch `main` exigindo esse workflow verde).

### 2.3 Pipeline: Deploy em Staging (branch `develop`)

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [develop]

jobs:
  test:
    # ... mesmo job de testes do arquivo anterior (pode ser extraído como workflow reutilizável)
    uses: ./.github/workflows/pr.yml

  migrate-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci

      - name: Aplicar migrations no banco de staging
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

      - name: Deploy do frontend na Vercel (staging)
        run: npx vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }} --env=staging
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Deploy dos workers na Railway (staging)
        run: |
          npm install -g @railway/cli
          railway up --service workers --environment staging
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_STAGING }}
```

### 2.4 Pipeline: Deploy em Produção (branch `main`)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  test:
    uses: ./.github/workflows/pr.yml

  migrate-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: production
      # Exige aprovação manual de alguém do time antes de rodar — configurável no GitHub em Settings > Environments
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci

      - name: Backup do banco antes da migration
        run: |
          npm install -g @railway/cli
          railway run --service postgres pg_dump > backup-pre-deploy.sql
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}

      - name: Aplicar migrations em produção
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Deploy do frontend na Vercel (produção)
        run: npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Deploy dos workers na Railway (produção)
        run: railway up --service workers --environment production
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN_PRODUCTION }}

      - name: Notificar time no Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "Deploy em produção: ${{ job.status }} — commit ${{ github.sha }}"}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 2.5 Por que exigir aprovação manual em produção

O bloco `environment: { name: production }` no GitHub Actions permite configurar, em **Settings → Environments**, que esse job só roda depois que uma pessoa autorizada clicar em "Approve" — dá uma última checagem humana antes de rodar migrations e substituir o que está no ar, especialmente importante para uma plataforma que processa pagamentos.

### 2.6 Gestão de variáveis de ambiente e secrets

| Onde vive | O quê |
|---|---|
| GitHub Secrets | Tokens usados só no pipeline (`VERCEL_TOKEN`, `RAILWAY_TOKEN`, chaves de teste do Stripe/MP) |
| Vercel Environment Variables | Variáveis do runtime do frontend, separadas por ambiente (Production/Preview/Development) |
| Railway Environment Variables | `DATABASE_URL`, `REDIS_URL`, chaves de produção do Stripe/MP/Mux para os workers |

Nunca commitar `.env` no repositório — usar `.env.example` como referência de quais variáveis existem, sem valores reais:

```bash
# .env.example
DATABASE_URL=
REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MP_ACCESS_TOKEN=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 2.7 Estratégia de rollback

Migrations de banco são a parte mais arriscada de reverter. Duas práticas reduzem o risco:

1. **Migrations aditivas primeiro** — ao remover uma coluna, faça em duas etapas (deploy 1: para de usar a coluna no código; deploy 2, dias depois: remove a coluna do banco). Isso evita quebrar produção se precisar reverter o deploy do código sem reverter o banco.
2. **Backup automático antes de cada migration em produção** (já incluído no workflow acima) — se algo der errado, o `pg_dump` permite restaurar rapidamente.

Para reverter só o código (sem tocar no banco), a Vercel mantém o histórico de deploys — um rollback é literalmente promover o deploy anterior de volta a produção pelo dashboard ou `vercel rollback`.

---

## 3. Checklist Final

- [ ] Testes rodam contra Postgres real (Testcontainers), nunca mocks para lógica de banco
- [ ] Todo teste de webhook cobre: caso de sucesso, idempotência (evento repetido) e assinatura inválida
- [ ] Branch `main` protegida — só aceita merge com o workflow de testes passando
- [ ] Deploy em produção exige aprovação manual (`environment: production`)
- [ ] Backup do banco antes de toda migration em produção
- [ ] Nenhum secret commitado — tudo em GitHub Secrets / Vercel / Railway env vars
- [ ] Staging usa chaves de **teste** do Stripe/Mercado Pago, nunca chaves reais
