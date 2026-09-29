import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons (UI/UX plan §2.3, §4): primary = ink with a soft vertical gradient and a 1px top
 * highlight; secondary = 1px line border. Press scales to 0.96. Loading keeps the width stable.
 * Hit targets ≥ 44px except `sm` (dense rows only).
 */
export const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 rounded-full font-semibold select-none",
    "transition-[transform,background-color,border-color,opacity] duration-150 ease-out active:scale-[0.96]",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary:
          "text-primary-foreground bg-[linear-gradient(180deg,color-mix(in_oklab,var(--ink)_86%,var(--paper))_0%,var(--ink)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:opacity-95",
        secondary: "border border-line bg-surface text-foreground hover:bg-surface-2",
        ghost: "text-foreground hover:bg-surface-2",
        danger: "bg-danger text-paper hover:opacity-90",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-13 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { loading?: boolean };

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {/* children keep their space while loading, so the button never changes width */}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
      {loading && <Dots className="absolute" />}
    </button>
  );
}

/** Three bouncing dots (plan §3.3 "Ask sending"). CSS-only; reduced motion freezes them. */
export function Dots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }} />
      ))}
    </span>
  );
}
