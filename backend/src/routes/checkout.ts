import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { queueWelcomeEmail, queuePush } from "../lib/queue.js";

const router = Router();

async function completePurchase(userId: string, courseId: string, amountCents: number, method: "CARD" | "PIX" | "BOLETO", gateway: "STRIPE" | "MERCADO_PAGO", gatewayChargeId: string) {
  const existing = await prisma.payment.findUnique({ where: { gatewayChargeId } });
  if (existing) return existing;
  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: { userId, courseId, amountCents, method, gateway, gatewayChargeId, status: "PAID", paidAt: new Date() },
    }),
    prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    }),
  ]);
  await queueWelcomeEmail(userId, courseId);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  await queuePush(userId, "Acesso liberado! 🎓", `Seu acesso ao curso ${course?.title ?? ""} já está disponível.`, { courseId });
  return payment;
}

// POST /api/checkout/stripe — cria sessão (mock quando sem chave)
router.post("/stripe", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string; email: string } }).user;
  const { courseId } = req.body ?? {};
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({ url: `${process.env.APP_URL}/checkout/sucesso?mock=stripe&courseId=${course.id}`, mocked: true });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as never });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [{ price_data: { currency: "usd", unit_amount: course.priceCents, product_data: { name: course.title } }, quantity: 1 }],
    metadata: { userId: user.id, courseId: course.id },
    success_url: `${process.env.APP_URL}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/curso/${course.slug}`,
  });
  res.json({ url: session.url });
});

// POST /api/checkout/stripe/subscription
router.post("/stripe/subscription", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string; email: string } }).user;
  const { planId } = req.body ?? {};
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!process.env.STRIPE_SECRET_KEY || !plan.stripePriceId) {
    return res.json({ url: `${process.env.APP_URL}/checkout/sucesso?mock=subscription&planId=${plan.id}`, mocked: true });
  }
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as never });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    metadata: { userId: user.id, planId: plan.id },
    success_url: `${process.env.APP_URL}/checkout/sucesso`,
    cancel_url: `${process.env.APP_URL}/planos`,
  });
  res.json({ url: session.url });
});

// POST /api/checkout/mercadopago
router.post("/mercadopago", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string; email: string } }).user;
  const { courseId } = req.body ?? {};
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (!process.env.MP_ACCESS_TOKEN) {
    return res.json({ url: `${process.env.APP_URL}/checkout/sucesso?mock=mp&courseId=${course.id}`, mocked: true });
  }
  const { MercadoPagoConfig, Preference } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preferenceClient = new Preference(client);
  const preference = await preferenceClient.create({
    body: {
      items: [{ id: course.id, title: course.title, quantity: 1, unit_price: course.priceCents / 100, currency_id: "BRL" }],
      payer: { email: user.email },
      metadata: { userId: user.id, courseId: course.id },
      back_urls: { success: `${process.env.APP_URL}/checkout/sucesso`, failure: `${process.env.APP_URL}/curso/${course.slug}` },
      notification_url: `${process.env.APP_URL}/api/webhooks/mercadopago`,
    },
  });
  res.json({ url: preference.init_point });
});

// POST /api/checkout/mercadopago/subscription (Preapproval)
router.post("/mercadopago/subscription", requireAuth, async (req, res) => {
  const user = (req as unknown as { user: { id: string; email: string } }).user;
  const { planId } = req.body ?? {};
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (!process.env.MP_ACCESS_TOKEN) {
    return res.json({ url: `${process.env.APP_URL}/checkout/sucesso?mock=mp-sub&planId=${plan.id}`, mocked: true });
  }
  const { MercadoPagoConfig, PreApproval } = await import("mercadopago");
  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preapprovalClient = new PreApproval(client);
  const preapproval = await preapprovalClient.create({
    body: {
      reason: plan.name,
      payer_email: user.email,
      external_reference: `${user.id}:${plan.id}`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: plan.priceCents / 100, currency_id: "BRL" },
      back_url: `${process.env.APP_URL}/checkout/sucesso`,
      status: "pending",
    },
  });
  res.json({ url: preapproval.init_point });
});

export { completePurchase };
export default router;
