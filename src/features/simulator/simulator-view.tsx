"use client";

import { AlertTriangle, DoorOpen, FlaskConical } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Reversibility, SimulatedOption, Simulation } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";

const DOOR: Record<Reversibility, { label: string; tone: "success" | "warning" | "danger"; hint: string }> = {
  "two-way-door": { label: "Two-way door", tone: "success", hint: "Easy to reverse — lean toward just trying it." },
  "costly-to-reverse": { label: "Costly to reverse", tone: "warning", hint: "Reversible, but it'll cost you." },
  "one-way-door": { label: "One-way door", tone: "danger", hint: "Hard to undo — slow down." },
};

interface Response {
  simulation: Simulation;
  goals: { id: string; title: string }[];
}

export function SimulatorView() {
  const [form, setForm] = useState({ optionA: "", optionB: "", context: "" });
  const [res, setRes] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setRes(await postJson<Response>("/api/simulator", form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Option A
            <input required minLength={2} maxLength={300} value={form.optionA} onChange={(e) => setForm({ ...form, optionA: e.target.value })} className={`${input} mt-1`} placeholder="Paid safe job" />
          </label>
          <label className="text-sm font-medium">
            Option B
            <input required minLength={2} maxLength={300} value={form.optionB} onChange={(e) => setForm({ ...form, optionB: e.target.value })} className={`${input} mt-1`} placeholder="Unpaid dream internship" />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Context (optional)
            <textarea maxLength={1000} rows={2} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} className={`${input} mt-1`} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Simulating…" : "Simulate both paths"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-danger sm:col-span-2" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>

      {res && (
        <>
          <Badge>Scenario simulation — not a forecast</Badge>
          <div className="grid gap-4 md:grid-cols-2">
            <OptionCard option={res.simulation.optionA} goals={res.goals} />
            <OptionCard option={res.simulation.optionB} goals={res.goals} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-2">
              <CardTitle>Unknowns</CardTitle>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {res.simulation.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </Card>
            <Card className="space-y-2 border-twin/40">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="size-4" aria-hidden /> Cheapest experiment
              </CardTitle>
              <p className="text-sm">{res.simulation.cheapestExperiment}</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function OptionCard({ option, goals }: { option: SimulatedOption; goals: { id: string; title: string }[] }) {
  const door = DOOR[option.reversibility];
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{option.label}</CardTitle>
        <Badge tone={door.tone} title={door.hint}>
          <DoorOpen className="size-3" aria-hidden /> {door.label}
        </Badge>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Possible upsides</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {option.possibleUpsides.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Possible trade-offs</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {option.possibleTradeoffs.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <p className="flex items-start gap-1.5 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <span>
          <span className="font-medium">How it could fail:</span> {option.failureMode}
        </span>
      </p>
      {option.goalAlignment.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Your goals (shown per goal, never averaged)</p>
          <ul className="mt-1 space-y-1 text-sm">
            {option.goalAlignment.map((g) => (
              <li key={g.goalId} className="flex justify-between gap-2">
                <span className="truncate">{goalTitle.get(g.goalId) ?? "Goal"}</span>
                <span className="tabular-nums text-muted">
                  {g.score > 0.2 ? "helps" : g.score < -0.2 ? "hurts" : "neutral"} ({g.score > 0 ? "+" : ""}
                  {g.score.toFixed(1)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <CardDescription className="italic">{option.regretCheck}</CardDescription>
    </Card>
  );
}
