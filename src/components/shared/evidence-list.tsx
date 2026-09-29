import { Sparkles } from "lucide-react";
import type { EvidenceRef } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { pct } from "@/lib/utils";

/** Evidence a twin answer actually used. "Pivotal" = counterfactual ablation flipped the answer (F3). */
export function EvidenceList({ evidence }: { evidence: readonly EvidenceRef[] }) {
  if (evidence.length === 0) {
    return <p className="text-xs text-muted">No personal memories were relevant — treat this as a generic answer.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {evidence.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-xs">
          <Badge tone={e.type === "value" || e.type === "goal" ? "twin" : "neutral"}>{e.type}</Badge>
          <span className="flex-1">{e.label}</span>
          {e.pivotal && (
            <Badge tone="success" title="Removing this memory changed the answer">
              <Sparkles className="size-3" aria-hidden /> pivotal
            </Badge>
          )}
          <span className="tabular-nums text-muted" title="retrieval relevance">
            {pct(e.relevance)}
          </span>
        </li>
      ))}
    </ul>
  );
}
