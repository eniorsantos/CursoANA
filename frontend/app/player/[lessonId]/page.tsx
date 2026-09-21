import { VideoPlayer } from "@/components/VideoPlayer";

export default function PlayerPage({ params }: { params: { lessonId: string } }) {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-black">
      <VideoPlayer lessonId={params.lessonId} />
      <div className="p-5">
        <h1 className="text-[15px] font-bold">Aula — {params.lessonId.slice(0, 8)}</h1>
        <p className="text-[11px] text-[#B3A9C2] mb-5">Node.js na Prática</p>
        <div className="bg-[#2A2340] rounded-md p-3 flex gap-2 items-center">
          <div className="w-[60px] h-10 rounded" style={{ background: "linear-gradient(160deg,#5B3E9E,#201735)" }} />
          <div className="text-[10px]">
            <div className="text-[#D9B8FF] font-bold mb-0.5">PRÓXIMA AULA</div>
            Aula 6 — Tratamento de Erros
            <div className="text-[#B3A9C2] mt-1">Iniciando em 8s · Cancelar</div>
          </div>
        </div>
      </div>
    </main>
  );
}
