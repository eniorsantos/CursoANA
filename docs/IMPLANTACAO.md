# Implantação — Local e Nuvem (guia completo e comentado)

Guia operacional do projeto descrito em `docs/VISAO-GERAL.md`, escrito para quem está
implantando pela primeira vez: cada fase explica **o que** fazer, **por que** fazer e
**como confirmar** que funcionou, além dos erros mais comuns.

Portas padrão: API `:4000` · Web `:3000` · Bull Board em `/admin/queues` (na API).

> Convenção: comandos `bash` genéricos. No Windows (PowerShell), troque `cp` por
> `Copy-Item`, `export VAR=x` por `$env:VAR = "x"` e `&&` por `;`.

---
---

## PARTE 1 — Servidor local (desenvolvimento)

**Objetivo desta parte:** rodar a plataforma inteira na sua máquina para desenvolver e testar,
antes de gastar qualquer recurso de nuvem. Ao final, API, workers, web e mobile conversam entre si.

### Fase 1.0 — Pré-requisitos (o que instalar e por quê)

| Ferramenta | Para que serve aqui | Como obter |
|---|---|---|
| Node.js 20+ e npm | Executa backend, frontend e mobile (todo o projeto é JavaScript/TypeScript) | https://nodejs.org |
| PostgreSQL 16 | Banco relacional: cursos, matrículas, pagamentos (o Prisma exige Postgres real — nada de SQLite) | Instalador local ou Docker |
| Redis 7 (opcional) | Fila BullMQ em dev. **Sem ele nada quebra**: o código usa fallback em memória | Docker ou ignore |
| Git | Versionamento e deploy via push | https://git-scm.com |
| Docker Desktop (opcional) | Sobe Postgres+Redis com 1 comando via `infra/docker-compose.yml` | https://docker.com |
| Expo Go no celular (opcional) | Testar o app mobile sem emulador | Loja do celular |

**Conceito:** desenvolvimento local imita a nuvem em miniatura — mesmos serviços (API, banco,
fila, web), só que na sua máquina. Tudo que funciona aqui deve funcionar lá, desde que as
variáveis de ambiente estejam equivalentes.

### Fase 1.1 — Clonar o repositório e configurar variáveis de ambiente

**Por quê:** o código é público/privado no Git, mas **segredos nunca viajam no código**.
Cada ambiente (seu PC, staging, produção) tem seu próprio `.env` com senhas e chaves reais.
O `.env.example` é só o molde — ele pode (e deve) ser commitado; o `.env`, nunca.

```bash
git clone https://github.com/eniorsantos/CursoANA.git
cd CursoANA

# Backend: credenciais do banco, segredo do JWT, chaves dos gateways
cp backend/.env.example backend/.env
# Abra backend/.env e ajuste pelo menos:
#   DATABASE_URL → usuário/senha do SEU Postgres (ex: postgresql://postgres:SUA_SENHA@localhost:5432/cursosana)
#   REDIS_URL    → deixe vazio se não tiver Redis (fallback em memória)
#   JWT_SECRET   → qualquer texto longo aleatório (só dev; em produção é obrigatório e sério)

# Frontend web: só precisa saber onde está a API
cp frontend/.env.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000
# NEXT_PUBLIC_GOOGLE_ENABLED=false  (só true com OAuth configurado — ver Fase 2.5)
```

**Como confirmar:** `backend/.env` existe e **não** aparece em `git status` (está no `.gitignore`).
Se aparecer, pare aqui e corrija o `.gitignore` antes de qualquer commit.

**Erro comum:** `P1000: Authentication failed` do Prisma = usuário/senha errados na `DATABASE_URL`.
Teste a conexão com `psql "$DATABASE_URL" -c "SELECT 1"` antes de culpar o código.

### Fase 1.2 — Subir o banco de dados

**Por quê:** sem Postgres não há login, curso, pagamento nem teste. São dois bancos:
`cursosana` (seu desenvolvimento) e `cursosana_test` (isolado, apagado e recriado pelos testes —
**nunca** aponte teste para banco de dev).

Opção A — Docker (recomendado, ambiente idêntico para todo o time):

```bash
docker compose -f infra/docker-compose.yml up -d
# Sobe: Postgres :5432 (usuário postgres, senha postgres, db cursosana) e Redis :6379.
# Verifique: docker ps  →  dois containers "Up".
```

Opção B — Postgres já instalado na máquina:

```sql
CREATE DATABASE cursosana;
CREATE DATABASE cursosana_test;  -- só para rodar os testes
```

**Conceito:** containers deixam a infra descartável (`down -v` apaga tudo) e versionada no
`infra/docker-compose.yml`. É o mesmo Postgres 16 da produção — evita o clássico "na minha
máquina funciona".

### Fase 1.3 — Backend: API

**Por quê:** a API é o coração — regra de negócio, pagamentos e autorização moram aqui.
O frontend/mobile são "burros": só exibem e chamam a API.

```bash
cd backend
npm install                 # baixa ~200 pacotes (Express, Prisma, Stripe, BullMQ...)

npx prisma migrate dev      # lê prisma/schema.prisma, cria as tabelas e gera o Prisma Client tipado.
                            # Cada mudança futura no schema gera uma nova migration versionada em prisma/migrations/.

npm run dev                 # API em http://localhost:4000 (tsx com reload automático)
```

**Como confirmar:** abra `http://localhost:4000/health` → deve responder `{"ok":true}`.
Se a porta estiver ocupada, ajuste `PORT` no `.env`.

**Conceito — migrations:** nunca edite o banco "na mão" em dev; edite o `schema.prisma` e rode
`migrate dev`. Assim staging/produção recebem exatamente o mesmo schema via `migrate deploy`.

### Fase 1.4 — Backend: workers (processo separado, obrigatório entender)

**Por quê:** emails, PDFs de certificado, webhooks de vídeo e push **não podem** travar a resposta
HTTP do aluno. Eles vão para filas (BullMQ/Redis) e um processo Node separado os consome com
retry automático. Servidores serverless (Vercel) não mantêm processo vivo — por isso workers
moram em serviço próprio, nunca dentro do Next.js.

```bash
cd backend
npm run start:workers       # consome as filas: email, certificate, video-processing, push
```

**Como confirmar:** faça um cadastro e observe o log `[queue:email] job enfileirado` na API e o
processamento no terminal dos workers. O Bull Board (`http://localhost:4000/admin/queues`,
com `QUEUES_DASHBOARD_USER/PASS` do `.env`) mostra os jobs visualmente.

**Sem Redis?** Funciona com fallback em memória (jobs só logados). Em produção isso é
inaceitável — jobs se perderiam num restart. Ver Fase 2.1.

### Fase 1.5 — Primeiro usuário admin e testes automatizados

**Por quê:** o cadastro cria sempre `STUDENT` (seguro por padrão). Alguém precisa ser promovido
manualmente à primeira vez — depois disso, o painel administra o resto.

```bash
# 1. Cadastre-se pela tela http://localhost:3000/cadastro (frontend, Fase 1.6)
# 2. Promova via psql:
psql "$DATABASE_URL" -c "UPDATE users SET role='ADMIN' WHERE email='voce@email.com';"
# Papéis: STUDENT (aluno) · INSTRUCTOR (vê/ede só os próprios cursos) · ADMIN (tudo)
```

Testes (24 testes contra o banco `cursosana_test` — **crie-o antes**, Fase 1.2):

```bash
cd backend
npm test                      # suite completa (webhooks, ownership, reset, LGPD, Fase 2...)
npm run test:coverage         # + relatório de cobertura (~49% stmts)
npm run test:containers       # variante Testcontainers: Postgres 16 efêmero em Docker (requer Docker rodando)
npx prisma studio             # interface visual do banco em http://localhost:5555 (ótimo para depurar)
```

**Conceito:** testes de integração aqui usam Postgres de verdade (nunca mock de banco) porque o
schema usa enums, uniques compostos e transações — um banco "fake" esconderia bugs reais.

### Fase 1.6 — Frontend web

**Por quê:** vitrine estilo streaming para o aluno + painel admin. É um app Next.js que consome
100% da API — não tem banco próprio.

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

**Roteiro de fumaça (faça nesta ordem, é o "teste de aceitação" manual):**
1. `/cadastro` → `/login` (sessão espelhada em cookie para o middleware de rotas).
2. Como instrutor/admin: `/admin/cursos/novo` → criar curso (nasce `DRAFT`) → abrir editor →
   adicionar módulo (arraste para reordenar) → adicionar aula → página da aula → upload de vídeo
   (sem chaves Mux, mostra aviso mock) → voltar e **Publicar** (exige ≥1 módulo).
3. Como aluno: `/curso/<slug>` → `/checkout/<id>` → pagar (sem chaves Stripe/MP, o backend gera
   URL mock e o webhook mock libera o acesso — em produção, só o webhook real libera).
4. Assistir (progresso a cada 15 s) → concluir → certificado em `/certificados/verificar/<hash>`.
5. `/perfil` → zona de perigo → excluir conta (LGPD: anonimiza e revoga).

**Erro comum:** página admin abrindo sem login = cookie `auth_token` ausente (limpe cookies /
refaça login). API retornando 401 no admin = token expirado ou papel insuficiente.

### Fase 1.7 — App mobile (Expo)

**Por quê:** mesmo backend, experiência nativa (player, downloads offline, push). O app nunca fala
com banco — só com a API, usando JWT em `SecureStore` (nunca cookie).

```bash
cd frontend/mobile
npm install
npx expo start                # escaneie o QR com o Expo Go, celular e PC na MESMA rede
```

**Detalhe que pega todo iniciante:** `localhost` no celular = o próprio celular, não o seu PC.
Aponte `EXPO_PUBLIC_API_URL` para o **IP da máquina na rede** (ex: `http://192.168.0.10:4000`).
Descubra o IP com `ipconfig` (Windows) / `ifconfig` (Mac/Linux).

**Como confirmar:** login no app → home com hero + carrosséis (1 chamada agregada) → detalhe →
player → botão ⬇ baixa a aula (cifrada) → aba Downloads lista com tamanho e expiração.

### Fase 1.8 — Webhooks reais em dev (opcional, mas recomendado antes da nuvem)

**Por quê:** o modo mock prova a interface, não o dinheiro. Com a Stripe CLI você recebe eventos
reais assinados no `localhost`, validando o caminho de produção (HMAC + idempotência).

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
# 1. Copie o STRIPE_WEBHOOK_SECRET exibido (whsec_...) para o backend/.env
# 2. Use STRIPE_SECRET_KEY de TESTE (sk_test_...) no backend/.env
# 3. Dispare: stripe trigger checkout.session.completed
# 4. Observe pagamento PAID + matrícula ACTIVE no prisma studio
```

---
---

## PARTE 2 — Nuvem (produção e staging)

**Objetivo:** tirar do PC e colocar no ar com dois ambientes: **staging** (espelho para testar
com chaves de mentira) e **produção** (dinheiro de verdade). Regra de ouro: **nada estreia em
produção sem passar por staging**.

**Mapa da arquitetura em nuvem:**

```
Aluno → Vercel (web Next.js) ─┐
App Expo ─────────────────────┼→ Railway/Render/Fly (API Express :$PORT)
                              ├→ Postgres gerenciado (mesmo provedor, Neon ou Supabase)
                              ├→ Redis gerenciado (mesmo provedor ou Upstash)
                              └→ Workers (2º serviço, mesmo código, sem porta pública)
```

Pipelines (`.github/workflows/`): `pr.yml` (testes em todo PR) → merge em `develop` →
`deploy-staging.yml` → merge em `main` → `deploy-production.yml` (aprovação manual + backup).

### Fase 2.1 — Banco de dados e Redis gerenciados (a base de tudo)

**Por quê:** banco local morre com seu PC. Produção exige Postgres com backup automático,
e Redis **com persistência** (fila sem persistência perde emails/jobs num restart).

1. Crie um Postgres 16 gerenciado — dois projetos ou dois bancos: **produção** e **staging**
   (opções: Railway, Render, Neon, Supabase). Anote as duas `DATABASE_URL`.
2. Crie um Redis gerenciado — também prod + staging (Railway, Render ou Upstash). Anote as `REDIS_URL`.
3. Aplique o schema **antes** do primeiro deploy (de onde tiver acesso ao banco):
   ```bash
   cd backend
   DATABASE_URL="<url-staging>" npx prisma migrate deploy
   DATABASE_URL="<url-prod>"    npx prisma migrate deploy
   ```
   **Conceito — `migrate deploy` vs `migrate dev`:** `dev` cria migrations (interativo, só local);
   `deploy` apenas **aplica** o que já existe (seguro, feito para CI). O workflow repete isso a
   cada deploy, então este passo manual é só para a estreia.

### Fase 2.2 — Backend: API como serviço persistente

**Por quê:** a API precisa estar sempre no ar (webhooks dos gateways chamam **ela**, não a Vercel)
e com processo contínuo. Serverless não serve aqui.

1. Na Railway/Render/Fly.io, crie um serviço a partir do repo (o build usa `backend/Dockerfile`):
   - Build: `npm ci && npx prisma generate && npm run build`
   - Start: `node dist/index.js` (a porta vem de `$PORT` — o código já lê `process.env.PORT`)
2. Cadastre **todas** as variáveis do `backend/.env.example` com valores de produção:
   - Conexão: `DATABASE_URL`, `REDIS_URL`
   - URLs públicas: `APP_URL` (web, ex: `https://seusite.com`), `BACKEND_URL` (API, ex: `https://api.seusite.com`)
   - Segredo: `JWT_SECRET` longo e aleatório (gere com `openssl rand -hex 32` — **nunca** reuse o de dev; sem ele, a API nem sobe em produção, por design)
   - Pagamentos: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MP_ACCESS_TOKEN`
   - Vídeo: `MUX_TOKEN_ID/SECRET`, `MUX_SIGNING_KEY_ID/PRIVATE`
   - Social: `GOOGLE_CLIENT_ID/SECRET` (só se `NEXT_PUBLIC_GOOGLE_ENABLED=true` na web)
   - Email/filas: `RESEND_API_KEY`, `QUEUES_DASHBOARD_USER/PASS` (Bull Board)
3. **Como confirmar:** `https://api.seusite.com/health` → `{"ok":true}`.

**Erro comum:** `JWT_SECRET é obrigatório em produção` no log = variável esquecida. API fora do ar
após deploy = `$PORT` não exposta ou `DATABASE_URL` errada (teste com `migrate deploy` local).

### Fase 2.3 — Workers como serviço separado (não pule!)

**Por quê:** relembrando a Fase 1.4 — sem este serviço, **nada assíncrono acontece em produção**:
sem email de boas-vindas, sem certificado, sem push, sem processamento de vídeo. E em produção
não há fallback em memória (ele só existe quando `REDIS_URL` está vazia, o que nunca deve
ocorrer em prod).

1. No mesmo provedor, crie um **segundo serviço** com o mesmo código e as mesmas envs, mas:
   - Start: `npm run start:workers` (ou `node dist/workers/index.js` se o build incluir workers)
   - **Sem porta pública** (é background puro).
2. Garanta que ele enxerga o mesmo Redis (mesma rede/projeto).
3. **Como confirmar:** Bull Board em `https://api.seusite.com/admin/queues` (basic auth) mostra as
   4 filas; faça uma compra de teste e veja o job `welcome-email` ser consumido.

### Fase 2.4 — Frontend web na Vercel

**Por quê:** a Vercel é o habitat natural do Next.js (build, CDN e previews automáticos por PR).

1. Importe o repo na Vercel com **Root Directory: `frontend/`** (sem isso o build falha — o
   `package.json` do Next está na subpasta, não na raiz).
2. Variáveis por ambiente (Production e Preview/Staging):
   - `NEXT_PUBLIC_API_URL` → URL pública da API (`https://api.seusite.com` em prod;
     a da API de staging no Preview). **Atenção:** variáveis `NEXT_PUBLIC_*` entram no JS do
     build — trocar exige **rebuild/redeploy**, não basta salvar.
   - `NEXT_PUBLIC_GOOGLE_ENABLED` → `true` só com OAuth configurado (Fase 2.5).
3. Deploy automático a cada push; previews por PR permitem testar a web antes do merge.
4. **Como confirmar:** abra a URL, cadastre-se e veja o tráfego chegar à API (logs).

### Fase 2.5 — Webhooks e OAuth: apresentando sua API ao mundo

**Por quê:** gateways não adivinham sua URL — você registra **onde** eles devem bater, e cada um
assina as chamadas com um segredo para ninguém fingir pagamento. Configure **staging primeiro**,
sempre com chaves de teste.

| Serviço | Onde configurar | URL a registrar | Segredo resultante |
|---|---|---|---|
| Stripe | Dashboard → Developers → Webhooks | `POST https://api.seusite.com/api/webhooks/stripe` (eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`) | `STRIPE_WEBHOOK_SECRET` |
| Mercado Pago | Automático: o `notification_url` já vai no checkout apontando `BACKEND_URL` | `POST https://api.seusite.com/api/webhooks/mercadopago` | `MP_ACCESS_TOKEN` (teste em staging) |
| Mux | Dashboard → Webhooks | `POST https://api.seusite.com/api/webhooks/mux` (`video.asset.ready`) | credenciais Mux |
| Google | Cloud Console → Credentials → OAuth | Redirect autorizado `https://api.seusite.com/api/auth/google/callback` | `GOOGLE_CLIENT_ID/SECRET` |

**Como confirmar:** repita o roteiro de fumaça da Fase 1.6 em staging, agora com dinheiro de
mentira (cartão `4242…`, Pix de teste) e observe no Bull Board e no `prisma studio` apontado ao
banco de staging: pagamento `PAID` + matrícula `ACTIVE`.

### Fase 2.6 — App mobile: EAS Build e lojas

**Por quê:** celular não roda `npx expo start` de produção — é preciso compilar binários (`aab`/`apk`,
`ipa`) e publicá-los nas lojas. O `frontend/mobile/eas.json` já tem os 3 perfis.

```bash
cd frontend/mobile
npm install -g eas-cli
eas build --platform android --profile staging     # EXPO_PUBLIC_API_URL de staging
eas build --platform android --profile production  # URL de produção
eas build --platform ios --profile production
eas submit --platform android                      # envia à Play Store
eas submit --platform ios                           # envia à App Store
```

**Conceitos importantes:**
- Cada perfil congela a `EXPO_PUBLIC_API_URL` no binário — app de staging nunca fala com produção.
- Teste o binário de staging num device físico (Expo Go não valida push/download offline 100%).
- **Atenção iOS (spec mobile §9):** conteúdo digital comprado dentro do app pode exigir In-App
  Purchase (comissão de até 30%). O MVP abre o checkout no **navegador do sistema** justamente
  para não pagar a comissão — valide com compliance da App Store antes de escalar, pois a Apple
  pode rejeitar o app se entender que há contorno indevido.

### Fase 2.7 — CI/CD: robôs que impedem erro humano

**Por quê:** deploy manual é onde nascem os incidentes ("esqueci de rodar a migration").
Os workflows fazem sempre a mesma sequência, e a branch `main` só aceita código verde.

- `pr.yml`: a cada Pull Request — lint, type-check, `migrate deploy` + testes num Postgres
  service efêmero, e build. A Vercel ainda gera preview por PR de graça.
- `deploy-staging.yml`: push em `develop` → migrate no banco de staging → deploy Vercel staging.
- `deploy-production.yml`: push em `main` → **aprovação manual** (configure em
  GitHub → Settings → Environments → `production`) → **backup `pg_dump` guardado 30 dias como
  artifact** → migrate → deploy.
- Secrets (`Settings → Secrets and variables → Actions`): `PRODUCTION_DATABASE_URL`,
  `STAGING_DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  (+ token do provedor do backend, se o deploy for via CLI).
- **Como confirmar:** abra a aba Actions, faça um PR de teste e veja tudo verde; proteja `main`
  em Settings → Branches exigindo o workflow (`Require status checks to pass`).

### Fase 2.8 — Pós-deploy: checklist da estreia e plano de rollback

**Checklist (não pule nenhum):**
- [ ] `/health` da API responde `{"ok":true}`
- [ ] Compra de teste ponta a ponta **em staging** (pagamento → matrícula → progresso → certificado)
- [ ] Bull Board acessível com basic auth; workers sem erro nos logs; Redis com persistência
- [ ] Chaves de **teste** em staging, chaves **reais** só em produção (nunca misture)
- [ ] `JWT_SECRET` de produção diferente do de dev/staging
- [ ] Push e email de boas-vindas chegando; download offline expirando em 30 dias

**Se algo der errado (rollback):**
- **Código:** promova o deploy anterior na Vercel (`vercel rollback`) e selecione a versão anterior
  no serviço da API (Railway/Render guardam histórico).
- **Banco:** baixe o dump do artifact do workflow (`pg_restore`) — por isso o backup corre
  **antes** de cada migration em produção.
- **Prevenção:** prefira migrations aditivas; remover coluna se faz em 2 deploys
  (1º para de usar no código, 2º remove do banco dias depois).

---
---

## Referência rápida de comandos

| Ação | Comando |
|---|---|
| Subir Postgres+Redis local | `docker compose -f infra/docker-compose.yml up -d` |
| Migration dev / prod | `cd backend && npx prisma migrate dev` · `DATABASE_URL="<url>" npx prisma migrate deploy` |
| API / workers / web | `npm run dev` · `npm run start:workers` · (web) `npm run dev` |
| Testes | `npm test` · `npm run test:coverage` · `npm run test:containers` |
| Ver dados / primeiro admin | `npx prisma studio` · `UPDATE users SET role='ADMIN' WHERE email='...'` |
| Mobile / build lojas | `npx expo start` · `eas build --platform android --profile production` |
| Webhooks dev | `stripe listen --forward-to localhost:4000/api/webhooks/stripe` |
