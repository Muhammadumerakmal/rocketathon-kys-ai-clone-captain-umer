"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bottom sheet (plan §4) on the native <dialog>: showModal() gives focus trapping, Esc to
 * close, an inert background and focus return for free. Slides up on phones, centres on desktop.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(); // unique per sheet, so two sheets never share a label

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on the backdrop
      aria-labelledby={titleId}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-[var(--r-lg)] border border-line bg-surface p-0 text-foreground shadow-[var(--shadow)]",
        "backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]",
        "min-[640px]:m-auto min-[640px]:max-w-lg min-[640px]:rounded-[var(--r-lg)]",
        "open:animate-[sheet-in_280ms_var(--ease-out)]",
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <h2 id={titleId} className="font-display text-xl font-bold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close">
          <X className="size-5" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
      <div className="pb-safe px-5 pb-5">{children}</div>
    </dialog>
  );
}
