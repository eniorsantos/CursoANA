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
      <h1 className="text-xl font-bold mb-4">Alunos</h1>
      {!enrollments || enrollments.length === 0 ? (
        <EmptyState
          title="Nenhuma matrícula ainda"
          description="As matrículas aparecem aqui assim que o webhook do gateway confirmar um pagamento."
        />
      ) : (
        <table className="w-full text-sm bg-white border border-[#E5E3E0] rounded-lg overflow-hidden">
          <thead className="bg-[#F2F1EF]">
            <tr>{["Aluno", "Email", "Curso", "Status", "Data"].map((h) => (<th key={h} className="text-left px-4 py-3 text-[#6B6862]">{h}</th>))}</tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id} className="border-t border-[#E5E3E0]">
                <td className="px-4 py-3 font-medium">{e.user.name}</td>
                <td className="px-4 py-3 text-[#6B6862]">{e.user.email}</td>
                <td className="px-4 py-3">{e.course.title}</td>
                <td className={`px-4 py-3 ${e.status === "ACTIVE" ? "text-green-700" : "text-[#6B6862]"}`}>{e.status}</td>
                <td className="px-4 py-3">{new Date(e.enrolledAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
