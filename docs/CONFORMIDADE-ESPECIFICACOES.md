# Conformidade do Projeto com as Especificações

Auditoria realizada em 21/09/2026 por verificação direta do código (leituras e buscas no repositório).
Legenda: ✅ Atendido · ⚠️ Parcial / divergência justificada · ❌ Não atendido (gap/backlog).

## 1. `schema-e-pagamentos.md` — ✅ Atendido (alto)

- Schema Prisma idêntico à spec: `backend/prisma/schema.prisma` contém os 9 enums e os 9 models originais
  (`User`, `Course`, `Module`, `Lesson`, `Enrollment`, `LessonProgress`, `Payment`, `Certificate`, `Coupon`),
  acrescido das extensões previstas nas demais specs (`Plan`, `PlanCourse`, `Subscription`,
  `PasswordResetToken`, `FailedJob`).
- Decisões preservadas: preço em centavos (`Int`), `videoAssetId` (ID do provedor, não URL),
  `gatewayChargeId @unique` (idempotência), `Enrollment @@unique([userId, courseId])`.
- Stripe: checkout `mode: payment` com `metadata {userId, courseId}` (`src/routes/checkout.ts:22`);
  webhook valida assinatura via `constructEvent` com `rawBody` (`src/index.ts` + `src/routes/webhooks.ts:27`),
  checa duplicata por `gatewayChargeId` e usa `$transaction` pagamento + `enrollment.upsert`
  (`src/routes/checkout.ts:9-20`).
- Mercado Pago: preferência com `unit_price` decimal em BRL (`src/routes/checkout.ts`),
  webhook busca o pagamento real na API e só libera com `status === "approved"` (`src/routes/webhooks.ts:96`).
- Migration aplicada: `backend/prisma/migrations/20260921182306_init/` (banco `cursosana` sincronizado).
- ✅ Mux real (implementado em 22/09/2026): `@mux/mux-node` nas `dependencies` e
  `POST /api/lessons/admin/:id/upload` criando upload direto com `playback_policy: ["signed"]`,
  guardado por `requireRole` + `assertOwnsCourse` e salvando o `upload_id` para o webhook trocar
  pelo `playback_id` (`src/routes/lessons.ts:42-70`). Sem chaves, mantém o caminho mockado.

## 2. `arquitetura-plataforma-cursos.md` — ⚠️ Parcial (divergência arquitetural justificada)

- ✅ Os 6 blocos estão cobertos: auth, catálogo, pagamentos/acesso, vídeo, progresso/certificados, comunicação (fila de email).
- ✅ Fluxos críticos implementados: liberação só via webhook, `playback_id` + URL assinada,
  progresso a cada 15 s com conclusão a 90%, certificado ao completar 100%.
- ⚠️ Divergência solicitada pelo usuário: em vez do monorepo `apps/web+admin+api` + `packages/`,
  o projeto usa pastas distintas `backend/` (Express) e `frontend/` (Next.js). Não há
  `packages/shared-types`/`ui` nem Turborepo — tipos são duplicados entre as duas pastas.
- ✅ LGPD (implementado em 22/09/2026): `termsAcceptedAt` no `User` (migration
  `lgpd_consent`), cadastro exige `termsAccepted: true`, `GET/DELETE /api/users/me`
  (eliminação: apaga progresso/tokens, cancela matrículas/assinaturas, anonimiza conta —
  pagamentos mantidos por obrigação fiscal), página `/privacidade`, checkbox de consentimento
  no cadastro e `/perfil` com zona de perigo em 2 cliques. Coberto por `tests/lgpd.test.ts`.

## 3. `painel-admin-e-autenticacao.md` — ⚠️ Parcial

- ✅ Rotas admin (`/admin`, `/cursos`, `/alunos`, `/financeiro`, `/planos`), layout com sidebar,
  `requireRole` + `assertOwnsCourse` no backend (`src/middleware/auth.ts`, `src/routes/courses.ts`),
  reordenação de módulos em `$transaction`, validações Zod (título min 3, descrição min 10, preço ≥ 0),
  publish exige ≥ 1 módulo, delete restrito a ADMIN.
- ✅ Reset de senha: resposta idêntica exista ou não o email, token de 32 bytes, expiração de 30 min,
  uso único via `usedAt` (`src/routes/auth.ts:52-73`).
- ⚠️ Divergência arquitetural: a spec usa Next.js Server Actions + Auth.js/NextAuth; aqui a API é
  REST Express com JWT próprio (consequência da separação frontend/backend).
- ✅ Guarda de navegação em duas camadas (implementado em 22/09/2026): `frontend/middleware.ts`
  (edge — barra `/admin/*` sem role ADMIN/INSTRUCTOR no JWT, barra área do aluno sem sessão,
  tira logado das telas de login) + `frontend/app/admin/layout.tsx` (server — lê o cookie
  `auth_token`, decodifica a role e dá `redirect`, sidebar recebe a role real em vez de hard-coded).
  Sessão espelhada em cookie via `frontend/lib/auth-client.ts` (`saveSession`, usado no login/cadastro).
  A autorização real continua na API — o middleware é defesa em profundidade, como manda a spec §2.7.
- ✅ Login social Google (implementado em 22/09/2026, fluxo OAuth Authorization Code):
  `GET /api/auth/google` → consentimento, `GET /api/auth/google/callback` → troca code por tokens,
  cria/acha usuário sem `passwordHash` e redireciona com o JWT (`src/routes/auth.ts`);
  frontend com página `/google/callback` que salva a sessão e botão condicional a
  `NEXT_PUBLIC_GOOGLE_ENABLED` (escondido sem `GOOGLE_CLIENT_ID/SECRET` + `BACKEND_URL` configurados).
- ✅ Editor de currículo com drag-and-drop (implementado em 22/09/2026): `CurriculumBuilder`
  (`@dnd-kit/core` + `sortable`, reordenação otimista com POST transacional), renomear/criar/excluir
  módulos e aulas com `toast`, `VideoStatusBadge` e badge "Gratuita"; página da aula com
  `LessonEditor` (título, toggle de preview) + `VideoUploader` (upload resumível via `@mux/upchunk`
  direto ao Mux, polling até o webhook trocar `upload_id` por `playback_id`, aviso quando sem
  credenciais). Backend com `GET /api/admin/courses/:id`, `PATCH`/`DELETE` de módulos e aulas,
  reorder de aulas e `GET`/`PATCH` de aula — tudo com `assertOwnsCourse` (inclusive fechado o gap
  de criação de aula sem dono em `courses.ts`). Coberto por `tests/admin-curriculum.test.ts`.

## 4. `assinaturas-video-certificados.md` — ⚠️ Parcial (backend alto, frontend médio)

- ✅ `Plan`/`PlanCourse`/`Subscription`, função única `hasAccessToCourse` (`src/lib/access.ts:4`),
  checkout de assinatura Stripe (`mode: subscription`) e Preapproval MP, webhooks `invoice.paid`,
  `invoice.payment_failed` → `PAST_DUE`, `subscription.deleted` → `CANCELED` (`src/routes/webhooks.ts:53-76`).
- ✅ Mux: upload direto, webhook `video.asset.ready` troca `upload_id` por `playback_id`,
  URL assinada JWT com expiração de 4 h **após** checar acesso (`src/routes/lessons.ts:17`),
  helper Bunny com SHA256 (`src/lib/video.ts`); player com `nodownload`, bloqueio de context menu
  e POST de progresso a cada 15 s (`components/VideoPlayer.tsx:29-40`).
- ✅ Certificado com `verificationHash` aleatório e página pública `/certificados/verificar/[hash]`.
- ✅ PDF real (implementado em 22/09/2026): `src/lib/generate-certificate-pdf.ts` gera A4
  landscape com nome/curso/data/URL de verificação via `pdf-lib` (puro JS — divergência consciente
  do Puppeteer da spec, que exigiria Chromium; mesmo conteúdo e mesma URL pública), gravado em
  `storage/certificates/<hash>.pdf` e servido em `/files` (`src/index.ts`); página de verificação
  com botão "Baixar PDF". Coberto por `tests/certificates.test.ts` (magic number `%PDF`, não emite
  antes de 100%).
- ❌ Emissão via fila só funciona com Redis; sem ele, cai no fallback em memória (volátil).

## 5. `fila-assincrona-bullmq.md` — ⚠️ Parcial

- ✅ Três filas (`email`, `certificate`, `video-processing`), `attempts` + `backoff` exponencial,
  `jobId` fixo anti-duplicata no certificado (`src/lib/queue.ts:22-37`), workers em processo separado
  com concorrência 10/3/5 (`src/workers/workers.ts`), model `FailedJob` com registro no esgotamento.
- ✅ Bull Board (implementado em 22/09/2026): `src/workers/dashboard.ts` montado em
  `/admin/queues`, protegido por basic auth (`QUEUES_DASHBOARD_USER/PASS`, 503 se não
  configurado — nunca público), com as 3 filas. Requer Redis acessível.

## 6. `testes-e-cicd.md` — ⚠️ Parcial

- ✅ Vitest configurado (`vitest.config.ts`, scripts `test`/`test:watch`), 4 testes passando
  (slugify, URLs assinadas, contrato de `hasAccessToCourse`); `pr.yml` com Postgres service,
  lint, type-check, `migrate deploy` e testes; `deploy-production.yml` com `environment: production`
  (aprovação manual).
- ✅ Testes críticos implementados em 22/09/2026 (13/13 passando, Postgres real `cursosana_test`,
  sem mocks de banco): `tests/webhooks-stripe.test.ts` (sucesso → PAID+ACTIVE, idempotência no reenvio,
  assinatura inválida → 400 sem tocar no banco, com HMAC real via `generateTestHeaderString`),
  `tests/course-ownership.test.ts` (instrutor não edita curso alheio nem deleta — 403),
  `tests/password-reset.test.ts` (token válido troca a senha — provado via login —, reuso e
  expiração rejeitados). `tests/setup.ts` faz TRUNCATE por teste; `vitest.config.ts` roda os
  arquivos em sequência (`singleFork`) para não apagar fixtures entre arquivos.
- ✅ Coverage (implementado em 22/09/2026): `@vitest/coverage-v8@2.1.9` (pinado ao vitest 2 —
  o latest exigiria vitest 5), script `test:coverage`, ~49% stmts / 55% branch (rotas 41%,
  workers 18%). `testTimeout` de 30 s na suite de integração (bcrypt + Postgres real).
- ✅ Setup alternativo com Testcontainers (`tests/setup.testcontainers.ts` + config própria,
  `npm run test:containers`, Postgres 16 efêmero por execução). Não executável neste ambiente
  (Docker daemon inativo) — validado por `tsc`, padrão segue a spec §1.2.
- ⚠️ Achado e corrigido: o Vite injeta o `.env` (chaves vazias) antes do setup, e o `??=`
  preservava o vazio — os testes de webhook caíam no caminho mock sem validar HMAC. Setup agora
  usa atribuição direta das chaves de teste, garantindo o caminho real de `constructEvent`.
- ❌ Sem workflow de staging (`develop`), sem backup pré-migration, sem notificação Slack,
  sem `test:coverage`.

## 7. `spec-app-mobile-netflix.md` — ⚠️ Parcial (web responsivo, sem Expo)

- ✅ Identidade visual e componentes web equivalentes: tokens, `HeroBanner`, `CourseCarousel`/`CourseCard`
  com barra de progresso, tabbar de 5 itens, telas home/detalhe/player/checkout/meus-cursos;
  API pronta para mobile: `GET /api/mobile/home` agregado e `POST /api/auth/mobile/login` (JWT).
- ✅ App Expo MVP Fase 1 (implementado em 22/09/2026, `frontend/mobile/`): Expo Router com
  as rotas da spec §4, login JWT em `SecureStore`, home via `GET /api/mobile/home` com TanStack
  Query (`staleTime` 5 min), busca em `GET /api/courses?q=` (novo filtro `contains` no backend),
  detalhe com módulos, player `expo-video` com mesma URL assinada + progresso 15 s + overlay
  "próxima aula", checkout no navegador do sistema (`expo-web-browser`), `eas.json`
  (development/staging/production). `tsc` limpo; não executado em emulador.
  Fase 2 pendente: downloads offline, push, Chromecast/AirPlay, perfis múltiplos, tablet.
  → Fase 2 implementada em 22/09/2026: downloads offline AES (`lib/downloads.ts`, rendition MP4
  via `GET /api/lessons/:id/download-url` com checagem de acesso, expiração 30 dias,
  `purgeExpired` por abertura, `?offline=1` no player), push end-to-end (model `PushToken`,
  fila `push` + worker Expo Push API, triggers em compra e `invoice.payment_failed`) e busca com
  sugestões (`GET /api/courses/suggest` top-5 + dropdown). `tsc` limpo nos 3 projetos; mobile não
  executado em emulador. Restante futuro: Chromecast/AirPlay, perfis múltiplos, tablet.

## 8. `spec-frontend-painel-admin.md` — ⚠️ Parcial

- ✅ Paleta admin (`#FAFAF9`, acento `#6D4FC7`), sidebar com filtro por `role`,
  layout topbar+sidebar, dashboard/alunos/financeiro/planos, editor com abas.
- ✅ Telas ligadas à API (implementado em 22/09/2026): novo endpoint `GET /api/admin/courses`
  (filtrado por papel, com `_count` de matrículas/módulos), helper server-side `lib/admin-api.ts`
  (repassa o JWT do cookie como Bearer), dashboard com `StatCard` + gráfico `RevenueChart` (recharts)
  + top cursos, tabelas de cursos/alunos/financeiro/planos com dados reais, `EmptyState` com ação
  direta em toda lista, `Toaster` + `toast` (sonner) no layout e nas ações (criar/publicar), e
  `CourseActions` com publicar inline. Coberto por `tests/admin-courses.test.ts`.
- ⚠️ Restante da spec: sem shadcn, TanStack Table, react-hook-form, Tiptap, `ConfirmDeleteDialog`
  (exclusão com digitação do nome), `handleAction` único ou drawer mobile — tabelas são HTML
  simples e exclusão de curso ainda não tem tela.

## 9. `mockup-telas-app.html` — ✅ Atendido (alto)

- Cores exatas (`#1E1830`, `#2A2340`, `#9B5DE5`, `#D9B8FF`, `#B3A9C2`), fontes Bebas Neue + Inter,
  hero "EM ALTA" com gradiente, 3 carrosséis (progressos 70/35/90%), tabbar Início/Buscar/Downloads/
  Minha Lista/Perfil, tela de detalhe com módulos expansíveis e player com bloco "Próxima aula".

## Backlog priorizado (o que falta para conformidade total)

Itens 1–9 + épicos (LGPD, Expo MVP e Fase 2 mobile) concluídos em 22/09/2026 (24 testes passando).

6. [Médio — concluído] Admin ligado à API + `sonner`/`recharts` em uso.
7. [Médio — concluído] `dnd-kit` no editor + `VideoUploader` funcional.
8. [Médio — concluído] `.gitignore` raiz (cobre `.env`, `node_modules`, `.next`, `dist`,
  `storage/` de PDFs gerados; lockfiles e `migration_lock.toml` seguem commitados),
  workflow `deploy-staging.yml` (branch `develop` → migrate + Vercel staging, sem aprovação manual)
  e backup `pg_dump` com upload de artifact (30 dias) antes de toda migration em produção.
9. [Baixo — concluído] Bull Board protegido; Testcontainers (setup alternativo); `test:coverage`.
