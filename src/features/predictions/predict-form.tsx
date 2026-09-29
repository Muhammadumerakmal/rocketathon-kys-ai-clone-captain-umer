"use client";

import { Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DecisionCategory, type Prediction } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { PredictionCard } from "./prediction-card";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export function PredictForm() {
  const [scenario, setScenario] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState<DecisionCategory>("career");
  const [asOf, setAsOf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Prediction | null>(null);

  const filled = options.map((o) => o.trim()).filter(Boolean);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await postJson<Prediction>("/api/predict", {
          scenario,
          category,
          // With < 2 options the server extracts them from the scenario.
          ...(filled.length >= 2 && { options: filled }),
          asOf: asOf ? new Date(`${asOf}T12:00:00Z`).toISOString() : null,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="scenario">
            What are you deciding?
          </label>
          <textarea
            id="scenario"
            required
            minLength={5}
            maxLength={1000}
            rows={2}
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="Take a paid, safe job at a bank, or an unpaid internship at my dream design studio?"
            className={inputCls}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Options (leave blank and the twin will suggest them)</legend>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  aria-label={`Option ${i + 1}`}
                  value={o}
                  maxLength={200}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={i === 0 ? "Paid safe job" : i === 1 ? "Unpaid dream internship" : `Option ${i + 1}`}
                  className={inputCls}
                />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="sm" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 5 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}>
                <Plus className="size-4" /> Add option
              </Button>
            )}
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2 text-muted">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value as DecisionCategory)} className="rounded-md border border-border bg-background px-2 py-1">
                {DecisionCategory.options.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-muted">
              As of
              <input type="date" value={asOf} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setAsOf(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1" />
            </label>
            <Button type="submit" disabled={loading} className="ml-auto">
              {loading ? "Running 5 twin samples + a stranger…" : "Predict my choice"}
            </Button>
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>
      {result && <PredictionCard prediction={result} />}
    </div>
  );
}
