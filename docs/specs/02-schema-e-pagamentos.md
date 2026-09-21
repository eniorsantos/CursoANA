# Schema do Banco (Prisma/SQL) + Integração de Pagamentos

## 1. Schema Prisma Completo

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  STUDENT
  INSTRUCTOR
  ADMIN
}

enum CourseStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum LessonType {
  VIDEO
  TEXT
  QUIZ
}

enum EnrollmentStatus {
  ACTIVE
  EXPIRED
  CANCELED
}

enum PaymentMethod {
  CARD
  PIX
  BOLETO
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum PaymentGateway {
  STRIPE
  MERCADO_PAGO
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?  @map("password_hash") // null se login social
  role         Role     @default(STUDENT)
  avatarUrl    String?  @map("avatar_url")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  coursesCreated Course[]         @relation("InstructorCourses")
  enrollments    Enrollment[]
  progress       LessonProgress[]
  payments       Payment[]
  certificates   Certificate[]

  @@map("users")
}

model Course {
  id            String       @id @default(cuid())
  title         String
  slug          String       @unique
  description   String
  thumbnailUrl  String?      @map("thumbnail_url")
  priceCents    Int          @map("price_cents") // sempre em centavos, nunca float
  status        CourseStatus @default(DRAFT)
  instructorId  String       @map("instructor_id")
  instructor    User         @relation("InstructorCourses", fields: [instructorId], references: [id])
  createdAt     DateTime     @default(now()) @map("created_at")
  updatedAt     DateTime     @updatedAt @map("updated_at")

  modules      Module[]
  enrollments  Enrollment[]
  payments     Payment[]
  certificates Certificate[]
  coupons      Coupon[]

  @@index([status])
  @@map("courses")
}

model Module {
  id       String @id @default(cuid())
  courseId String @map("course_id")
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title    String
  order    Int

  lessons Lesson[]

  @@index([courseId])
  @@map("modules")
}

model Lesson {
  id            String     @id @default(cuid())
  moduleId      String     @map("module_id")
  module        Module     @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  title         String
  type          LessonType @default(VIDEO)
  videoAssetId  String?    @map("video_asset_id") // ID do Mux/Bunny, não a URL direta
  durationSecs  Int?       @map("duration_secs")
  content       String?    // usado quando type = TEXT
  order         Int
  isFreePreview Boolean    @default(false) @map("is_free_preview")

  progress LessonProgress[]

  @@index([moduleId])
  @@map("lessons")
}

model Enrollment {
  id        String           @id @default(cuid())
  userId    String           @map("user_id")
  user      User             @relation(fields: [userId], references: [id])
  courseId  String           @map("course_id")
  course    Course           @relation(fields: [courseId], references: [id])
  status    EnrollmentStatus @default(ACTIVE)
  enrolledAt DateTime        @default(now()) @map("enrolled_at")
  expiresAt  DateTime?       @map("expires_at") // null = acesso vitalício

  @@unique([userId, courseId])
  @@index([userId])
  @@map("enrollments")
}

model LessonProgress {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  user           User     @relation(fields: [userId], references: [id])
  lessonId       String   @map("lesson_id")
  lesson         Lesson   @relation(fields: [lessonId], references: [id])
  watchedSeconds Int      @default(0) @map("watched_seconds")
  completed      Boolean  @default(false)
  completedAt    DateTime? @map("completed_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@unique([userId, lessonId])
  @@map("lesson_progress")
}

model Payment {
  id              String         @id @default(cuid())
  userId          String         @map("user_id")
  user            User           @relation(fields: [userId], references: [id])
  courseId        String         @map("course_id")
  course          Course         @relation(fields: [courseId], references: [id])
  amountCents     Int            @map("amount_cents")
  method          PaymentMethod
  gateway         PaymentGateway
  gatewayChargeId String         @unique @map("gateway_charge_id") // id da Stripe/MP
  status          PaymentStatus  @default(PENDING)
  couponId        String?        @map("coupon_id")
  coupon          Coupon?        @relation(fields: [couponId], references: [id])
  createdAt       DateTime       @default(now()) @map("created_at")
  paidAt          DateTime?      @map("paid_at")

  @@index([gatewayChargeId])
  @@index([userId])
  @@map("payments")
}

model Certificate {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  user            User     @relation(fields: [userId], references: [id])
  courseId        String   @map("course_id")
  course          Course   @relation(fields: [courseId], references: [id])
  certificateUrl  String   @map("certificate_url")
  verificationHash String  @unique @map("verification_hash")
  issuedAt        DateTime @default(now()) @map("issued_at")

  @@unique([userId, courseId])
  @@map("certificates")
}

model Coupon {
  id              String    @id @default(cuid())
  code            String    @unique
  discountPercent Int       @map("discount_percent")
  courseId        String?   @map("course_id") // null = aplica a qualquer curso
  course          Course?   @relation(fields: [courseId], references: [id])
  validUntil      DateTime? @map("valid_until")
  maxUses         Int?      @map("max_uses")
  usedCount       Int       @default(0) @map("used_count")

  payments Payment[]

  @@map("coupons")
}
```

**Decisões importantes embutidas no schema:**
- Preços em **centavos (Int)**, nunca `Float` — evita erros de arredondamento em dinheiro
- `videoAssetId` guarda o ID do provedor de vídeo, não uma URL — a URL assinada é gerada em tempo real
- `gatewayChargeId` é `@unique` — garante idempotência: o mesmo evento de webhook processado duas vezes não duplica pagamento
- `Enrollment` tem `@@unique([userId, courseId])` — impede matrícula duplicada no mesmo curso

---

## 2. SQL Equivalente (gerado pelo Prisma Migrate, resumido)

Você não escreve isso à mão normalmente (`npx prisma migrate dev` gera automaticamente), mas é útil entender o resultado:

```sql
CREATE TYPE "Role" AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE "PaymentGateway" AS ENUM ('STRIPE', 'MERCADO_PAGO');

CREATE TABLE "users" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "password_hash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE "courses" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT UNIQUE NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "instructor_id" TEXT NOT NULL REFERENCES "users"("id"),
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT'
);

CREATE TABLE "payments" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "users"("id"),
    "course_id" TEXT NOT NULL REFERENCES "courses"("id"),
    "amount_cents" INTEGER NOT NULL,
    "gateway_charge_id" TEXT UNIQUE NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "paid_at" TIMESTAMP
);

CREATE UNIQUE INDEX "enrollments_user_id_course_id_key" ON "enrollments"("user_id", "course_id");
```

Comandos do dia a dia com Prisma:
```bash
npx prisma migrate dev --name init      # cria e aplica migration
npx prisma studio                       # interface visual para ver os dados
npx prisma generate                     # gera o client tipado
```

---

## 3. Fluxo de Integração — Stripe (cartão internacional)

### 3.1 Criar sessão de checkout

```typescript
// lib/stripe.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});
```

```typescript
// app/api/checkout/stripe/route.ts
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  const { courseId } = await req.json();

  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: course.priceCents,
          product_data: { name: course.title },
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: user.id,
      courseId: course.id,
    },
    success_url: `${process.env.APP_URL}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/curso/${course.slug}`,
  });

  return Response.json({ url: session.url });
}
```

### 3.2 Webhook — a parte mais importante

**Nunca libere o curso na tela de sucesso.** O usuário pode fechar a aba, dar F5, ou o pagamento pode ser assíncrono (boleto/Pix). A única fonte confiável é o webhook do gateway.

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    // Validação de assinatura — impede que qualquer um chame esse endpoint fingindo ser a Stripe
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(`Webhook inválido: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, courseId } = session.metadata!;

    // Idempotência: se já processamos esse charge, não duplica
    const existing = await prisma.payment.findUnique({
      where: { gatewayChargeId: session.id },
    });
    if (existing) return new Response("ok", { status: 200 });

    await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          courseId,
          amountCents: session.amount_total!,
          method: "CARD",
          gateway: "STRIPE",
          gatewayChargeId: session.id,
          status: "PAID",
          paidAt: new Date(),
        },
      }),
      prisma.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      }),
    ]);

    // Disparar aqui: email de boas-vindas (fila assíncrona, ex: BullMQ)
  }

  return new Response("ok", { status: 200 });
}
```

> **Importante:** configure o endpoint do webhook no dashboard da Stripe apontando para essa rota, e nunca desative a validação de assinatura — é o que impede fraude de "fingir" um pagamento aprovado.

---

## 4. Fluxo de Integração — Mercado Pago (Pix, boleto, cartão no Brasil)

### 4.1 Criar preferência de pagamento

```typescript
// lib/mercadopago.ts
import { MercadoPagoConfig, Preference } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

export const preferenceClient = new Preference(client);
```

```typescript
// app/api/checkout/mercadopago/route.ts
import { preferenceClient } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  const { courseId } = await req.json();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });

  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          id: course.id,
          title: course.title,
          quantity: 1,
          unit_price: course.priceCents / 100, // MP trabalha com valor decimal, não centavos
          currency_id: "BRL",
        },
      ],
      payer: { email: user.email },
      metadata: { userId: user.id, courseId: course.id },
      back_urls: {
        success: `${process.env.APP_URL}/checkout/sucesso`,
        failure: `${process.env.APP_URL}/curso/${course.slug}`,
      },
      notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
      payment_methods: {
        excluded_payment_types: [], // permite Pix, boleto e cartão
      },
    },
  });

  return Response.json({ url: preference.init_point });
}
```

### 4.2 Webhook do Mercado Pago

O MP envia uma notificação simples (`{ type, data: { id } }`) e você precisa **buscar o pagamento completo pela API** para confirmar o status real — nunca confie apenas no payload da notificação.

```typescript
// app/api/webhooks/mercadopago/route.ts
import { MercadoPagoConfig, Payment } from "mercadopago";
import { prisma } from "@/lib/prisma";

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
const paymentClient = new Payment(client);

export async function POST(req: Request) {
  const body = await req.json();

  if (body.type !== "payment") {
    return new Response("ignorado", { status: 200 });
  }

  // Busca o pagamento real na API do MP — nunca confie só no webhook recebido
  const payment = await paymentClient.get({ id: body.data.id });

  if (payment.status !== "approved") {
    return new Response("aguardando confirmação", { status: 200 });
  }

  const { userId, courseId } = payment.metadata as { userId: string; courseId: string };

  const existing = await prisma.payment.findUnique({
    where: { gatewayChargeId: String(payment.id) },
  });
  if (existing) return new Response("ok", { status: 200 });

  const method =
    payment.payment_type_id === "pix"
      ? "PIX"
      : payment.payment_type_id === "ticket"
      ? "BOLETO"
      : "CARD";

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        userId,
        courseId,
        amountCents: Math.round(payment.transaction_amount! * 100),
        method,
        gateway: "MERCADO_PAGO",
        gatewayChargeId: String(payment.id),
        status: "PAID",
        paidAt: new Date(),
      },
    }),
    prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    }),
  ]);

  return new Response("ok", { status: 200 });
}
```

---

## 5. Diferenças-chave entre os dois fluxos

| Aspecto | Stripe | Mercado Pago |
|---|---|---|
| Confirmação | Webhook já vem com dados completos e assinados | Webhook é só um aviso — você precisa buscar o pagamento na API |
| Pix/boleto | Não suporta nativamente | Suporte nativo, mas pagamento pode demorar horas/dias (boleto) |
| Moeda | Trabalha em centavos (`unit_amount`) | Trabalha em valor decimal (`unit_price`) |
| Segurança | Validação de assinatura via `stripe-signature` header | Recomenda-se validar por `x-signature` header (HMAC) em produção |
| Uso recomendado | Alunos internacionais, pagamento recorrente/assinatura | Mercado brasileiro, Pix é o método mais convertido |

> Dica prática: para acesso "vitalício" ao curso, `expiresAt` fica `null`. Se for um modelo de assinatura mensal (acesso a vários cursos), o ideal é criar um model `Subscription` separado e usar `Stripe Subscriptions` ou `Mercado Pago Preapproval` em vez de pagamento único — é uma extensão natural desse mesmo schema.

---

## 6. Checklist de Segurança para Pagamentos

- [ ] Validar assinatura/HMAC de todo webhook antes de processar
- [ ] Usar transação de banco (`$transaction`) ao criar pagamento + matrícula juntos
- [ ] Nunca calcular o preço no frontend — sempre buscar do banco no backend
- [ ] Chave `gatewayChargeId` única para evitar processar o mesmo evento duas vezes
- [ ] Logar todos os webhooks recebidos (mesmo os inválidos) para auditoria
- [ ] Testar com o modo sandbox/test de ambos gateways antes de produção
