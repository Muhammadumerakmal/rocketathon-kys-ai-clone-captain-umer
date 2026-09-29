import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolveRevisionRequest } from "@/contracts";
import { HttpError } from "@/lib/http";
import { getMemories, updateMemory } from "@/server/repos/memories";
import { getRevision, markResolved } from "@/server/repos/revisions";

/**
 * Belief Revision Inbox resolution (F4). History is never deleted:
 *   update     → old memory closes when the new one starts (valid_to), superseded_by = new
 *   both_true  → each gets a context qualifier, both stay active
 *   old_wrong  → old memory is muted (kept, excluded from predictions)
 */
export async function resolveRevision(sb: SupabaseClient, revisionId: string, req: ResolveRevisionRequest): Promise<void> {
  const rev = await getRevision(sb, revisionId);
  if (!rev) throw new HttpError("not_found", "Revision not found.");
  if (rev.resolved_at) throw new HttpError("bad_request", "Already resolved.");

  const [a, b] = await getMemories(sb, [rev.new_memory_id, rev.old_memory_id]);
  const newer = [a, b].find((m) => m?.id === rev.new_memory_id);
  const older = [a, b].find((m) => m?.id === rev.old_memory_id);
  if (!newer || !older) throw new HttpError("not_found", "One of the memories no longer exists.");

  switch (req.resolution) {
    case "update": {
      // valid_to can't precede valid_from (DB check), so clamp for back-dated edge cases.
      const end = new Date(Math.max(Date.parse(newer.validFrom), Date.parse(older.validFrom))).toISOString();
      await updateMemory(sb, older.id, { valid_to: end, superseded_by: newer.id });
      break;
    }
    case "both_true": {
      if (!req.qualifiers) throw new HttpError("bad_request", "Say when each one is true.");
      await Promise.all([
        updateMemory(sb, newer.id, { context_qualifier: req.qualifiers.newContext }),
        updateMemory(sb, older.id, { context_qualifier: req.qualifiers.oldContext }),
      ]);
      break;
    }
    case "old_wrong":
      await updateMemory(sb, older.id, { influence: "muted" });
      break;
  }
  await markResolved(sb, revisionId, req.resolution);
}
