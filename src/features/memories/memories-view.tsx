"use client";

import { Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { Influence, Memory, MemoryKind, MemoryRevision } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { del, getJson, postJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

const KINDS: (MemoryKind | "all")[] = ["all", "episodic", "semantic", "procedural", "value", "goal"];
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

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
        <p className="rounded-lg bg-twin/10 px-4 py-2 text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {revisions.length > 0 && (
        <section aria-labelledby="inbox" className="space-y-3">
          <h2 id="inbox" className="text-lg font-semibold">
            Belief Revision Inbox <Badge tone="warning">{revisions.length}</Badge>
          </h2>
          {revisions.map((r) => (
            <RevisionCard key={r.id} revision={r} onResolve={(body) => run(() => postJson(`/api/memory/revisions/${r.id}`, body), "Updated. Nothing was deleted — the old belief stays in your history.")} />
          ))}
        </section>
      )}

      <section aria-labelledby="timeline" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="timeline" className="text-lg font-semibold">
            Timeline
          </h2>
          <div className="flex flex-wrap items-center gap-1">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn("rounded-full px-3 py-1 text-xs", kind === k ? "bg-twin text-primary-foreground" : "bg-surface-2 text-muted")}
              >
                {k}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
              show past beliefs
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <Card>
            <CardDescription>No memories yet. Add something true about how you decide.</CardDescription>
          </Card>
        ) : (
          <ul className="space-y-2">
            {visible.map((m) => (
              <li key={m.id}>
                <Card className={cn("flex items-start justify-between gap-4 p-4", m.validTo && "opacity-60")}>
                  <div className="min-w-0 space-y-1">
                    <p className={cn("text-sm", m.influence === "sealed" && "italic")}>{m.content}</p>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                      <Badge>{m.kind}</Badge>
                      <Badge>{m.sourceType}</Badge>
                      {m.influence !== "active" && <Badge tone={m.influence === "sealed" ? "twin" : "warning"}>{m.influence}</Badge>}
                      <span>
                        {fmt(m.validFrom)} → {m.validTo ? fmt(m.validTo) : "now"}
                      </span>
                      {m.supersededBy && <span>· replaced by a newer belief</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {m.influence === "active" ? (
                      <IconButton label="Mute (exclude from predictions)" onClick={() => setInfluence(m, "muted")}>
                        <EyeOff className="size-4" />
                      </IconButton>
                    ) : (
                      <IconButton label="Make active" onClick={() => setInfluence(m, "active")}>
                        <Eye className="size-4" />
                      </IconButton>
                    )}
                    {m.influence !== "sealed" && (
                      <IconButton label="Seal (never sent to any model)" onClick={() => setInfluence(m, "sealed")}>
                        <Lock className="size-4" />
                      </IconButton>
                    )}
                    <IconButton label="Delete" onClick={() => run(() => del(`/api/memory/${m.id}`), "Deleted.")}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
      {children}
    </button>
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
        <CardTitle>
          <label htmlFor="memory">Tell your twin something true about you</label>
        </CardTitle>
        <textarea
          id="memory"
          required
          minLength={3}
          maxLength={4000}
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. I've started valuing stability since my rent went up."
          className="w-full rounded-lg border border-border bg-background p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-muted">
            True since
            <input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />
          </label>
          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={sealed} onChange={(e) => setSealed(e.target.checked)} />
            Seal it (stored for you only, never sent to AI)
          </label>
          <Button type="submit" disabled={saving} className="ml-auto">
            {saving ? "Saving…" : "Add memory"}
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
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <p className="text-xs text-muted">Before · since {fmt(revision.oldMemory.validFrom)}</p>
          {revision.oldMemory.content}
        </div>
        <div className="rounded-lg bg-twin/10 p-3 text-sm">
          <p className="text-xs text-muted">New · since {fmt(revision.newMemory.validFrom)}</p>
          {revision.newMemory.content}
        </div>
      </div>
      {both ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="When is the old one true?" placeholder="Old one is true when… (e.g. on side projects)" value={ctx.oldContext} onChange={(e) => setCtx({ ...ctx, oldContext: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
          <input aria-label="When is the new one true?" placeholder="New one is true when… (e.g. with rent money)" value={ctx.newContext} onChange={(e) => setCtx({ ...ctx, newContext: e.target.value })} className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
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
