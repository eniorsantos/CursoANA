# CursosAna — Plataforma de Cursos

Monorepo com pastas distintas para frontend e backend, implementado a partir das
especificações em `docs/specs/`.

## Documentação

| Documento | Conteúdo |
|---|---|
| `docs/VISAO-GERAL.md` | O que é, stack, pastas, fluxos, segurança |
| `docs/IMPLANTACAO.md` | **Passo a passo de implantação local e em nuvem** |
| `docs/CONFORMIDADE-ESPECIFICACOES.md` | Auditoria item a item contra as specs + backlog |
| `docs/specs/` | Os 9 arquivos de especificação originais (inclui mockup HTML) |
| `backend/README.md` | Referência da API (rotas) |
| `frontend/mobile/README.md` | App Expo (Fases 1 e 2) |

## Estrutura

```
CursosAna/
├── backend/    # API Express + Prisma + JWT + Stripe/MP + Mux + BullMQ + Vitest (:4000)
├── frontend/   # Web Next.js 14 — vitrine streaming + painel admin (:3000)
│   └── mobile/ # App Expo (Fase 1 + Fase 2)
├── infra/docker-compose.yml  # Postgres + Redis locais
├── .github/workflows/        # pr, deploy-staging, deploy-production
└── docs/                     # toda a documentação
```

## Início rápido (local)

```bash
docker compose -f infra/docker-compose.yml up -d   # ou use seu Postgres/Redis local
cp backend/.env.example backend/.env               # ajuste DATABASE_URL/REDIS_URL
cd backend && npm install && npx prisma migrate dev && npm run dev        # :4000
cd backend && npm run start:workers                                          # filas
cd frontend && npm install && npm run dev                                     # :3000
```

Detalhes, variáveis de ambiente e nuvem (Vercel, Railway/Render, EAS): ver
`docs/IMPLANTACAO.md`.

## Decisões centrais (das specs)

- Preços em centavos (`Int`), `gatewayChargeId @unique` (idempotência), `Enrollment @@unique(user,course)`.
- Acesso liberado **só via webhook**, nunca pela tela de sucesso.
- Vídeo: guarda `videoAssetId`, URL assinada de 4 h após `hasAccessToCourse`.
- Certificado: `verificationHash` aleatório + página pública de verificação.
- Filas BullMQ (fallback em memória sem Redis); workers em processo separado.
- Mobile: `GET /api/mobile/home` agregado + JWT em SecureStore.
