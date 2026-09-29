"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Influence, Memory, MemoryKind, MemoryRevision } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CheckboxField, Input, Textarea } from "@/components/ui/field";
import { toast, UNDO_MS } from "@/components/ui/toaster";
import { del, getJson, postJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { MemoryRow } from "./memory-row";

const KINDS: (MemoryKind | "all")[] = ["all", "episodic", "semantic", "procedural", "value", "goal"];
// Fixed locale + UTC: identical on server and client (no hydration mismatch), and a "true since"
// date stored as UTC midnight shows the day the user picked, in every time zone.
const dateFmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

interface IngestResponse {
  memory: Memory | null;
  duplicateOf: string | null;
  contradictions: number;
  sensitive: boolean;
  flaggedInjection: boolean;
}

export function MemoriesView({ initialMemories, initialRevisions }: { initialMemories: Memory[]; initialRevisions: MemoryRevision[] }) {
  const [memories, setMemories] = useState(initialMemories);
  const [revisions, setRevisions] = useState(initialRevisions);
  const [kind, setKind] = useState<MemoryKind | "all">("all");
  const [showHistory, setShowHistory] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => memories.filter((m) => (kind === "all" || m.kind === kind) && (showHistory || m.validTo === null)),
    [memories, kind, showHistory],
  );

  async function refresh() {
    const [m, r] = await Promise.all([
      getJson<{ memories: Memory[] }>("/api/memory"),
      getJson<{ revisions: MemoryRevision[] }>("/api/memory/revisions"),
    ]);
    setMemories(m.memories);
    setRevisions(r.revisions);
  }

  async function run(action: () => Promise<unknown>, success?: string) {
    setError(null);
    try {
      await action();
      await refresh();
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  /** Delete with an undo window: hidden now, committed only if the toast isn't undone. */
  function remove(memory: Memory) {
    const index = memories.findIndex((x) => x.id === memory.id);
    setMemories((all) => all.filter((x) => x.id !== memory.id));
    const timer = setTimeout(() => void run(() => del(`/api/memory/${memory.id}`)), UNDO_MS);
    toast.undoable("Memory deleted.", () => {
      clearTimeout(timer);
      setMemories((all) => (all.some((x) => x.id === memory.id) ? all : [...all.slice(0, index), memory, ...all.slice(index)]));
    });
  }

  const setInfluence = (m: Memory, influence: Influence) =>
    run(() => postJson(`/api/memory/${m.id}`, { influence }, "PATCH"), influence === "sealed" ? "Sealed — it will never be sent to any AI model." : undefined);

  return (
    <div className="space-y-6">
      <AddMemoryForm
        onAdded={(res) =>
          run(async () => undefined,
            res.duplicateOf
              ? "Your twin already knew that — it's now weighted a little higher."
              : res.contradictions > 0
                ? "Saved. This conflicts with something older — resolve it in the inbox below."
                : res.flaggedInjection
                  ? "Saved but muted: it contains text that looks like instructions to an AI. Review it before unmuting."
                  : res.sensitive
                    ? "Saved. This looks sensitive — consider sealing it."
                    : "Saved.")
        }
        onError={setError}
      />

      {notice && (
        <p className="rounded-[var(--r-md)] bg-surface-2 px-4 py-2.5 text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-[var(--r-md)] bg-danger-soft px-4 py-2.5 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {revisions.length > 0 && (
        <section aria-labelledby="inbox" className="space-y-3">
          <h2 id="inbox" className="flex items-center gap-2 font-display text-xl font-bold">
            Belief Revision Inbox <Badge tone="warning">{revisions.length}</Badge>
          </h2>
          {revisions.map((r) => (
            <RevisionCard key={r.id} revision={r} onResolve={(body) => run(() => postJson(`/api/memory/revisions/${r.id}`, body), "Updated. Nothing was deleted — the old belief stays in your history.")} />
          ))}
        </section>
      )}

      <section aria-labelledby="timeline" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="timeline" className="font-display text-xl font-bold">
            Timeline
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-semibold capitalize transition-colors",
                    kind === k ? "bg-ink text-paper" : "bg-surface-2 text-muted hover:text-foreground",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <CheckboxField className="ml-1 text-muted" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)}>
              Show past beliefs
            </CheckboxField>
          </div>
        </div>

        {visible.length === 0 ? (
          <Card>
            <CardDescription>
              {memories.length === 0 ? "No memories yet. Add something true about how you decide." : "Nothing matches this filter."}
            </CardDescription>
          </Card>
        ) : (
          <ul className="space-y-2">
            {visible.map((m) => (
              <li key={m.id}>
                <MemoryRow
                  memory={m}
                  onToggleMute={() => void setInfluence(m, m.influence === "muted" ? "active" : "muted")}
                  onSeal={() => void setInfluence(m, "sealed")}
                  onDelete={() => remove(m)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddMemoryForm({ onAdded, onError }: { onAdded: (r: IngestResponse) => void; onError: (m: string) => void }) {
  const [content, setContent] = useState("");
  const [sealed, setSealed] = useState(false);
  const [since, setSince] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await postJson<IngestResponse>("/api/memory", {
        content,
        influence: sealed ? "sealed" : "active",
        ...(since && { validFrom: new Date(`${since}T00:00:00Z`).toISOString() }),
      });
      setContent("");
      setSince("");
      setSealed(false);
      onAdded(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <CardTitle className="font-display text-lg font-bold tracking-normal">
          <label htmlFor="memory">Tell your twin something true about you</label>
        </CardTitle>
        <Textarea
          id="memory"
          name="memory"
          autoComplete="off"
          required
          minLength={3}
          maxLength={4000}
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. I've started valuing stability since my rent went up…"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-2 text-muted">
            True since
            <Input type="date" name="since" value={since} onChange={(e) => setSince(e.target.value)} className="w-auto" />
          </label>
          <CheckboxField className="text-muted" checked={sealed} onChange={(e) => setSealed(e.target.checked)}>
            Seal it (stored for you only, never sent to AI)
          </CheckboxField>
          <Button type="submit" loading={saving} className="ml-auto">
            Add memory
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RevisionCard({ revision, onResolve }: { revision: MemoryRevision; onResolve: (body: unknown) => void }) {
  const [both, setBoth] = useState(false);
  const [ctx, setCtx] = useState({ newContext: "", oldContext: "" });

  return (
    <Card className="space-y-3 border-warning/60">
      <p className="text-sm text-muted">{revision.explanation}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="break-words rounded-[var(--r-md)] bg-surface-2 p-3 text-sm">
          <p className="text-xs text-muted">Before · since {fmt(revision.oldMemory.validFrom)}</p>
          {revision.oldMemory.content}
        </div>
        <div className="break-words rounded-[var(--r-md)] border border-line bg-surface p-3 text-sm">
          <p className="text-xs text-muted">New · since {fmt(revision.newMemory.validFrom)}</p>
          {revision.newMemory.content}
        </div>
      </div>
      {both ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input aria-label="When is the old one true?" autoComplete="off" placeholder="Old one is true when… (e.g. on side projects)" value={ctx.oldContext} onChange={(e) => setCtx({ ...ctx, oldContext: e.target.value })} />
          <Input aria-label="When is the new one true?" autoComplete="off" placeholder="New one is true when… (e.g. with rent money)" value={ctx.newContext} onChange={(e) => setCtx({ ...ctx, newContext: e.target.value })} />
          <Button size="sm" disabled={!ctx.newContext || !ctx.oldContext} onClick={() => onResolve({ resolution: "both_true", qualifiers: ctx })}>
            Save both
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onResolve({ resolution: "update" })}>
            I changed — update (old one ends)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setBoth(true)}>
            Both true, in different contexts
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onResolve({ resolution: "old_wrong" })}>
            The old one was wrong
          </Button>
        </div>
      )}
    </Card>
  );
}
