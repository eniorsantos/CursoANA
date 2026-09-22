import { adminFetch } from "@/lib/admin-api";
import { EmptyState } from "@/components/admin/EmptyState";

type Enrollment = {
  id: string;
  status: string;
  enrolledAt: string;
  user: { name: string; email: string };
  course: { title: string };
};

export default async function AlunosPage() {
  const enrollments = await adminFetch<Enrollment[]>("/api/admin/enrollments");

  return (
    <div>
      <h1 className="font-bebas text-3xl tracking-wide mb-4">Alunos</h1>
      {!enrollments || enrollments.length === 0 ? (
        <EmptyState
          title="Nenhuma matrícula ainda"
          description="As matrículas aparecem aqui assim que o webhook do gateway confirmar um pagamento."
        />
      ) : (
        <table className="w-full text-sm bg-[#2A2340] border border-[#453A5C] rounded-lg overflow-hidden">
          <thead className="bg-[#352C4D]">
            <tr>{["Aluno", "Email", "Curso", "Status", "Data"].map((h) => (<th key={h} className="text-left px-4 py-3 text-[#B3A9C2]">{h}</th>))}</tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} className="border-t border-[#453A5C]">
                <td className="px-4 py-3 font-medium">{e.user.name}</td>
                <td className="px-4 py-3 text-[#B3A9C2]">{e.user.email}</td>
                <td className="px-4 py-3">{e.course.title}</td>
                <td className={`px-4 py-3 ${e.status === "ACTIVE" ? "text-green-400" : "text-[#B3A9C2]"}`}>{e.status}</td>
                <td className="px-4 py-3">{new Date(e.enrolledAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
