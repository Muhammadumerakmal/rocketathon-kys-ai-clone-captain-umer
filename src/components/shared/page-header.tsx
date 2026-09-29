import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Page title block (UI/UX plan §2.2): display type, one muted lead line, optional trailing slot. */
export function PageHeader({ title, description, children, className }: { title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-[clamp(30px,8vw,44px)] font-bold leading-tight">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] text-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}
