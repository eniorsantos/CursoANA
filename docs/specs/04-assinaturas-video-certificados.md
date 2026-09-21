# Assinaturas Recorrentes + Player de Vídeo Seguro + Certificados com Verificação

## PARTE 1 — Assinatura Recorrente (acesso mensal a vários cursos)

### 1.1 Por que isso muda o modelo de dados

Na compra única, `Enrollment` está ligada a UM curso. Na assinatura, o acesso é a uma **coleção de cursos** (ou a todos), e precisa expirar automaticamente se o pagamento recorrente falhar. Isso exige dois conceitos novos: `Plan` (o que está sendo vendido) e `Subscription` (o vínculo ativo do usuário com esse plano).

### 1.2 Schema Prisma adicional

```prisma
enum SubscriptionStatus {
  ACTIVE
  PAST_DUE      // pagamento falhou, mas ainda dentro do prazo de tolerância
  CANCELED
  EXPIRED
}

enum BillingInterval {
  MONTHLY
  YEARLY
}

model Plan {
  id              String           @id @default(cuid())
  name            String           // ex: "Plano Ilimitado"
  priceCents      Int              @map("price_cents")
  interval        BillingInterval  @default(MONTHLY)
  stripePriceId   String?          @map("stripe_price_id")
  mpPreapprovalPlanId String?      @map("mp_preapproval_plan_id")
  isAllCourses    Boolean          @default(true) @map("is_all_courses")

  courses      PlanCourse[]        // usado só se isAllCourses = false
  subscriptions Subscription[]

  @@map("plans")
}

// Relação N:N — planos que dão acesso só a um subconjunto de cursos
model PlanCourse {
  planId   String @map("plan_id")
  plan     Plan   @relation(fields: [planId], references: [id])
  courseId String @map("course_id")
  course   Course @relation(fields: [courseId], references: [id])

  @@id([planId, courseId])
  @@map("plan_courses")
}

model Subscription {
  id                    String             @id @default(cuid())
  userId                String             @map("user_id")
  user                  User               @relation(fields: [userId], references: [id])
  planId                String             @map("plan_id")
  plan                  Plan               @relation(fields: [planId], references: [id])
  status                SubscriptionStatus @default(ACTIVE)
  gateway               PaymentGateway
  gatewaySubscriptionId String             @unique @map("gateway_subscription_id")
  currentPeriodEnd      DateTime           @map("current_period_end")
  canceledAt            DateTime?          @map("canceled_at")
  createdAt             DateTime           @default(now()) @map("created_at")

  @@index([userId])
  @@map("subscriptions")
}
```

> A checagem de acesso deixa de olhar só `Enrollment` — agora também verifica se existe uma `Subscription` ativa cujo `Plan` cobre aquele curso. Vale centralizar isso numa única função `hasAccessToCourse(userId, courseId)` usada em toda a aplicação.

```typescript
// lib/access.ts
export async function hasAccessToCourse(userId: string, courseId: string) {
  const directEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (directEnrollment?.status === "ACTIVE") return true;

  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gt: new Date() },
      plan: {
        OR: [
          { isAllCourses: true },
          { courses: { some: { courseId } } },
        ],
      },
    },
  });
  return !!activeSubscription;
}
```

### 1.3 Stripe Subscriptions

```typescript
// app/api/checkout/stripe/subscription/route.ts
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  const { planId } = await req.json();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription", // <- diferença chave em relação ao pagamento único
    customer_email: user.email,
    line_items: [{ price: plan.stripePriceId!, quantity: 1 }],
    metadata: { userId: user.id, planId: plan.id },
    success_url: `${process.env.APP_URL}/checkout/sucesso`,
    cancel_url: `${process.env.APP_URL}/planos`,
  });

  return Response.json({ url: session.url });
}
```

Eventos de webhook que você precisa tratar (a Stripe dispara vários ao longo da vida da assinatura):

```typescript
// app/api/webhooks/stripe/route.ts (adicionando ao handler existente)

switch (event.type) {
  case "checkout.session.completed": {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription") {
      const { userId, planId } = session.metadata!;
      const stripeSubId = session.subscription as string;
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);

      await prisma.subscription.create({
        data: {
          userId,
          planId,
          gateway: "STRIPE",
          gatewaySubscriptionId: stripeSubId,
          status: "ACTIVE",
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        },
      });
    }
    break;
  }

  // Disparado a cada renovação mensal bem-sucedida — é aqui que você
  // estende o acesso, não no checkout inicial
  case "invoice.paid": {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubId = invoice.subscription as string;
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);

    await prisma.subscription.updateMany({
      where: { gatewaySubscriptionId: stripeSubId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      },
    });
    break;
  }

  // Pagamento da renovação falhou (cartão vencido, sem saldo, etc.)
  case "invoice.payment_failed": {
    const invoice = event.data.object as Stripe.Invoice;
    await prisma.subscription.updateMany({
      where: { gatewaySubscriptionId: invoice.subscription as string },
      data: { status: "PAST_DUE" },
    });
    // Disparar aqui: email avisando o aluno para atualizar o cartão
    break;
  }

  case "customer.subscription.deleted": {
    const sub = event.data.object as Stripe.Subscription;
    await prisma.subscription.updateMany({
      where: { gatewaySubscriptionId: sub.id },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
    break;
  }
}
```

### 1.4 Mercado Pago Preapproval (assinatura)

```typescript
// app/api/checkout/mercadopago/subscription/route.ts
import { MercadoPagoConfig, PreApproval } from "mercadopago";

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
const preapprovalClient = new PreApproval(client);

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  const { planId } = await req.json();
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  const preapproval = await preapprovalClient.create({
    body: {
      reason: plan.name,
      payer_email: user.email,
      external_reference: `${user.id}:${plan.id}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.priceCents / 100,
        currency_id: "BRL",
      },
      back_url: `${process.env.APP_URL}/checkout/sucesso`,
      status: "pending",
    },
  });

  return Response.json({ url: preapproval.init_point });
}
```

> O Mercado Pago **não distingue muito bem** pagamento único de renovação no webhook — ambos chegam como `type: payment`. Você precisa checar `external_reference` (que você define) para saber se aquele pagamento pertence a uma assinatura, e então estender `currentPeriodEnd` em +1 mês a cada aprovação recebida vinculada àquele `preapproval_id`.

### 1.5 Ponto de atenção geral com assinaturas

- Nunca marque uma assinatura como `EXPIRED` imediatamente após uma falha de pagamento — dê um prazo de tolerância (`PAST_DUE`, ex: 3-5 dias) antes de cortar o acesso, é o padrão do mercado (dunning)
- Trate cancelamento como "acesso continua até `currentPeriodEnd`", não como corte imediato — é o que o usuário já pagou

---

## PARTE 2 — Player de Vídeo com URL Assinada (Mux/Bunny)

### 2.1 Por que não usar um link direto de vídeo

Se você salvar a URL do `.mp4` direto no banco e mostrar no player, qualquer aluno pode copiar essa URL e compartilhar — o vídeo fica acessível pra sempre, sem controle. A solução é: guardar só o **ID do vídeo** no banco, e gerar uma **URL assinada com expiração curta** (ex: 4 horas) toda vez que o aluno abre a aula.

### 2.2 Fluxo com Mux (recomendado — mais simples de integrar)

**Upload (lado do instrutor):**
```typescript
// app/api/admin/lessons/[id]/upload/route.ts
import Mux from "@mux/mux-node";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Cria um upload direto — o instrutor manda o arquivo direto pro Mux,
  // sem passar pelo seu servidor (evita sobrecarregar sua API com arquivos grandes)
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.APP_URL!,
    new_asset_settings: {
      playback_policy: ["signed"], // <- chave: torna o vídeo privado por padrão
    },
  });

  await prisma.lesson.update({
    where: { id: params.id },
    data: { videoAssetId: upload.id }, // guardamos o upload_id temporariamente
  });

  return Response.json({ uploadUrl: upload.url });
}
```

**Webhook do Mux** (avisa quando o processamento termina):
```typescript
// app/api/webhooks/mux/route.ts
export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === "video.asset.ready") {
    const playbackId = event.data.playback_ids[0].id;
    const uploadId = event.data.upload_id;

    await prisma.lesson.updateMany({
      where: { videoAssetId: uploadId },
      data: { videoAssetId: playbackId }, // agora sim, o playback_id definitivo
    });
  }

  return new Response("ok", { status: 200 });
}
```

**Gerar URL assinada quando o aluno abre a aula:**
```typescript
// lib/mux-signed-url.ts
import jwt from "jsonwebtoken";

export function getSignedPlaybackUrl(playbackId: string) {
  const token = jwt.sign(
    {
      sub: playbackId,
      aud: "v", // "v" = vídeo (existe também "t" para thumbnail)
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4, // expira em 4h
    },
    Buffer.from(process.env.MUX_SIGNING_KEY_PRIVATE!, "base64").toString("utf-8"),
    { algorithm: "RS256", keyid: process.env.MUX_SIGNING_KEY_ID! }
  );

  return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
}
```

```typescript
// app/api/lessons/[id]/playback-url/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: params.id },
    include: { module: { include: { course: true } } },
  });

  // Verificação de acesso ANTES de gerar a URL — essa é a proteção real
  const access = await hasAccessToCourse(user.id, lesson.module.course.id);
  if (!access && !lesson.isFreePreview) {
    return new Response("Sem acesso a esta aula", { status: 403 });
  }

  const url = getSignedPlaybackUrl(lesson.videoAssetId!);
  return Response.json({ url });
}
```

### 2.3 Componente de player (frontend)

```tsx
// components/VideoPlayer.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function VideoPlayer({ lessonId }: { lessonId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/playback-url`)
      .then((res) => res.json())
      .then((data) => setPlaybackUrl(data.url));
  }, [lessonId]);

  useEffect(() => {
    if (!playbackUrl || !videoRef.current) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoRef.current);
      return () => hls.destroy();
    } else {
      videoRef.current.src = playbackUrl; // fallback Safari (HLS nativo)
    }
  }, [playbackUrl]);

  // Envia progresso a cada 15s — usado para LessonProgress
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        fetch(`/api/lessons/${lessonId}/progress`, {
          method: "POST",
          body: JSON.stringify({ watchedSeconds: Math.floor(videoRef.current.currentTime) }),
        });
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [lessonId]);

  return (
    <video
      ref={videoRef}
      controls
      controlsList="nodownload" // remove o botão de download nativo do Chrome
      onContextMenu={(e) => e.preventDefault()} // dificulta "salvar vídeo como"
      className="w-full aspect-video rounded-lg"
    />
  );
}
```

### 2.4 Alternativa com Bunny Stream

Mesmo princípio, API mais simples de token:

```typescript
import crypto from "crypto";

function getBunnySignedUrl(videoId: string, libraryId: string) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 4;
  const securityKey = process.env.BUNNY_TOKEN_SECURITY_KEY!;
  const path = `/${libraryId}/${videoId}`;
  const hash = crypto
    .createHash("sha256")
    .update(securityKey + path + expires)
    .digest("hex");

  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${hash}&expires=${expires}`;
}
```

### 2.5 O que essa proteção NÃO resolve (seja realista)

- Nada impede 100% que alguém grave a tela durante a reprodução — nenhuma plataforma do mercado resolve isso totalmente
- URL assinada + verificação de acesso no backend cobre o cenário real: impedir que o link seja compartilhado livremente e continue funcionando depois
- Para conteúdo de altíssimo valor, algumas plataformas adicionam uma **marca d'água dinâmica** com o email do aluno sobreposta ao vídeo (desmotiva compartilhamento por identificar a origem do vazamento) — Mux e Bunny têm suporte a isso, mas é uma camada extra de configuração

---

## PARTE 3 — Certificados com Verificação Pública

### 3.1 Schema (já existente, revisitando)

```prisma
model Certificate {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  user              User     @relation(fields: [userId], references: [id])
  courseId          String   @map("course_id")
  course            Course   @relation(fields: [courseId], references: [id])
  certificateUrl    String   @map("certificate_url")
  verificationHash  String   @unique @map("verification_hash")
  issuedAt          DateTime @default(now()) @map("issued_at")

  @@unique([userId, courseId])
  @@map("certificates")
}
```

### 3.2 Trigger de emissão

Quando `LessonProgress` marca a última aula do curso como concluída, dispara a emissão:

```typescript
// lib/certificates.ts
import crypto from "crypto";

export async function issueCertificateIfEligible(userId: string, courseId: string) {
  const totalLessons = await prisma.lesson.count({
    where: { module: { courseId } },
  });
  const completedLessons = await prisma.lessonProgress.count({
    where: { userId, completed: true, lesson: { module: { courseId } } },
  });

  if (completedLessons < totalLessons) return null;

  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  // Hash público e não-adivinhável — usado na URL de verificação
  const verificationHash = crypto.randomBytes(16).toString("hex");

  const pdfBuffer = await generateCertificatePdf({ userId, courseId, verificationHash });
  const certificateUrl = await uploadToStorage(
    `certificates/${verificationHash}.pdf`,
    pdfBuffer
  );

  return prisma.certificate.create({
    data: { userId, courseId, certificateUrl, verificationHash },
  });
}
```

### 3.3 Geração do PDF (com Puppeteer + HTML/CSS — mais fácil de estilizar que libs de PDF puro)

```typescript
// lib/generate-certificate-pdf.ts
import puppeteer from "puppeteer";

export async function generateCertificatePdf({
  userId,
  courseId,
  verificationHash,
}: {
  userId: string;
  courseId: string;
  verificationHash: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });

  const html = `
    <html>
      <body style="font-family: Georgia, serif; text-align: center; padding: 100px;">
        <h1 style="font-size: 20px; letter-spacing: 4px; color: #888;">CERTIFICADO DE CONCLUSÃO</h1>
        <p style="font-size: 18px; margin-top: 60px;">Certificamos que</p>
        <h2 style="font-size: 36px; margin: 20px 0;">${user.name}</h2>
        <p style="font-size: 18px;">concluiu com êxito o curso</p>
        <h3 style="font-size: 28px; margin: 20px 0;">${course.title}</h3>
        <p style="margin-top: 80px; font-size: 12px; color: #999;">
          Verifique a autenticidade em: ${process.env.APP_URL}/certificados/verificar/${verificationHash}
        </p>
      </body>
    </html>
  `;

  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html);
  const pdfBuffer = await page.pdf({ format: "A4", landscape: true, printBackground: true });
  await browser.close();

  return pdfBuffer;
}
```

> Em produção serverless (Vercel), o Puppeteer completo é pesado — use `@sparticuz/chromium` + `puppeteer-core`, que é a combinação leve recomendada para rodar em ambientes serverless.

### 3.4 Página pública de verificação (o que dá credibilidade ao certificado)

```tsx
// app/certificados/verificar/[hash]/page.tsx
import { prisma } from "@/lib/prisma";

export default async function VerifyCertificatePage({ params }: { params: { hash: string } }) {
  const certificate = await prisma.certificate.findUnique({
    where: { verificationHash: params.hash },
    include: { user: true, course: true },
  });

  if (!certificate) {
    return <p>Certificado não encontrado. Verifique o código informado.</p>;
  }

  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <h1 className="text-2xl font-bold text-green-600">✓ Certificado Válido</h1>
      <p className="mt-4">
        <strong>{certificate.user.name}</strong> concluiu o curso{" "}
        <strong>{certificate.course.title}</strong>
      </p>
      <p className="text-sm text-gray-500 mt-2">
        Emitido em {certificate.issuedAt.toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}
```

Isso é o que torna o certificado confiável para quem recebe (ex: um recrutador): qualquer pessoa pode acessar `seusite.com/certificados/verificar/{hash}` e confirmar que aquele certificado é genuíno, sem depender de "confiar" no PDF isoladamente.

### 3.5 Checklist desta parte

- [ ] `verificationHash` gerado com `crypto.randomBytes`, nunca sequencial (evita alguém "adivinhar" hashes de outros alunos)
- [ ] Emissão do certificado roda em fila assíncrona (BullMQ), não bloqueia a requisição que marca a última aula como concluída
- [ ] PDF armazenado em bucket privado, mas a **página de verificação é pública** — são coisas diferentes: o PDF em si pode ter link direto (é só um comprovante), a validação de autenticidade é o que fica público e consultável
