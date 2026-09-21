import type { ReactNode } from "react";

// Estado vazio é orientação, não decoração (spec admin §9): sempre com ação direta.
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 border border-dashed border-[#E5E3E0] rounded-lg bg-white">
      <p className="font-medium text-[#18181B]">{title}</p>
      <p className="text-sm text-[#6B6862] mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
