import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "CursosAna — Aprenda no estilo streaming", description: "Plataforma de cursos com vitrine estilo Netflix" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
