# Painel Administrativo (CRUD + Upload) e Autenticação Completa

## PARTE 1 — Painel Administrativo

### 1.1 Estrutura de rotas do admin

```
app/
└── (admin)/
    ├── layout.tsx              # Verifica role ADMIN/INSTRUCTOR, sidebar
    ├── admin/
    │   ├── cursos/
    │   │   ├── page.tsx        # Lista de cursos
    │   │   ├── novo/page.tsx   # Criar curso
    │   │   └── [id]/
    │   │       ├── page.tsx    # Editar curso + gerenciar módulos/aulas
    │   │       └── aulas/[lessonId]/page.tsx  # Editar aula + upload de vídeo
    │   └── alunos/
    │       └── page.tsx        # Lista de matrículas/assinaturas
```

### 1.2 Proteção do layout do admin

```tsx
// app/(admin)/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user || !["ADMIN", "INSTRUCTOR"].includes(user.role)) {
    redirect("/login?callbackUrl=/admin/cursos");
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

### 1.3 Server Actions para o CRUD (mais simples que criar rotas de API separadas)

```typescript
// app/(admin)/admin/cursos/actions.ts
"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import slugify from "slugify";

const courseSchema = z.object({
  title: z.string().min(3, "Título muito curto"),
  description: z.string().min(10, "Descreva melhor o curso"),
  priceCents: z.coerce.number().int().min(0),
});

export async function createCourse(formData: FormData) {
  const user = await requireRole(["ADMIN", "INSTRUCTOR"]);

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const course = await prisma.course.create({
    data: {
      ...parsed.data,
      slug: slugify(parsed.data.title, { lower: true, strict: true }),
      instructorId: user.id,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/cursos");
  return { success: true, courseId: course.id };
}

export async function updateCourse(courseId: string, formData: FormData) {
  const user = await requireRole(["ADMIN", "INSTRUCTOR"]);
  await assertOwnsCourse(user, courseId); // instrutor só edita o próprio curso

  const parsed = courseSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priceCents: formData.get("priceCents"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  await prisma.course.update({ where: { id: courseId }, data: parsed.data });
  revalidatePath(`/admin/cursos/${courseId}`);
  return { success: true };
}

export async function publishCourse(courseId: string) {
  const user = await requireRole(["ADMIN", "INSTRUCTOR"]);
  await assertOwnsCourse(user, courseId);

  const moduleCount = await prisma.module.count({ where: { courseId } });
  if (moduleCount === 0) {
    return { error: "Adicione ao menos um módulo antes de publicar" };
  }

  await prisma.course.update({ where: { id: courseId }, data: { status: "PUBLISHED" } });
  revalidatePath(`/admin/cursos/${courseId}`);
  return { success: true };
}

export async function deleteCourse(courseId: string) {
  const user = await requireRole(["ADMIN"]); // só admin pode deletar, instrutor não
  await prisma.course.delete({ where: { id: courseId } });
  revalidatePath("/admin/cursos");
}

// Helper de autorização reutilizado em todas as actions
async function assertOwnsCourse(user: { id: string; role: string }, courseId: string) {
  if (user.role === "ADMIN") return; // admin vê tudo
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.instructorId !== user.id) {
    throw new Error("Você não tem permissão para editar este curso");
  }
}
```

### 1.4 CRUD de Módulos e Aulas (com reordenação)

```typescript
// app/(admin)/admin/cursos/[id]/actions.ts
"use server";

export async function createModule(courseId: string, title: string) {
  const user = await requireRole(["ADMIN", "INSTRUCTOR"]);
  await assertOwnsCourse(user, courseId);

  const lastModule = await prisma.module.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
  });

  await prisma.module.create({
    data: { courseId, title, order: (lastModule?.order ?? 0) + 1 },
  });
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function reorderModules(courseId: string, orderedIds: string[]) {
  const user = await requireRole(["ADMIN", "INSTRUCTOR"]);
  await assertOwnsCourse(user, courseId);

  // Transação garante que a reordenação (drag-and-drop) é atômica
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.module.update({ where: { id }, data: { order: index } })
    )
  );
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function createLesson(moduleId: string, title: string, type: "VIDEO" | "TEXT" | "QUIZ") {
  const lastLesson = await prisma.lesson.findFirst({
    where: { moduleId },
    orderBy: { order: "desc" },
  });

  const lesson = await prisma.lesson.create({
    data: { moduleId, title, type, order: (lastLesson?.order ?? 0) + 1 },
  });
  return lesson;
}
```

### 1.5 Componente de reordenação (drag-and-drop)

```tsx
// components/admin/ModuleList.tsx
"use client";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderModules } from "@/app/(admin)/admin/cursos/[id]/actions";

export function ModuleList({ courseId, modules }: { courseId: string; modules: { id: string; title: string }[] }) {
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);
      const reordered = arrayMove(modules, oldIndex, newIndex);
      reorderModules(courseId, reordered.map((m) => m.id)); // Server Action
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        {modules.map((module) => (
          <SortableModuleItem key={module.id} module={module} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableModuleItem({ module }: { module: { id: string; title: string } }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="p-3 border rounded-md mb-2 bg-white cursor-grab"
    >
      {module.title}
    </div>
  );
}
```

### 1.6 Upload de vídeo na tela de edição da aula

Reaproveitando o fluxo do Mux visto anteriormente, agora do lado do formulário:

```tsx
// app/(admin)/admin/cursos/[id]/aulas/[lessonId]/VideoUploader.tsx
"use client";
import { useState } from "react";
import * as UpChunk from "@mux/upchunk"; // lib oficial do Mux para upload resumível

export function VideoUploader({ lessonId }: { lessonId: string }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "ready">("idle");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");

    // Pede ao backend uma URL de upload direto (visto na Parte 2 do documento anterior)
    const res = await fetch(`/api/admin/lessons/${lessonId}/upload`, { method: "POST" });
    const { uploadUrl } = await res.json();

    const upload = UpChunk.createUpload({
      endpoint: uploadUrl,
      file,
      chunkSize: 5120, // 5MB por chunk — evita falhas em conexões instáveis
    });

    upload.on("progress", (e) => setProgress(Math.round(e.detail)));
    upload.on("success", () => setStatus("processing")); // Mux ainda está processando
    upload.on("error", (err) => {
      console.error(err);
      setStatus("idle");
    });
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-6 text-center">
      {status === "idle" && (
        <input type="file" accept="video/*" onChange={handleFileChange} />
      )}
      {status === "uploading" && <p>Enviando... {progress}%</p>}
      {status === "processing" && (
        <p>Vídeo enviado! Processando no servidor (pode levar alguns minutos)...</p>
      )}
      {status === "ready" && <p className="text-green-600">✓ Vídeo pronto</p>}
    </div>
  );
}
```

> O status `"processing"` para `"ready"` viria de um `useEffect` fazendo polling em `/api/admin/lessons/[id]` a cada alguns segundos, ou — melhor ainda — de um WebSocket/Server-Sent Event disparado quando o worker de vídeo (visto no documento anterior) processa o evento `video.asset.ready`.

### 1.7 Listagem de alunos e status de matrícula/assinatura

```tsx
// app/(admin)/admin/alunos/page.tsx
import { prisma } from "@/lib/prisma";

export default async function StudentsPage() {
  const enrollments = await prisma.enrollment.findMany({
    include: { user: true, course: true },
    orderBy: { enrolledAt: "desc" },
    take: 50,
  });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b">
          <th className="py-2">Aluno</th>
          <th>Curso</th>
          <th>Status</th>
          <th>Data</th>
        </tr>
      </thead>
      <tbody>
        {enrollments.map((e) => (
          <tr key={e.id} className="border-b">
            <td className="py-2">{e.user.name}</td>
            <td>{e.course.title}</td>
            <td>
              <span className={e.status === "ACTIVE" ? "text-green-600" : "text-gray-400"}>
                {e.status}
              </span>
            </td>
            <td>{e.enrolledAt.toLocaleDateString("pt-BR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## PARTE 2 — Autenticação Completa

### 2.1 Setup do Auth.js (NextAuth v5)

```bash
npm install next-auth@beta @auth/prisma-adapter bcryptjs
```

```typescript
// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" }, // jwt funciona melhor com credentials + edge middleware
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.passwordHash) return null; // usuário só tem login social

        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    // Injeta o role do usuário no JWT — necessário para checar permissões sem ir ao banco toda hora
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

### 2.2 Cadastro com email/senha

```typescript
// app/(auth)/cadastro/actions.ts
"use server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Mínimo de 8 caracteres"),
});

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: { email: ["Este email já está cadastrado"] } };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.create({
    data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "STUDENT" },
  });

  return { success: true };
}
```

### 2.3 Login social (Google) — botão simples

```tsx
// components/GoogleLoginButton.tsx
"use client";
import { signIn } from "next-auth/react";

export function GoogleLoginButton() {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl: "/meus-cursos" })}
      className="w-full border rounded-md py-2 flex items-center justify-center gap-2"
    >
      Entrar com Google
    </button>
  );
}
```

### 2.4 Recuperação de senha — fluxo completo

**Passo 1 — modelo para o token de reset:**

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")

  @@map("password_reset_tokens")
}
```

**Passo 2 — solicitar recuperação:**

```typescript
// app/(auth)/recuperar-senha/actions.ts
"use server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { emailQueue } from "@/lib/queue/queues";

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Mesma resposta independente de o email existir ou não —
  // evita que alguém use esse formulário para descobrir quais emails estão cadastrados
  if (!user) return { success: true };

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // expira em 30 minutos
    },
  });

  await emailQueue.add("password-reset-email", {
    email: user.email,
    resetUrl: `${process.env.APP_URL}/redefinir-senha?token=${token}`,
  });

  return { success: true };
}
```

**Passo 3 — redefinir a senha:**

```typescript
// app/(auth)/redefinir-senha/actions.ts
"use server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { error: "Link inválido ou expirado. Solicite um novo." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() }, // token de uso único
    }),
  ]);

  return { success: true };
}
```

> Pontos de segurança embutidos: resposta idêntica se o email existe ou não (evita enumeração de usuários), token aleatório de 32 bytes (não-adivinhável), expiração curta (30 min), e marcação de uso único (`usedAt`) — reutilizar o mesmo link duas vezes não funciona.

### 2.5 Proteção de rotas via Middleware

Essa é a camada que impede acesso não autorizado **antes mesmo de a página carregar**, rodando no edge:

```typescript
// middleware.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = (req.auth?.user as any)?.role;

  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedStudentRoute = pathname.startsWith("/meus-cursos") || pathname.startsWith("/curso/");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/cadastro");

  // Bloqueia acesso ao admin sem permissão
  if (isAdminRoute && (!isLoggedIn || !["ADMIN", "INSTRUCTOR"].includes(userRole))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Bloqueia área do aluno sem login
  if (isProtectedStudentRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Usuário já logado não deveria ver a tela de login de novo
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/meus-cursos", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/meus-cursos/:path*", "/curso/:path*", "/login", "/cadastro"],
};
```

### 2.6 Helper `requireRole` usado nas Server Actions

Complementa o middleware — o middleware protege a navegação de página, mas Server Actions chamadas via formulário também precisam de checagem própria (defesa em profundidade):

```typescript
// lib/auth.ts
import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser();
  if (!user || !allowedRoles.includes((user as any).role)) {
    throw new Error("Não autorizado");
  }
  return user as { id: string; role: string; email: string; name: string };
}
```

### 2.7 Por que checar em dois lugares (middleware + Server Action)

| Camada | Protege contra |
|---|---|
| Middleware | Alguém digitando a URL do admin direto no navegador |
| `requireRole` na Server Action | Alguém chamando a action diretamente (ex: via DevTools ou script), sem passar pela página |

Confiar só no middleware é um erro comum — Server Actions no Next.js são endpoints HTTP reais por baixo dos panos, então precisam da própria verificação de autorização.

---

## 3. Checklist Final

- [ ] Toda Server Action de admin chama `requireRole` antes de tocar no banco
- [ ] Instrutor só edita/vê os próprios cursos (`assertOwnsCourse`), admin vê tudo
- [ ] Resposta de "esqueci minha senha" é idêntica exista ou não o email (anti-enumeração)
- [ ] Token de reset de senha: aleatório, expira em minutos, uso único
- [ ] Middleware cobre todas as rotas sensíveis (`matcher` configurado corretamente)
- [ ] Reordenação de módulos/aulas usa transação — nunca updates soltos em loop sem transação
- [ ] Upload de vídeo vai direto do browser para o Mux/Bunny (upload resumível), nunca passa pelo seu servidor Next.js
