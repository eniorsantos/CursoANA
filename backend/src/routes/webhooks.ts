import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { completePurchase } from "./checkout.js";
import { queueMuxEvent } from "../lib/queue.js";

const router = Router();

// POST /api/webhooks/stripe — valida assinatura, idempotente via gatewayChargeId
router.post("/stripe", async (req, res) => {
  const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const signature = req.headers["stripe-signature"] as string;

  // Sem chave configurada: aceita evento mockado (apenas dev/teste)
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    const event = req.body;
    if (event?.type === "checkout.session.completed") {
      const s = event.data.object;
      await completePurchase(s.metadata.userId, s.metadata.courseId, s.amount_total, "CARD", "STRIPE", s.id);
    }
    return res.status(200).send("ok (mock)");
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as never });
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET) as unknown as typeof event;
  } catch (err) {
    return res.status(400).send(`Webhook inválido: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as { id: string; mode?: string; amount_total: number; metadata: { userId: string; courseId?: string; planId?: string }; subscription?: string };
      if (session.mode === "subscription") {
        const stripeSubId = session.subscription as string;
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        await prisma.subscription.create({
          data: {
            userId: session.metadata.userId,
            planId: session.metadata.planId!,
            gateway: "STRIPE",
            gatewaySubscriptionId: stripeSubId,
            status: "ACTIVE",
            currentPeriodEnd: new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000),
          },
        });
      } else {
        await completePurchase(session.metadata.userId, session.metadata.courseId!, session.amount_total, "CARD", "STRIPE", session.id);
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as unknown as { subscription: string };
      const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string);
      await prisma.subscription.updateMany({
        where: { gatewaySubscriptionId: invoice.subscription as string },
        data: { status: "ACTIVE", currentPeriodEnd: new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000) },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as { subscription: string };
      await prisma.subscription.updateMany({
        where: { gatewaySubscriptionId: invoice.subscription as string },
        data: { status: "PAST_DUE" },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as { id: string };
      await prisma.subscription.updateMany({
        where: { gatewaySubscriptionId: sub.id },
        data: { status: "CANCELED", canceledAt: new Date() },
      });
      break;
    }
  }
  res.status(200).send("ok");
});

// POST /api/webhooks/mercadopago — busca pagamento real na API, nunca confia só no payload
router.post("/mercadopago", async (req, res) => {
  const body = req.body;
  if (body?.type !== "payment") return res.status(200).send("ignorado");
  if (!process.env.MP_ACCESS_TOKEN) {
    // mock dev
    const { userId, courseId } = body.metadata ?? {};
    if (userId && courseId) await completePurchase(userId, courseId, 3000, "PIX", "MERCADO_PAGO", String(body.data.id));
    return res.status(200).send("ok (mock)");
  }
  const { MercadoPagoConfig, Payment } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const paymentClient = new Payment(client);
  const payment = await paymentClient.get({ id: body.data.id });
  if ((payment as unknown as { status: string }).status !== "approved") {
    return res.status(200).send("aguardando confirmação");
  }
  const p = payment as unknown as { id: number; transaction_amount: number; payment_type_id: string; metadata: { userId: string; courseId: string } };
  const method = p.payment_type_id === "pix" ? "PIX" : p.payment_type_id === "ticket" ? "BOLETO" : "CARD";
  await completePurchase(p.metadata.userId, p.metadata.courseId, Math.round(p.transaction_amount * 100), method as "PIX", "MERCADO_PAGO", String(p.id));
  res.status(200).send("ok");
});

// POST /api/webhooks/mux — responde rápido e enfileira processamento
router.post("/mux", async (req, res) => {
  await queueMuxEvent(req.body);
  // fallback síncrono quando sem Redis
  if (!process.env.REDIS_URL && req.body?.type === "video.asset.ready") {
    const playbackId = req.body.data.playback_ids?.[0]?.id;
    if (playbackId) {
      await prisma.lesson.updateMany({ where: { videoAssetId: req.body.data.upload_id }, data: { videoAssetId: playbackId } });
    }
  }
  res.status(200).send("ok");
});

export default router;
