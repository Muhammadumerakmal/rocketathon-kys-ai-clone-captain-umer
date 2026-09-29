"use client";

import { HelpCircle, ShieldAlert, Swords } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CouncilResult } from "@/contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { postJson } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

export function CouncilView() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<CouncilResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await postJson<CouncilResult>("/api/council", { question }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The council couldn't meet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="q" className="block text-sm font-medium">
            What decision should your council debate?
          </label>
          <textarea id="q" required minLength={5} maxLength={1000} rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Should I take the paid safe job or the unpaid dream internship?" />
          <Button type="submit" disabled={loading}>
            {loading ? "Your council is debating…" : "Convene the council"}
          </Button>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </form>
      </Card>

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {result.views.map(({ lens, view }) => (
              <Card key={lens.id} className={cn("space-y-2", lens.kind === "devils_advocate" && "border-warning/60")}>
                <div className="flex items-center gap-2">
                  {lens.kind === "devils_advocate" && <Swords className="size-4" aria-hidden />}
                  <CardTitle>{lens.name}</CardTitle>
                  {lens.kind === "devils_advocate" && <Badge tone="warning">argues against the majority</Badge>}
                </div>
                <CardDescription className="text-xs">{lens.rubric}</CardDescription>
                <p className="text-sm font-medium">{view.stance}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {view.topReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {view.riskFlagged}
                </p>
              </Card>
            ))}
          </div>

          <Card className="space-y-4">
            <CardTitle>Where your council stands</CardTitle>
            {result.synthesis.agreementPoints.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Agreement</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {result.synthesis.agreementPoints.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.synthesis.tradeoffs.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Trade-offs</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.synthesis.tradeoffs.map((t) => (
                    <li key={t.between}>
                      <strong>{t.between}:</strong> {t.tension}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-lg bg-twin/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <HelpCircle className="size-3.5" aria-hidden /> Questions only you can answer
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {result.synthesis.questionsForYou.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>
            <CardDescription>The council maps the trade-offs. It never decides — you do.</CardDescription>
          </Card>
        </>
      )}
    </div>
  );
}
