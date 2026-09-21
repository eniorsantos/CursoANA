import { prisma } from "./prisma.js";

// Envio via Expo Push API (spec mobile §10). Usado pelo worker da fila `push`;
// nunca bloqueia a requisição (o webhook só enfileira).
export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, string>) {
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (tokens.length === 0) return { sent: 0 };

  const messages = tokens.map((t) => ({ to: t.token, sound: "default" as const, title, body, data: data ?? {} }));
  // Expo aceita até 100 mensagens por chamada em lote
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (res.ok) sent += Math.min(100, messages.length - i);
  }
  return { sent };
}
