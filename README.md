# CursosAna — Plataforma de Cursos (monorepo frontend + backend separados)

Implementação fiel às especificações em `Downloads/`:
- `arquitetura-plataforma-cursos.md` → stack, pastas, fluxos, deploy
- `schema-e-pagamentos.md` → Prisma + Stripe + Mercado Pago
- `painel-admin-e-autenticacao.md` → CRUD admin + Auth.js/JWT + reset senha
- `assinaturas-video-certificados.md` → Plans/Subscriptions + Mux signed URL + certificados
- `fila-assincrona-bullmq.md` → BullMQ (email, certificate, video) + workers separados
- `testes-e-cicd.md` → Vitest + Postgres + GitHub Actions
- `spec-app-mobile-netflix.md` + `spec-frontend-painel-admin.md` + `mockup-telas-app.html` → frontend

## Estrutura
```
CursosAna/
  backend/    # API Express + Prisma + JWT + Stripe/MP + Mux + BullMQ + Vitest
    prisma/schema.prisma  # idêntico à spec (+Plan/Subscription/PasswordResetToken/FailedJob)
    src/{index,lib,middleware,routes,workers}
  frontend/   # Next.js 14 — vitrine streaming (#1E1830/Bebas) + admin claro (#FAFAF9/roxo #6D4FC7)
    app/{page(catalogo),curso/[slug],player/[lessonId],meus-cursos,checkout,certificados,admin/*,(auth)/*}
    components/{HeroBanner,CourseCarousel,VideoPlayer,admin/*}
  infra/docker-compose.yml  # Postgres + Redis local
  .github/workflows/        # pr.yml + deploy-production.yml
```

## Rodar local
```bash
docker compose -f infra/docker-compose.yml up -d
cp backend/.env.example backend/.env
cd backend; npm install; npx prisma migrate dev; npm run dev        # :4000
cd frontend; npm install; npm run dev                               # :3000
# workers (processo separado, nunca serverless):
cd backend; npm run start:workers
```

## Decisões (das specs)
- Preços em centavos (Int), `gatewayChargeId @unique` (idempotência), `Enrollment @@unique(user,course)`.
- Acesso liberado **só via webhook**, nunca pela tela de sucesso.
- Vídeo: guarda `videoAssetId`, gera URL assinada 4h após `hasAccessToCourse`.
- Certificado: `verificationHash` aleatório, página pública `/certificados/verificar/[hash]`.
- Fila: BullMQ com fallback em memória quando sem `REDIS_URL`.
- Mobile: `GET /api/mobile/home` agregado + `POST /api/auth/mobile/login` (JWT + SecureStore).
