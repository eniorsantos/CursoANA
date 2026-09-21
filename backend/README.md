# Backend — API CursosAna
Express + Prisma (Postgres) + JWT + Stripe + Mercado Pago + Mux + BullMQ.

Rotas:
- `POST /api/auth/signup|login|recuperar-senha|redefinir-senha`, `POST /api/auth/mobile/login`
- `GET /api/courses`, `GET /api/courses/:slug`, `GET /api/courses/:id/access`
- `POST/PATCH /api/courses`, `POST /api/courses/:id/publish` (exige módulo), `DELETE` (só ADMIN)
- `GET /api/lessons/:id/playback-url` (checa acesso), `POST /api/lessons/:id/progress` (90% → certificado)
- `POST /api/checkout/stripe|mercadopago` + `/stripe/subscription` + `/mercadopago/subscription`
- `POST /api/webhooks/stripe|mercadopago|mux`
- `GET /api/certificates/verificar/:hash` (pública), `GET /api/certificates/me`
- `GET /api/plans`, `GET /api/admin/dashboard|enrollments|finance`, `GET /api/mobile/home`
