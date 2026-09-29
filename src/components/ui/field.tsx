import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls (UI/UX plan §4, Web Interface Guidelines): ≥ 44px targets, hover raises
 * contrast, aria-invalid turns the border red, native pickers follow the theme. Focus uses
 * the global :focus-visible ring. Every control still needs a <label> or aria-label.
 */
const control = cn(
  "w-full rounded-[var(--r-md)] border border-line bg-surface text-[15px] text-foreground placeholder:text-faint",
  "transition-[border-color] duration-150 hover:border-muted",
  "aria-[invalid=true]:border-danger disabled:opacity-50",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11 px-3.5", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-11 px-3.5 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 w-auto px-3", className)} {...props} />;
}

/** Checkbox + text share one hit target (no dead zone between box and label). */
export function CheckboxField({ className, children, ...props }: Omit<ComponentProps<"input">, "type"> & { children: React.ReactNode }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[var(--ink)]" {...props} />
      <span>{children}</span>
    </label>
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold", className)} {...props} />;
}
