import type { ReactNode } from "react";

// Estado vazio é orientação, não decoração (spec admin §9): sempre com ação direta.
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 border border-dashed border-[#453A5C] rounded-lg bg-[#2A2340]">
      <p className="font-medium text-[#F5F3F8]">{title}</p>
      <p className="text-sm text-[#B3A9C2] mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
