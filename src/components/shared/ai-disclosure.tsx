import { cn } from "@/lib/utils";

/** EU AI Act Art. 50 (Ultra plan §15): users must always know they're dealing with an AI. */
export function AiDisclosure({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-xs text-faint", className)}>
      TwinOS is an AI. It represents patterns from what you choose to share — it is not you, and it can be wrong. You make the decisions.
    </p>
  );
}
