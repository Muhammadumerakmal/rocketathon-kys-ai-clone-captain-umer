"use client";

import { useState, type FormEvent } from "react";
import type { DueCheckin } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

/** Outcome check-ins (F7): learn from consequences, not just labels. */
export function Checkins({ initial }: { initial: DueCheckin[] }) {
  const [items, setItems] = useState(initial);
  if (items.length === 0) return null;

  return (
    <section className="space-y-3" aria-labelledby="checkins">
      <h2 id="checkins" className="text-lg font-semibold">
        How did it go? ({items.length})
      </h2>
      {items.map((c) => (
        <CheckinCard key={c.id} checkin={c} onDone={() => setItems((xs) => xs.filter((x) => x.id !== c.id))} />
      ))}
    </section>
  );
}

function CheckinCard({ checkin, onDone }: { checkin: DueCheckin; onDone: () => void }) {
  const [satisfaction, setSatisfaction] = useState(0);
  const [regret, setRegret] = useState<boolean | null>(null);
  const [surprise, setSurprise] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!satisfaction || regret === null) return;
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/outcomes", {
        predictionId: checkin.predictionId,
        actualChoice: checkin.topChoice,
        satisfaction,
        regret,
        ...(surprise.trim() && { surprise: surprise.trim() }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <CardDescription>
          You chose <strong className="text-foreground">{checkin.topChoice}</strong> for: {checkin.scenario}
        </CardDescription>
        <fieldset>
          <legend className="text-sm font-medium">How satisfied are you with it?</legend>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSatisfaction(n)}
                aria-pressed={satisfaction === n}
                className={cn("size-9 rounded-md border text-sm", satisfaction === n ? "border-twin bg-twin text-primary-foreground" : "border-border")}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Any regret?</legend>
          <div className="mt-1 flex gap-2">
            {[
              [false, "No"],
              [true, "Yes"],
            ].map(([v, label]) => (
              <Button key={String(v)} type="button" size="sm" variant={regret === v ? "primary" : "secondary"} onClick={() => setRegret(v as boolean)}>
                {label as string}
              </Button>
            ))}
          </div>
        </fieldset>
        <input value={surprise} onChange={(e) => setSurprise(e.target.value)} maxLength={500} placeholder="What surprised you? (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <Button type="submit" size="sm" disabled={saving || !satisfaction || regret === null}>
          {saving ? "Saving…" : "Save check-in"}
        </Button>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
