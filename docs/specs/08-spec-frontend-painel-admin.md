# Especificação de Frontend — Painel Administrativo

## 1. Direção de Design

O painel admin tem um público e um objetivo diferentes do app de alunos: aqui é sobre eficiência operacional (cadastrar cursos rápido, revisar métricas, gerenciar alunos), não sobre imersão visual. A estética é de **dashboard de produtividade** — clara, densa em informação quando necessário, mas com hierarquia visual bem definida.

### 1.1 Paleta

```typescript
// packages/ui/tokens/admin-colors.ts
export const adminColors = {
  bg: "#FAFAF9",            // fundo levemente quente, não branco puro
  surface: "#FFFFFF",
  surfaceMuted: "#F2F1EF",
  border: "#E5E3E0",
  textPrimary: "#18181B",
  textSecondary: "#6B6862",
  accent: "#6D4FC7",         // roxo — ecoa a paleta lilás do app de alunos, dando identidade de marca consistente
  accentMuted: "#EDE9FB",
  success: "#1A9C6E",
  warning: "#B7791F",
  danger: "#C0362C",
  // Modo escuro (opcional, ativado por preferência do usuário)
  dark: {
    bg: "#17161C",
    surface: "#201F27",
    surfaceMuted: "#2A2933",
    border: "#35333F",
    textPrimary: "#F5F4F7",
    textSecondary: "#A9A6B3",
  },
};
```

### 1.2 Tipografia

```typescript
export const adminTypography = {
  fontFamily: "Inter",
  pageTitle: { size: 22, weight: "700" },
  sectionTitle: { size: 16, weight: "600" },
  body: { size: 14, weight: "400" },
  label: { size: 12, weight: "500", color: adminColors.textSecondary },
  tableCell: { size: 13, weight: "400" },
};
```

### 1.3 Princípios

- **Densidade controlada**: tabelas e listas priorizam mostrar mais dados por tela (diferente do app de alunos, que prioriza respiro visual), mas sempre com espaçamento vertical consistente entre linhas
- **Ações destrutivas sempre confirmadas**: nenhuma exclusão acontece num único clique — modal de confirmação com o nome do item a ser excluído digitado explicitamente pra ações irreversíveis de alto impacto (ex: excluir curso publicado)
- **Estado vazio é orientação, não decoração**: toda lista vazia ("Nenhum curso ainda") vem com uma ação direta ("Criar primeiro curso"), não só uma ilustração

---

## 2. Stack de Frontend

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | Next.js (App Router) — mesmo app do backend admin já especificado | Server Actions já são o mecanismo de mutação definido |
| Componentes base | shadcn/ui | Componentes acessíveis, customizáveis, sem dependência de runtime pesada |
| Tabelas | TanStack Table | Ordenação, filtro e paginação client-side sem reinventar |
| Formulários | react-hook-form + zod | Mesmo schema de validação Zod já usado nas Server Actions, reaproveitado no client para feedback instantâneo |
| Drag-and-drop | dnd-kit | Já definido no backend para reordenação de módulos/aulas |
| Gráficos | Recharts | Leve, suficiente para os dashboards de métricas |
| Data fetching client-side | TanStack Query | Cache e revalidação para dados que não vêm só de Server Components |
| Editor de texto rico | Tiptap | Para descrição de curso com formatação básica (negrito, listas, links) |
| Notificações (toast) | sonner | Feedback de sucesso/erro nas Server Actions |

---

## 3. Estrutura de Navegação

```
┌─────────────────────────────────────────────┐
│ Topbar: busca global · notificações · avatar │
├───────────┬───────────────────────────────────┤
│           │                                   │
│  Sidebar  │            Conteúdo               │
│           │                                   │
│ Dashboard │                                   │
│ Cursos    │                                   │
│ Alunos    │                                   │
│ Financeiro│                                   │
│ Planos    │                                   │
│ Config.   │                                   │
└───────────┴───────────────────────────────────┘
```

```tsx
// app/(admin)/layout.tsx
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "INSTRUCTOR"].includes(user.role)) redirect("/login");

  return (
    <div className="flex h-screen bg-[--bg]">
      <AdminSidebar role={user.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopbar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
```

```tsx
// components/admin/AdminSidebar.tsx
const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["ADMIN", "INSTRUCTOR"] },
  { label: "Cursos", href: "/admin/cursos", icon: BookOpen, roles: ["ADMIN", "INSTRUCTOR"] },
  { label: "Alunos", href: "/admin/alunos", icon: Users, roles: ["ADMIN"] },
  { label: "Financeiro", href: "/admin/financeiro", icon: DollarSign, roles: ["ADMIN"] },
  { label: "Planos", href: "/admin/planos", icon: Package, roles: ["ADMIN"] },
  { label: "Configurações", href: "/admin/config", icon: Settings, roles: ["ADMIN"] },
];

export function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-60 border-r border-[--border] bg-[--surface] flex flex-col">
      <div className="p-4 font-bold text-lg">Painel</div>
      <nav className="flex-1 px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm mb-1",
              pathname === item.href ? "bg-[--accent-muted] text-[--accent] font-medium" : "text-[--text-secondary]"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

> A sidebar já filtra itens por `role` — instrutor não vê "Financeiro" nem "Alunos" (que mostra dados de todos os cursos, não só os dele), reforçando no frontend a mesma regra de autorização que já existe no backend (`requireRole`).

---

## 4. Tela — Dashboard

```
┌───────────────────────────────────────────────────┐
│ [Receita no mês] [Novos alunos] [Cursos publicados] │
├───────────────────────────────────────────────────┤
│ Gráfico de receita (últimos 30 dias)                │
├───────────────────────────────────────────────────┤
│ Cursos com melhor desempenho (tabela)               │
└───────────────────────────────────────────────────┘
```

```tsx
// app/(admin)/admin/page.tsx
export default async function DashboardPage() {
  const stats = await getDashboardStats(); // agrega Payment, Enrollment, Course

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Receita no mês" value={formatCurrency(stats.monthlyRevenueCents)} trend={stats.revenueTrend} />
        <StatCard label="Novos alunos" value={stats.newStudents} trend={stats.studentsTrend} />
        <StatCard label="Cursos publicados" value={stats.publishedCourses} />
      </div>
      <RevenueChart data={stats.revenueByDay} />
      <TopCoursesTable courses={stats.topCourses} />
    </div>
  );
}
```

```tsx
// components/admin/StatCard.tsx
export function StatCard({ label, value, trend }: { label: string; value: string; trend?: number }) {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg p-4">
      <div className="text-xs text-[--text-secondary] mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {trend !== undefined && (
        <div className={cn("text-xs mt-1 flex items-center gap-1", trend >= 0 ? "text-[--success]" : "text-[--danger]")}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(trend)}% vs. mês anterior
        </div>
      )}
    </div>
  );
}
```

```tsx
// components/admin/RevenueChart.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function RevenueChart({ data }: { data: { date: string; revenueCents: number }[] }) {
  return (
    <div className="bg-[--surface] border border-[--border] rounded-lg p-4">
      <div className="text-sm font-semibold mb-4">Receita — últimos 30 dias</div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `R$${v / 100}`} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Line type="monotone" dataKey="revenueCents" stroke="#6D4FC7" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 5. Tela — Lista de Cursos

```tsx
// app/(admin)/admin/cursos/page.tsx
export default async function CoursesPage() {
  const courses = await getCoursesForAdmin(); // já filtra por instrutor, se aplicável

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Cursos</h1>
        <Link href="/admin/cursos/novo">
          <Button><Plus size={16} className="mr-1" /> Novo curso</Button>
        </Link>
      </div>
      <CoursesTable courses={courses} />
    </div>
  );
}
```

```tsx
// components/admin/CoursesTable.tsx
"use client";
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from "@tanstack/react-table";
import { publishCourse, deleteCourse } from "@/app/(admin)/admin/cursos/actions";
import { toast } from "sonner";

const columns = [
  {
    accessorKey: "title",
    header: "Curso",
    cell: ({ row }: any) => (
      <div className="flex items-center gap-3">
        <img src={row.original.thumbnailUrl ?? "/placeholder-course.png"} className="w-10 h-7 rounded object-cover" />
        <span className="font-medium">{row.original.title}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
  },
  { accessorKey: "priceCents", header: "Preço", cell: ({ row }: any) => formatCurrency(row.original.priceCents) },
  { accessorKey: "enrollmentCount", header: "Alunos" },
  {
    id: "actions",
    cell: ({ row }: any) => <CourseRowActions course={row.original} />,
  },
];

export function CoursesTable({ courses }: { courses: any[] }) {
  const table = useReactTable({ data: courses, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <table className="w-full text-sm border border-[--border] rounded-lg overflow-hidden">
      <thead className="bg-[--surface-muted]">
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((header) => (
              <th key={header.id} className="text-left px-4 py-3 font-medium text-[--text-secondary]">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className="border-t border-[--border] hover:bg-[--surface-muted]">
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CourseRowActions({ course }: { course: any }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger><MoreVertical size={16} /></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild><Link href={`/admin/cursos/${course.id}`}>Editar</Link></DropdownMenuItem>
        {course.status === "DRAFT" && (
          <DropdownMenuItem onClick={async () => {
            const result = await publishCourse(course.id); // Server Action já definida no backend
            if (result.error) toast.error(result.error);
            else toast.success("Curso publicado!");
          }}>
            Publicar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-[--danger]" onClick={() => confirmDelete(course)}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 5.1 Modal de confirmação para exclusão

```tsx
// components/admin/ConfirmDeleteDialog.tsx
"use client";
import { useState } from "react";

export function ConfirmDeleteDialog({ itemName, onConfirm, open, onOpenChange }: {
  itemName: string;
  onConfirm: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Excluir "{itemName}"?</DialogTitle>
        <p className="text-sm text-[--text-secondary] mb-3">
          Essa ação não pode ser desfeita. Alunos matriculados perderão acesso ao conteúdo. Digite o nome do curso para confirmar.
        </p>
        <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={itemName} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={typed !== itemName || loading}
            onClick={async () => {
              setLoading(true);
              await onConfirm();
              setLoading(false);
              onOpenChange(false);
            }}
          >
            {loading ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 6. Tela — Editor de Curso (Módulos, Aulas e Upload)

Essa é a tela mais complexa do painel — reúne dados do curso, árvore de módulos/aulas reordenável (já especificada no backend com `dnd-kit`) e upload de vídeo.

```
┌──────────────────────────────────────────────────┐
│ [Tabs: Informações | Currículo | Preço | Configur.] │
├──────────────────────────────────────────────────┤
│  Aba "Currículo":                                  │
│  ▾ Módulo 1 — Fundamentos            [+ aula] [⋮]  │
│      ≡ Aula 1 — Introdução           [vídeo ✓]     │
│      ≡ Aula 2 — Setup                [vídeo ⏳]     │
│  ▾ Módulo 2 — Avançado                             │
│  [+ Adicionar módulo]                              │
└──────────────────────────────────────────────────┘
```

```tsx
// app/(admin)/admin/cursos/[id]/page.tsx
export default async function CourseEditorPage({ params }: { params: { id: string } }) {
  const course = await getCourseWithModules(params.id);

  return (
    <div>
      <CourseEditorHeader course={course} />
      <Tabs defaultValue="curriculo">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="curriculo">Currículo</TabsTrigger>
          <TabsTrigger value="preco">Preço</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="info"><CourseInfoForm course={course} /></TabsContent>
        <TabsContent value="curriculo"><CurriculumBuilder courseId={course.id} modules={course.modules} /></TabsContent>
        <TabsContent value="preco"><CoursePricingForm course={course} /></TabsContent>
        <TabsContent value="config"><CourseSettingsForm course={course} /></TabsContent>
      </Tabs>
    </div>
  );
}
```

### 6.1 Formulário com validação compartilhada (mesmo schema do backend)

```typescript
// packages/shared-types/schemas/course.ts — compartilhado entre Server Action e formulário client
import { z } from "zod";

export const courseSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  description: z.string().min(10, "Descreva melhor o curso"),
  priceCents: z.coerce.number().int().min(0),
});
export type CourseFormData = z.infer<typeof courseSchema>;
```

```tsx
// components/admin/CourseInfoForm.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, CourseFormData } from "@shared/schemas/course";
import { updateCourse } from "@/app/(admin)/admin/cursos/actions";
import { toast } from "sonner";

export function CourseInfoForm({ course }: { course: any }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: course.title, description: course.description, priceCents: course.priceCents },
  });

  async function onSubmit(data: CourseFormData) {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.set(k, String(v)));
    const result = await updateCourse(course.id, formData);
    if (result.error) toast.error("Verifique os campos destacados");
    else toast.success("Curso atualizado");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-xl">
      <div>
        <Label>Título</Label>
        <Input {...register("title")} />
        {errors.title && <p className="text-xs text-[--danger] mt-1">{errors.title.message}</p>}
      </div>
      <div>
        <Label>Descrição</Label>
        <RichTextEditor
          content={course.description}
          onChange={(html) => setValue("description", html)}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar alterações"}</Button>
    </form>
  );
}
```

### 6.2 Árvore de Currículo com drag-and-drop (reaproveitando dnd-kit do backend)

```tsx
// components/admin/CurriculumBuilder.tsx
"use client";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { reorderModules, createModule } from "@/app/(admin)/admin/cursos/[id]/actions";

export function CurriculumBuilder({ courseId, modules }: { courseId: string; modules: any[] }) {
  function handleModuleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const reordered = arrayMove(modules, findIndex(modules, active.id), findIndex(modules, over.id));
      reorderModules(courseId, reordered.map((m) => m.id));
    }
  }

  return (
    <div className="space-y-3">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          {modules.map((module) => (
            <ModuleAccordion key={module.id} module={module} courseId={courseId} />
          ))}
        </SortableContext>
      </DndContext>
      <Button variant="outline" onClick={() => createModule(courseId, "Novo módulo")}>
        <Plus size={14} className="mr-1" /> Adicionar módulo
      </Button>
    </div>
  );
}

function ModuleAccordion({ module, courseId }: { module: any; courseId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="border border-[--border] rounded-lg">
      <div className="flex items-center gap-2 p-3 bg-[--surface-muted]">
        <span {...attributes} {...listeners} className="cursor-grab text-[--text-secondary]"><GripVertical size={16} /></span>
        <EditableTitle value={module.title} onSave={(title) => updateModuleTitle(module.id, title)} />
        <span className="ml-auto text-xs text-[--text-secondary]">{module.lessons.length} aulas</span>
      </div>
      <div className="p-2 space-y-1">
        {module.lessons.map((lesson: any) => (
          <LessonRow key={lesson.id} lesson={lesson} />
        ))}
        <button className="text-xs text-[--accent] p-2" onClick={() => createLesson(module.id)}>
          + Adicionar aula
        </button>
      </div>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: any }) {
  return (
    <Link
      href={`/admin/cursos/${lesson.moduleId}/aulas/${lesson.id}`}
      className="flex items-center gap-2 p-2 rounded hover:bg-[--surface-muted] text-sm"
    >
      <GripVertical size={14} className="text-[--text-secondary]" />
      {lesson.type === "VIDEO" ? <Video size={14} /> : <FileText size={14} />}
      <span className="flex-1">{lesson.title}</span>
      <VideoStatusBadge lesson={lesson} />
    </Link>
  );
}

function VideoStatusBadge({ lesson }: { lesson: any }) {
  if (lesson.type !== "VIDEO") return null;
  if (!lesson.videoAssetId) return <Badge variant="outline">Sem vídeo</Badge>;
  if (lesson.videoStatus === "processing") return <Badge variant="warning">Processando</Badge>;
  return <Badge variant="success">Pronto</Badge>;
}
```

### 6.3 Tela de Upload de Aula (Vídeo)

Reaproveita o `VideoUploader` já especificado no backend, adicionando o entorno da página:

```tsx
// app/(admin)/admin/cursos/[id]/aulas/[lessonId]/page.tsx
export default async function LessonEditorPage({ params }: { params: { lessonId: string } }) {
  const lesson = await getLessonWithStatus(params.lessonId);

  return (
    <div className="max-w-2xl">
      <BackLink href={`../../${params.id}`} />
      <h1 className="text-lg font-bold mb-4">{lesson.title}</h1>

      <div className="space-y-6">
        <div>
          <Label>Título da aula</Label>
          <EditableTitle value={lesson.title} onSave={(title) => updateLessonTitle(lesson.id, title)} />
        </div>

        <div>
          <Label>Vídeo</Label>
          {lesson.videoAssetId ? (
            <VideoPreviewWithReplace lessonId={lesson.id} />
          ) : (
            <VideoUploader lessonId={lesson.id} />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={lesson.isFreePreview} onCheckedChange={(v) => toggleFreePreview(lesson.id, v)} />
          <Label>Disponibilizar como aula gratuita (preview)</Label>
        </div>
      </div>
    </div>
  );
}
```

---

## 7. Tela — Alunos e Matrículas

```tsx
// app/(admin)/admin/alunos/page.tsx
export default async function StudentsPage() {
  const enrollments = await getEnrollmentsForAdmin();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Alunos</h1>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nome ou email..." className="w-64" />
          <Select><option>Todos os cursos</option></Select>
        </div>
      </div>
      <StudentsTable enrollments={enrollments} />
    </div>
  );
}
```

Colunas: nome, email, curso, status (Ativo/Expirado), progresso (% de aulas concluídas), data de matrícula. Ação por linha: "Ver detalhes" (abre modal com histórico de pagamento + progresso detalhado por aula) e, para admin, "Revogar acesso" (edge case: reembolso manual).

---

## 8. Tela — Financeiro

```tsx
// app/(admin)/admin/financeiro/page.tsx
export default async function FinancePage() {
  const data = await getFinanceOverview(); // agrega Payment + Subscription

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Receita total" value={formatCurrency(data.totalRevenueCents)} />
        <StatCard label="Assinaturas ativas" value={data.activeSubscriptions} />
        <StatCard label="MRR" value={formatCurrency(data.mrrCents)} />
        <StatCard label="Taxa de churn" value={`${data.churnRate}%`} />
      </div>
      <PaymentsTable payments={data.recentPayments} />
    </div>
  );
}
```

A tabela de pagamentos mostra `gateway` (Stripe/Mercado Pago), `method` (Cartão/Pix/Boleto) e `status`, reaproveitando diretamente o schema `Payment` já modelado no backend — nenhuma transformação de dado extra necessária além de formatação de exibição.

---

## 9. Estados de Carregamento e Vazio

Padrão replicado em toda tela de listagem:

```tsx
// components/admin/DataStateWrapper.tsx
export function DataStateWrapper({ loading, empty, emptyState, children }: {
  loading: boolean;
  empty: boolean;
  emptyState: { title: string; description: string; action?: React.ReactNode };
  children: React.ReactNode;
}) {
  if (loading) return <TableSkeleton rows={6} />;

  if (empty) {
    return (
      <div className="text-center py-16 border border-dashed border-[--border] rounded-lg">
        <p className="font-medium">{emptyState.title}</p>
        <p className="text-sm text-[--text-secondary] mt-1">{emptyState.description}</p>
        {emptyState.action && <div className="mt-4">{emptyState.action}</div>}
      </div>
    );
  }

  return <>{children}</>;
}
```

```tsx
// Uso:
<DataStateWrapper
  loading={isLoading}
  empty={courses.length === 0}
  emptyState={{
    title: "Nenhum curso criado ainda",
    description: "Comece criando seu primeiro curso para a plataforma.",
    action: <Link href="/admin/cursos/novo"><Button>Criar primeiro curso</Button></Link>,
  }}
>
  <CoursesTable courses={courses} />
</DataStateWrapper>
```

---

## 10. Responsividade

O painel admin é **desktop-first** — diferente do app de alunos. A maior parte do trabalho de gestão (montar currículo, analisar métricas) acontece em telas maiores.

| Breakpoint | Comportamento |
|---|---|
| `< 768px` | Sidebar vira drawer (menu hambúrguer); tabelas mudam para lista de cards empilhados |
| `768px – 1200px` | Sidebar colapsa para ícones apenas; tabelas mantêm scroll horizontal |
| `> 1200px` | Layout completo, sidebar expandida |

```tsx
// components/admin/ResponsiveTable.tsx
// Em telas pequenas, cada linha de tabela vira um card com os dados empilhados,
// em vez de forçar scroll horizontal — melhora usabilidade em tablets
export function ResponsiveTable({ columns, data }: any) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  if (isMobile) return <CardListView columns={columns} data={data} />;
  return <DataTable columns={columns} data={data} />;
}
```

---

## 11. Notificações e Feedback

Toda Server Action já retorna `{ success }` ou `{ error }` (padrão definido no backend) — o frontend padroniza como isso vira feedback visual:

```typescript
// lib/action-feedback.ts
export async function handleAction<T>(
  action: () => Promise<{ success?: boolean; error?: string | Record<string, string[]> }>,
  successMessage: string
) {
  const result = await action();
  if (result.error) {
    const message = typeof result.error === "string" ? result.error : "Verifique os campos destacados";
    toast.error(message);
    return false;
  }
  toast.success(successMessage);
  return true;
}
```

```tsx
// Uso consistente em qualquer botão de ação:
<Button onClick={() => handleAction(() => publishCourse(course.id), "Curso publicado!")}>
  Publicar
</Button>
```

---

## 12. Checklist Final

- [ ] Sidebar filtra itens de menu por `role`, espelhando as mesmas regras de `requireRole` do backend
- [ ] Todo formulário usa o mesmo schema Zod da Server Action correspondente (`packages/shared-types`), evitando validações divergentes entre client e servidor
- [ ] Exclusões de alto impacto exigem digitação do nome do item, não só um clique de confirmação
- [ ] Estados vazios sempre incluem uma ação direta, nunca só uma mensagem
- [ ] Tabelas em telas pequenas viram cards empilhados, não scroll horizontal forçado
- [ ] Toda Server Action tem um padrão único de feedback (`handleAction`) — nunca tratamento de erro ad-hoc por tela
- [ ] Paleta do admin usa o mesmo roxo de acento do app de alunos, mantendo identidade de marca entre as duas superfícies
