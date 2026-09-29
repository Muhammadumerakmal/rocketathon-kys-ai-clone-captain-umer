import type { DecisionCategory, EvidenceRef, Prediction, PredictionSample } from "@/contracts";
import {
  betaPosteriorMean,
  buildConfidence,
  evidenceStrength,
  isUnderInformed,
  selfConsistency,
  topChoice,
  voteDistribution,
} from "./confidence";

/**
 * Turns k personalized samples + 1 stranger sample into the stored Prediction (plan §11.3, §12).
 * Pure: every number here is computed by app code, never taken from the model.
 */

export const STRONG_EVIDENCE = 0.6;

export interface AssembleContext {
  id: string;
  scenario: string;
  options: readonly string[];
  category: DecisionCategory;
  asOf: string | null;
  /** everything that was offered to the model, with app-computed relevance */
  retrieved: readonly EvidenceRef[];
  /** resolved history in this category */
  history: { n: number; hits: number };
  /** memory ids with an unresolved contradiction in the Belief Revision Inbox */
  contradicted: ReadonlySet<string>;
  k: number;
  promptVersion: string;
  model: string;
  now?: Date;
}

export class NoValidSamplesError extends Error {
  constructor() {
    super("The twin produced no valid answers for these options");
    this.name = "NoValidSamplesError";
  }
}

export function assemblePrediction(
  samples: readonly PredictionSample[],
  baselineChoice: string,
  ctx: AssembleContext,
): Prediction {
  const valid = samples.filter((s) => ctx.options.includes(s.choice));
  if (valid.length === 0) throw new NoValidSamplesError();

  const distribution = voteDistribution(
    valid.map((s) => s.choice),
    ctx.options,
  );
  const top = topChoice(distribution, ctx.options);
  const S = selfConsistency(distribution);
  const supporting = valid.filter((s) => s.choice === top);

  // Evidence: only ids the model was actually shown (hallucinated ids are dropped),
  // ranked by how many supporting samples cited them, then by relevance.
  const byId = new Map(ctx.retrieved.map((e) => [e.id, e]));
  const citations = new Map<string, number>();
  for (const s of supporting) {
    for (const id of new Set(s.citedEvidenceIds)) {
      if (byId.has(id)) citations.set(id, (citations.get(id) ?? 0) + 1);
    }
  }
  const evidence = [...citations.entries()]
    .map(([id, count]) => ({ ref: byId.get(id)!, count }))
    .sort((a, b) => b.count - a.count || b.ref.relevance - a.ref.relevance)
    .slice(0, 6)
    .map(({ ref }) => ref);

  const E = evidenceStrength({
    citedRelevances: evidence.map((e) => e.relevance),
    retrievedCount: ctx.retrieved.length,
    contradictions: evidence.filter((e) => ctx.contradicted.has(e.id)).length,
  });
  const H = betaPosteriorMean(ctx.history.hits, ctx.history.n);

  const confidence = buildConfidence({
    S,
    E,
    H,
    n: ctx.history.n,
    k: valid.length,
    strongEvidence: evidence.filter((e) => e.relevance >= STRONG_EVIDENCE).length,
    hits: ctx.history.hits,
    categoryLabel: ctx.category,
  });

  const missingInfo = [...new Set(valid.flatMap((s) => s.missingInfo))].slice(0, 3);

  return {
    id: ctx.id,
    scenario: ctx.scenario,
    options: [...ctx.options],
    category: ctx.category,
    distribution,
    topChoice: top,
    baseline: { choice: baselineChoice, agreesWithTwin: baselineChoice === top },
    evidence,
    rationale: (supporting[0]?.rationale ?? []).slice(0, 4),
    missingInfo,
    confidence,
    underInformed: isUnderInformed(S, E),
    asOf: ctx.asOf,
    status: "open",
    promptVersion: ctx.promptVersion,
    model: ctx.model,
    createdAt: (ctx.now ?? new Date()).toISOString(),
  };
}
