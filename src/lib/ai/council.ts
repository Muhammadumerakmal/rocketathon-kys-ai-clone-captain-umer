import "server-only";
import { run, withTrace } from "@openai/agents";
import type { CouncilResult, Lens, LensView } from "@/contracts";
import { lensAgent, synthesisAgent } from "./agents";
import type { TwinContext } from "./context";
import { configureAgents, TIMEOUTS } from "./models";

/**
 * Council v2 (plan §11.6). Lenses come from the user's own top goals; a Devil's Advocate
 * then argues against the majority; synthesis maps trade-offs and asks 3 questions — it
 * never decides (the CouncilSynthesis schema is .strict()).
 */

export const DEVILS_ADVOCATE: Lens = {
  id: "devils-advocate",
  name: "Devil's Advocate",
  kind: "devils_advocate",
  goalId: null,
  rubric: "Argue against the majority view.",
};

/** Fallback lenses when the user has recorded no goals yet. */
const DEFAULT_LENSES: Lens[] = [
  { id: "present-me", name: "Present-Me", kind: "goal", goalId: null, rubric: "How you'll feel this week: energy, stress, enjoyment." },
  { id: "future-me", name: "Future-Me", kind: "goal", goalId: null, rubric: "Where this leaves you in five years." },
];

export function lensesFromGoals(goals: TwinContext["profile"]["goals"]): Lens[] {
  if (goals.length === 0) return DEFAULT_LENSES;
  return goals.slice(0, 3).map((g, i) => ({
    id: `goal-${i + 1}`,
    name: `${shortName(g.title)}-Me`,
    kind: "goal",
    goalId: /^[0-9a-f-]{36}$/i.test(g.id) ? g.id : null,
    rubric: g.title.slice(0, 400),
  }));
}

const STOP_WORDS = new Set([
  "my", "to", "a", "an", "the", "be", "get", "this", "that", "goal", "is", "i", "want", "build", "make", "have", "more", "less",
  // time units say WHEN, not WHAT: "6-month emergency fund" → "Emergency"
  "day", "days", "week", "weeks", "month", "months", "year", "years", "hour", "hours", "night", "nights",
]);

/** "Build a 6-month emergency fund" → "Emergency": first meaningful word, capitalised. */
export function shortName(title: string): string {
  const word =
    title
      .toLowerCase()
      .split(/[^a-z]+/)
      .find((w) => w.length > 2 && !STOP_WORDS.has(w)) ?? "goal";
  return word.charAt(0).toUpperCase() + word.slice(1, 18);
}

export async function runCouncil(ctx: TwinContext, question: string): Promise<CouncilResult & { usage: { inputTokens: number; outputTokens: number } }> {
  configureAgents();
  const signal = AbortSignal.timeout(TIMEOUTS.predict);
  const lenses = lensesFromGoals(ctx.profile.goals);
  let usage = { inputTokens: 0, outputTokens: 0 };
  const add = (u: { inputTokens: number; outputTokens: number }) => {
    usage = { inputTokens: usage.inputTokens + u.inputTokens, outputTokens: usage.outputTokens + u.outputTokens };
  };

  return withTrace("twin.council", async () => {
    // Goal lenses in parallel: deterministic and cheaper than a manager agent.
    const goalViews = await Promise.all(
      lenses.map(async (lens) => {
        const r = await run(lensAgent(ctx, lens), question, { maxTurns: 1, signal });
        add(r.state.usage);
        if (!r.finalOutput) throw new Error(`Lens ${lens.name} returned nothing`);
        return { lens, view: r.finalOutput as LensView };
      }),
    );

    const majority = goalViews.map((v) => v.view.stance).join(" / ");
    const da = await run(lensAgent(ctx, DEVILS_ADVOCATE, majority), question, { maxTurns: 1, signal });
    add(da.state.usage);
    if (!da.finalOutput) throw new Error("Devil's Advocate returned nothing");
    const views = [...goalViews, { lens: DEVILS_ADVOCATE, view: da.finalOutput }];

    const synthesisInput = [
      `Decision: ${question}`,
      ...views.map((v) => `${v.lens.name}: ${v.view.stance} | reasons: ${v.view.topReasons.join("; ")} | risk: ${v.view.riskFlagged}`),
    ].join("\n");
    const syn = await run(synthesisAgent(), synthesisInput, { maxTurns: 1, signal });
    add(syn.state.usage);
    if (!syn.finalOutput) throw new Error("Synthesis returned nothing");

    return { question, views, synthesis: syn.finalOutput, usage };
  });
}
