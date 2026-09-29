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

export const toast = {
  info: (message: string) => sonnerToast(message, { duration: 2200 }),
  error: (message: string) => sonnerToast.error(message, { duration: 4200 }),
  /** A reversible action: the Undo window is the toast's lifetime. */
  undoable: (message: string, onUndo: () => void) =>
    sonnerToast(message, { duration: 4200, action: { label: "Undo", onClick: onUndo } }),
};
