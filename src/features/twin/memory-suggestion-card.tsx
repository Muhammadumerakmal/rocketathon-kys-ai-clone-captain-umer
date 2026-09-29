"use client";

import { BookmarkPlus, Check, Pencil } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import type { MemoryKind, MemorySuggestion } from "@/contracts";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { postJson } from "@/lib/fetcher";
import { pop } from "@/lib/motion/tokens";

const KIND_LABEL: Record<MemoryKind, string> = {
  procedural: "Habit",
  value: "Value",
  goal: "Goal",
  episodic: "Moment",
  semantic: "Fact",
};

type Saved = { state: "idle" } | { state: "saving" } | { state: "saved" };

/**
 * "Remember this?" (memory picking from chat). The twin only PROPOSES; nothing is stored
 * until the user taps Save — plan §0 "Control: nothing happens without me". Editable first.
 */
export function MemorySuggestionCard({ suggestion, onDismiss }: { suggestion: MemorySuggestion; onDismiss: () => void }) {
  const [text, setText] = useState(suggestion.content);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<Saved>({ state: "idle" });

  async function save() {
    setSaved({ state: "saving" });
    try {
      await postJson("/api/memory", { content: text.trim(), kind: suggestion.kind });
      setSaved({ state: "saved" });
    } catch (e) {
      setSaved({ state: "idle" });
      toast.error(e instanceof Error ? e.message : "Couldn't save that memory.");
    }
  }

  if (saved.state === "saved") {
    return (
      <m.p {...pop} className="flex items-center gap-1.5 text-sm text-success" role="status">
        <Check className="size-4" aria-hidden /> Your twin will remember: “{text}”
      </m.p>
    );
  }

  return (
    <m.div {...pop} className="rounded-[var(--r-md)] border border-line bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <BookmarkPlus className="size-3.5" aria-hidden /> Remember this? · {KIND_LABEL[suggestion.kind]}
      </p>
      {editing ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={300}
          aria-label="Edit memory"
          className="mt-2 w-full rounded-[var(--r-sm)] border border-line bg-surface p-2 text-sm"
          autoFocus
        />
      ) : (
        <p className="mt-1 text-[15px]">{text}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" onClick={save} loading={saved.state === "saving"} disabled={text.trim().length < 3}>
          Save
        </Button>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden /> Edit
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Not now
        </Button>
      </div>
    </m.div>
  );
}
