import { describe, it, expect } from "vitest";
import request from "supertest";
import Stripe from "stripe";
import app from "../src/index.js";
import { prisma } from "../src/lib/prisma.js";
import { createUser, createCourse } from "./helpers.js";

// Testes de integração do webhook Stripe (spec testes-e-cicd §1.4):
// Postgres real + assinatura HMAC real (generateTestHeaderString), sem mocks de banco.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" as never });
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function signedCheckoutEvent(opts: { sessionId: string; userId: string; courseId: string; amount: number }) {
  const payload = JSON.stringify({
    id: `evt_${opts.sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId,
        object: "checkout.session",
        mode: "payment",
        amount_total: opts.amount,
        metadata: { userId: opts.userId, courseId: opts.courseId },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

describe("webhook Stripe — checkout.session.completed", () => {
  it("cria pagamento PAID e matrícula ACTIVE quando o pagamento é confirmado", async () => {
    const { user } = await createUser({ name: "Aluno", email: "aluno@test.com" });
    const { user: instructor } = await createUser({ name: "Prof", email: "prof@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);

    const { payload, header } = signedCheckoutEvent({
      sessionId: "cs_test_ok",
      userId: user.id,
      courseId: course.id,
      amount: 5000,
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", header)
      .set("Content-Type", "application/json")
      .send(payload);

    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUnique({ where: { gatewayChargeId: "cs_test_ok" } });
    expect(payment?.status).toBe("PAID");
    expect(payment?.amountCents).toBe(5000);

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });
    expect(enrollment?.status).toBe("ACTIVE");
  });

  it("é idempotente — reenvio do mesmo evento não duplica pagamento nem matrícula", async () => {
    const { user } = await createUser({ name: "Aluno2", email: "aluno2@test.com" });
    const { user: instructor } = await createUser({ name: "Prof2", email: "prof2@test.com", role: "INSTRUCTOR" });
    const course = await createCourse(instructor.id);

    const { payload, header } = signedCheckoutEvent({
      sessionId: "cs_test_dup",
      userId: user.id,
      courseId: course.id,
      amount: 5000,
    });
    const send = () =>
      request(app)
        .post("/api/webhooks/stripe")
        .set("stripe-signature", header)
        .set("Content-Type", "application/json")
        .send(payload);

    await send(); // primeira entrega
    const res = await send(); // reenvio (a Stripe faz isso com frequência)
    expect(res.status).toBe(200);

    const payments = await prisma.payment.findMany({ where: { gatewayChargeId: "cs_test_dup" } });
    expect(payments).toHaveLength(1);
  });

  it("rejeita webhook com assinatura inválida sem tocar no banco", async () => {
    const { payload } = signedCheckoutEvent({
      sessionId: "cs_test_forged",
      userId: "user_qualquer",
      courseId: "course_qualquer",
      amount: 5000,
    });

    const res = await request(app)
      .post("/api/webhooks/stripe")
      .set("stripe-signature", "t=123,v1=assinatura-forjada")
      .set("Content-Type", "application/json")
      .send(payload);

    expect(res.status).toBe(400);

    const payment = await prisma.payment.findUnique({ where: { gatewayChargeId: "cs_test_forged" } });
    expect(payment).toBeNull();
  });
});
