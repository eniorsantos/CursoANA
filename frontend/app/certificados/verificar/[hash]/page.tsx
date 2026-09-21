import { API_URL } from "@/lib/api";

export default async function VerifyPage({ params }: { params: { hash: string } }) {
  let cert: { user: { name: string }; course: { title: string }; issuedAt: string; certificateUrl: string } | null = null;
  try {
    const res = await fetch(`${API_URL}/api/certificates/verificar/${params.hash}`, { cache: "no-store" });
    if (res.ok) cert = (await res.json()).certificate;
  } catch { cert = null; }
  if (!cert) return <main className="max-w-lg mx-auto py-20 text-center"><p>Certificado não encontrado. Verifique o código informado.</p></main>;
  return (
    <main className="max-w-lg mx-auto py-20 text-center">
      <h1 className="text-2xl font-bold text-green-500">✓ Certificado Válido</h1>
      <p className="mt-4"><strong>{cert.user.name}</strong> concluiu o curso <strong>{cert.course.title}</strong></p>
      <p className="text-sm text-gray-500 mt-2">Emitido em {new Date(cert.issuedAt).toLocaleDateString("pt-BR")}</p>
      <a href={cert.certificateUrl} target="_blank" rel="noreferrer" className="inline-block mt-6 bg-[#9B5DE5] text-white text-sm font-bold px-6 py-2.5 rounded">Baixar PDF</a>
    </main>
  );
}
