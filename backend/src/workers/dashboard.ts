import { Router } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue, certificateQueue, videoQueue } from "../lib/queues-bullmq.js";

// Painel de monitoramento das filas (spec fila-assincrona §7). Fila sem visibilidade
// só é descoberta quando o aluno reclama. NUNCA expor sem autenticação: mostra
// dados sensíveis de jobs (emails, IDs). Requer Redis acessível.
export function queuesDashboardRouter() {
  const router = Router();

  router.use((req, res, next) => {
    const user = process.env.QUEUES_DASHBOARD_USER;
    const pass = process.env.QUEUES_DASHBOARD_PASS;
    if (!user || !pass) {
      return res.status(503).send("Painel de filas desabilitado (configure QUEUES_DASHBOARD_USER/PASS)");
    }
    const header = req.headers.authorization;
    if (!header?.startsWith("Basic ")) {
      res.set("WWW-Authenticate", 'Basic realm="filas"');
      return res.status(401).send("Autenticação necessária");
    }
    const [u, p] = Buffer.from(header.slice(6), "base64").toString().split(":");
    if (u !== user || p !== pass) {
      res.set("WWW-Authenticate", 'Basic realm="filas"');
      return res.status(401).send("Credenciais inválidas");
    }
    next();
  });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(certificateQueue), new BullMQAdapter(videoQueue)],
    serverAdapter,
  });
  router.use(serverAdapter.getRouter());

  return router;
}
