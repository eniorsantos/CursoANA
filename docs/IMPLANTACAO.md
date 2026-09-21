# Implantação — Local e Nuvem (passo a passo)

Guia operacional do projeto descrito em `docs/VISAO-GERAL.md`.
Portas padrão: API `:4000` · Web `:3000` · Bull Board em `/admin/queues` (na API).

---

## PARTE 1 — Servidor local (desenvolvimento)

### 1.0 Pré-requisitos

- Node.js 20+ e npm
- PostgreSQL 16 (local ou via Docker) e Redis 7 (opcional — sem ele as filas usam fallback em memória)
- Git · Docker Desktop (opcional, só para `infra/docker-compose.yml`) · Expo Go no celular (só para o mobile)

### 1.1 Clonar e configurar variáveis

```bash
git clone https://github.com/eniorsantos/CursoANA.git
cd CursoANA   # pasta do projeto (ex: F:\CURSOSANA)

cp backend/.env.example backend/.env
# Edite backend/.env: ajuste DATABASE_URL (usuário/senha do SEU Postgres),
# REDIS_URL (ou deixe vazio para fallback em memória) e JWT_SECRET.

cp frontend/.env.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_GOOGLE_ENABLED=false (só true com OAuth configurado — §3.3)
```

### 1.2 Subir banco de dados

Opção A — Docker (recomendado):

```bash
docker compose -f infra/docker-compose.yml up -d
# Postgres :5432 (postgres/postgres, db cursosana) · Redis :6379
```

Opção B — Postgres local existente:

```sql
CREATE DATABASE cursosana;
CREATE DATABASE cursosana_test;  -- só para rodar os testes
```

### 1.3 Backend (API)

```bash
cd backend
npm install
npx prisma migrate dev        # cria/atualiza o banco + gera o Prisma Client
npm run dev                   # http://localhost:4000/health → {"ok":true}
```

Em outro terminal (processo separado — workers nunca rodam dentro do Next/serverless):

```bash
cd backend
npm run start:workers         # email, certificate, video-processing, push
```

Criar o primeiro admin (o cadastro cria sempre `STUDENT`):

```bash
# 1. cadastre-se pela tela /cadastro; 2. promova via psql:
psql "$DATABASE_URL" -c "UPDATE users SET role='ADMIN' WHERE email='voce@email.com';"
```

Rodar os testes:

```bash
cd backend
npm test                      # 24 testes, Postgres cursosana_test (crie o banco antes)
npm run test:coverage         # + relatório de cobertura
npm run test:containers       # variante Testcontainers (requer Docker rodando)
```

### 1.4 Frontend web

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Checklist de fumaça local: cadastro → login → (como instrutor) criar curso → adicionar
módulo/aula → publicar → checkout (sem chaves Stripe/MP, o backend gera URL mock e o webhook
mock libera o acesso) → assistir → certificado em `/certificados/verificar/<hash>`.

### 1.5 App mobile (Expo)

```bash
cd frontend/mobile
npm install
npx expo start                # escaneie o QR com o Expo Go (mesma rede do PC)
```

Aponte `EXPO_PUBLIC_API_URL` para o IP da sua máquina na rede (ex: `http://192.168.0.10:4000`) —
`localhost` no celular não alcança o backend do PC.

### 1.6 Webhooks reais em dev (opcional)

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe   # Stripe CLI
# Use a chave de teste no backend (.env) e o STRIPE_WEBHOOK_SECRET exibido pelo listen.
```

---

## PARTE 2 — Nuvem (produção e staging)

Arquitetura: Web na **Vercel** · API + workers + Postgres + Redis na **Railway/Render**
(ou Postgres Neon/Supabase + Redis Upstash) · Mobile via **EAS**. Pipelines em
`.github/workflows/`: `pr.yml` (testes), `deploy-staging.yml` (`develop`), `deploy-production.yml`
(`main`, com aprovação manual e backup `pg_dump` antes da migration).

### 2.1 Banco de dados e Redis gerenciados

1. Crie um Postgres 16 gerenciado (Railway, Render, Neon ou Supabase) — dois bancos ou dois
   projetos: **produção** e **staging**. Anote as `DATABASE_URL`.
2. Crie um Redis gerenciado (Railway, Render ou Upstash) — também prod + staging. Anote as `REDIS_URL`.
   (Redis com persistência: jobs não podem se perder num restart.)
3. Aplique o schema (de onde tiver acesso ao banco):
   ```bash
   cd backend
   DATABASE_URL="<url-prod>" npx prisma migrate deploy
   DATABASE_URL="<url-staging>" npx prisma migrate deploy
   ```
   O CI também faz isso a cada deploy.

### 2.2 Backend — API (serviço web persistente)

Na Railway/Render/Fly.io, crie um serviço a partir do repo (usa o `backend/Dockerfile`):

- Build: `npm ci && npx prisma generate && npm run build`
- Start: `node dist/index.js` (porta via `$PORT`)
- Configure **todas** as variáveis do `backend/.env.example` com valores de produção:
  `DATABASE_URL`, `REDIS_URL`, `APP_URL` (URL pública da web), `BACKEND_URL` (URL pública da API),
  `JWT_SECRET` (longo e aleatório), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `MP_ACCESS_TOKEN`, `MUX_TOKEN_ID/SECRET`, `MUX_SIGNING_KEY_ID/PRIVATE`,
  `GOOGLE_CLIENT_ID/SECRET` (se usar login social), `RESEND_API_KEY`,
  `QUEUES_DASHBOARD_USER/PASS` (Bull Board).
- Nunca commitar `.env` — só via painel de envs do provedor.

### 2.3 Backend — Workers (serviço separado, background)

No mesmo provedor, crie um **segundo serviço** com o mesmo código e envs, mas comando:

```bash
npm run start:workers
```

Sem porta pública. O Redis precisa estar acessível por ele (mesma rede/projeto).
Sem workers, emails/certificados/push não são processados (em produção não há fallback em memória).

### 2.4 Frontend web — Vercel

1. Importe o repo na Vercel; **Root Directory: `frontend/`**.
2. Variáveis (Production + Preview/Staging):
   - `NEXT_PUBLIC_API_URL` → URL pública da API (ex: `https://api.seusite.com`)
   - `NEXT_PUBLIC_GOOGLE_ENABLED` → `true` só com OAuth configurado
3. Deploy automático a cada push (o workflow de deploy também roda migrate + backup em produção).

### 2.5 Webhooks e OAuth (apontar para as URLs públicas)

- **Stripe Dashboard → Webhooks:** `POST https://api.seusite.com/api/webhooks/stripe`
  (eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.deleted`) → copie o **signing secret** para `STRIPE_WEBHOOK_SECRET`.
  Teste antes com as chaves **test** no ambiente de staging.
- **Mercado Pago:** `notification_url` já é enviada no checkout (`/api/webhooks/mercadopago`); use
  credenciais de teste em staging.
- **Mux Dashboard → Webhooks:** `POST https://api.seusite.com/api/webhooks/mux` (`video.asset.ready`).
- **Google Cloud Console → OAuth:** redirect autorizado
  `https://api.seusite.com/api/auth/google/callback` → `GOOGLE_CLIENT_ID/SECRET` + `BACKEND_URL`.

### 2.6 App mobile — EAS Build/Submit

```bash
cd frontend/mobile
npm install -g eas-cli
eas build --platform android --profile staging    # EXPO_PUBLIC_API_URL de staging (eas.json)
eas build --platform android --profile production # URL de produção
eas build --platform ios --profile production
eas submit --platform android
eas submit --platform ios
```

Atenção (spec §9 do mobile): conteúdo digital comprado dentro do app iOS pode exigir
In-App Purchase (comissão Apple). O MVP abre o checkout no navegador do sistema justamente para
evitar a comissão — valide com compliance da App Store antes de escalar.

### 2.7 CI/CD e secrets do GitHub

Secrets necessários (`Settings → Secrets`): `PRODUCTION_DATABASE_URL`, `STAGING_DATABASE_URL`,
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (+ tokens do provedor do backend, se usar deploy via CLI).
Fluxo: PR → testes + Postgres service → merge em `develop` → staging → merge em `main` →
aprovação manual → **backup `pg_dump` (artifact 30 dias)** → migrate → deploy.
Proteja `main` exigindo o workflow verde.

### 2.8 Pós-deploy (checklist) e rollback

- [ ] `/health` da API responde `{"ok":true}`
- [ ] Webhooks Stripe/MP/Mux com chaves de **teste** em staging antes de produção
- [ ] Compra de teste ponta a ponta (pagamento → matrícula → certificado)
- [ ] Bull Board (`/admin/queues`) acessível com basic auth
- [ ] Logs dos workers sem erros; Redis com persistência
- **Rollback de código:** promover o deploy anterior na Vercel (`vercel rollback`) e reverter o
  serviço da API. **Rollback de banco:** restaurar o dump do artifact do deploy
  (`pg_restore`). Migrations: prefira mudanças aditivas; remoção de coluna em 2 deploys.

---

## Referência rápida de comandos

| Ação | Comando |
|---|---|
| Subir Postgres+Redis local | `docker compose -f infra/docker-compose.yml up -d` |
| Migration dev | `cd backend && npx prisma migrate dev` |
| Migration prod/staging | `DATABASE_URL="<url>" npx prisma migrate deploy` |
| API / workers / web | `npm run dev` · `npm run start:workers` · web: `npm run dev` |
| Testes | `npm test` · `npm run test:coverage` · `npm run test:containers` |
| Ver dados | `npx prisma studio` |
| Mobile | `npx expo start` · `eas build --platform android --profile production` |
