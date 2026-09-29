import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TrainingQuestion } from "@/contracts";
import { QUESTION_BANK } from "@/lib/training/questions";

const seed = readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8");

describe("question bank", () => {
  it("every question matches the contract", () => {
    QUESTION_BANK.forEach((q) => TrainingQuestion.parse(q));
  });

  it("has 5 retest questions (Self-Consistency Ceiling) and covers all 8 traits", () => {
    expect(QUESTION_BANK.filter((q) => q.isRetest)).toHaveLength(5);
    const traits = new Set(QUESTION_BANK.flatMap((q) => q.options.flatMap((o) => Object.keys(o.weights))));
    expect(traits.size).toBe(8);
  });

  it("stays in sync with supabase/seed.sql (slugs, option ids, retest flags)", () => {
    for (const q of QUESTION_BANK) {
      const row = new RegExp(`\\('${q.slug}',[^\\n]*'${q.category}', ${q.isRetest}, `);
      expect(seed, `seed row for ${q.slug}`).toMatch(row);
      for (const o of q.options) expect(seed).toContain(`"id":"${o.id}"`);
    }
  });
});
