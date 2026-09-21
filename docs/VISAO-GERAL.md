# CursosAna — Visão Geral do Projeto

Plataforma de cursos online (vitrine estilo streaming + painel administrativo + app mobile),
implementada a partir das 9 especificações em `docs/specs/` (ver §7). Conformidade auditada em
`docs/CONFORMIDADE-ESPECIFICACOES.md`.

## 1. O que a plataforma faz

- **Aluno (web e mobile):** catálogo estilo Netflix, compra avulsa (cartão/Pix/boleto) ou
  assinatura mensal, player com URL assinada, progresso automático, certificado com verificação
  pública, downloads offline no mobile, push notifications, conta com LGPD (privacidade e exclusão).
- **Instrutor/Admin (web):** CRUD de cursos/módulos/aulas com drag-and-drop, upload de vídeo direto
  ao Mux, publicação, matrículas, financeiro (receita, MRR, churn), planos, dashboard de receita.

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Web | Next.js 14 (App Router) + Tailwind + recharts + sonner + dnd-kit + UpChunk |
| Mobile | Expo 51 (Router, SecureStore, Video, FileSystem, Notifications) + TanStack Query |
| API | Node 20 + Express + Prisma 5 + PostgreSQL 16 |
| Auth | JWT próprio (senha bcrypt + Google OAuth code flow) |
| Pagamentos | Stripe + Mercado Pago (webhooks idempotentes) |
| Vídeo | Mux (upload direto, playback assinado) + alternativa Bunny |
| Assíncrono | BullMQ + Redis (filas email, certificate, video, push) + Bull Board |
| Testes/CI | Vitest + Postgres real (+ Testcontainers opcional) + GitHub Actions |

## 3. Estrutura de pastas

```
CursosAna/
├── backend/                 # API (porta 4000)
│   ├── prisma/              # schema + migrations (init, lgpd-consent, push-tokens)
│   ├── src/
│   │   ├── index.ts         # app Express (+ /files estático, Bull Board /admin/queues)
│   │   ├── lib/            # prisma, auth/JWT, access, video, certificates, pdf, queue, push
│   │   ├── middleware/      # auth, requireRole, assertOwnsCourse
│   │   ├── routes/          # auth, users, courses, lessons, checkout, webhooks,
│   │   │                    # certificates, plans, admin, mobile
│   │   └── workers/         # email, certificate, video, push + dashboard Bull Board
│   └── tests/               # 10 arquivos, 24 testes (setup Postgres + variante containers)
├── frontend/                # Web Next.js (porta 3000)
│   ├── app/                 # vitrine, auth, aluno, checkout, certificados, admin, perfil, privacidade
│   ├── components/          # streaming + admin (dnd-kit, recharts, sonner, uploader)
│   ├── lib/                 # api, auth-client (cookie espelho), admin-api
│   ├── middleware.ts        # gating de rotas por JWT/role
│   └── mobile/              # App Expo (Fase 1 + Fase 2)
├── infra/docker-compose.yml # Postgres + Redis locais
├── .github/workflows/       # pr, deploy-staging, deploy-production
└── docs/                    # specs, conformidade, visão geral, implantação
```

## 4. Fluxos principais

1. **Compra:** checkout → gateway → **webhook** valida assinatura → `$transaction`
   (pagamento + matrícula) → fila email/push de boas-vindas. A tela de sucesso nunca libera acesso.
2. **Aula:** aluno abre → `hasAccessToCourse` (matrícula OU assinatura) → URL HLS assinada (4 h) →
   progresso a cada 15 s → 90% conclui → fila de certificado → PDF + página pública de verificação.
3. **Instrutor:** cria curso (DRAFT) → módulos/aulas (drag-and-drop) → upload direto ao Mux →
   webhook `video.asset.ready` → publica (exige ≥1 módulo).
4. **Assinatura:** Stripe Subscription / MP Preapproval; `invoice.payment_failed` → `PAST_DUE`
   + push de cobrança; acesso mantido até `currentPeriodEnd`.

## 5. Segurança (resumo)

JWT 30 d, bcrypt 12 rounds, `requireRole` + `assertOwnsCourse` em toda rota sensível,
middleware + layout gated no frontend, webhooks com HMAC, idempotência por `gatewayChargeId`,
rate limiting, reset de senha anti-enumeração com token único de 30 min, LGPD
(consentimento timestampado, anonimização e revogação na exclusão).

## 6. Como rodar / implantar

- Desenvolvimento local e nuvem: ver `docs/IMPLANTACAO.md` (passo a passo).

## 7. Especificações de origem (`docs/specs/`)

| Arquivo | Assunto |
|---|---|
| `01-arquitetura-plataforma-cursos.md` | Visão, stack, pastas, fluxos, roadmap |
| `02-schema-e-pagamentos.md` | Schema Prisma + Stripe + Mercado Pago |
| `03-painel-admin-e-autenticacao.md` | CRUD admin + autenticação completa |
| `04-assinaturas-video-certificados.md` | Recorrência + player seguro + certificados |
| `05-fila-assincrona-bullmq.md` | Filas, workers, Bull Board, dead letter |
| `06-testes-e-cicd.md` | Vitest + deploys staging/produção |
| `07-spec-app-mobile-netflix.md` | App Expo estilo Netflix (+ Fase 2) |
| `08-spec-frontend-painel-admin.md` | Design system e telas do admin |
| `09-mockup-telas-app.html` | Mockup visual (abrir no navegador) |
