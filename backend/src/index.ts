import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import lessonRoutes from "./routes/lessons.js";
import checkoutRoutes from "./routes/checkout.js";
import webhookRoutes from "./routes/webhooks.js";
import certificateRoutes from "./routes/certificates.js";
import planRoutes from "./routes/plans.js";
import adminRoutes from "./routes/admin.js";
import mobileRoutes from "./routes/mobile.js";
import usersRoutes from "./routes/users.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

// Stripe webhook precisa do corpo bruto para validar assinatura
app.use("/api/webhooks/stripe", express.raw({ type: "*/*" }), async (req, _res, next) => {
  (req as unknown as { rawBody: string }).rawBody = (req.body as Buffer).toString("utf8");
  try {
    req.body = JSON.parse((req as unknown as { rawBody: string }).rawBody || "{}");
  } catch {
    req.body = {};
  }
  next();
});

app.use(cors());
app.use(express.json());
// Arquivos públicos (ex: PDFs de certificado — o comprovante pode ter link direto;
// a autenticidade se valida em /api/certificates/verificar/:hash).
app.use("/files", express.static(path.resolve("storage")));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use(authMiddleware);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/mobile", mobileRoutes);
app.use("/api/users", usersRoutes);

// Bull Board — montado por último para não interferir nas rotas da API.
// Protegido por basic auth própria (nunca público); 503 se não configurado.
import("./workers/dashboard.js").then(({ queuesDashboardRouter }) => {
  app.use("/admin/queues", queuesDashboardRouter());
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`Backend rodando em http://localhost:${PORT}`));
}

export default app;
