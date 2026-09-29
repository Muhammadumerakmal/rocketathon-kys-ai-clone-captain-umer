"use client";

import { Toaster as Sonner, toast as sonnerToast } from "sonner";

/** Toasts (plan §4): role="status"; 4.2 s when there's an action (Undo), 2.2 s otherwise. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={88}
      mobileOffset={96}
      toastOptions={{
        classNames: {
          toast: "!bg-surface !text-foreground !border-border !rounded-[var(--r-md)] !shadow-[var(--shadow)] !font-sans",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full !font-semibold",
          description: "!text-muted",
        },
      }}
    />
  );
}

/** How long a reversible action waits before it's committed — the toast's lifetime. */
export const UNDO_MS = 4200;

export const toast = {
  info: (message: string) => sonnerToast(message, { duration: 2200 }),
  error: (message: string) => sonnerToast.error(message, { duration: 4200 }),
  /** A reversible action: the Undo window is the toast's lifetime. */
  undoable: (message: string, onUndo: () => void) =>
    sonnerToast(message, { duration: UNDO_MS, action: { label: "Undo", onClick: onUndo } }),
};
