"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveSession } from "@/lib/auth-client";

// Retorno do OAuth do Google: o backend redireciona para cá com ?token=<JWT>.
function GoogleCallbackHandler() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();

  useEffect(() => {
    if (token) {
      saveSession(token);
      router.push("/meus-cursos");
    } else {
      router.push("/login?error=google");
    }
  }, [token, router]);

  return (
    <main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6">
      <p className="text-sm text-[#B3A9C2]">Concluindo login com Google…</p>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<main className="max-w-sm mx-auto min-h-screen flex flex-col justify-center p-6"><p className="text-sm">Carregando…</p></main>}>
      <GoogleCallbackHandler />
    </Suspense>
  );
}
