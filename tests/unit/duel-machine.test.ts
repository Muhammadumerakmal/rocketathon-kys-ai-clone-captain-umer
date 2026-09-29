import { describe, expect, it } from "vitest";
import type { DuelRound, DuelScenario } from "@/contracts";
import { duelReducer, isThinking, type DuelResult, type DuelState } from "@/features/duel/duel-machine";

const scenario: DuelScenario = { id: "s1", scenario: "Trip or work?", options: ["Trip", "Work"], category: "lifestyle" };
const board = { rounds: 0, twinHits: 0, baselineHits: 0, liftPts: 0 };
const round: DuelRound = {
  id: "00000000-0000-4000-8000-000000000001",
  scenario,
  userChoice: "Work",
  twinChoice: "Work",
  twinDistribution: { Work: 1 },
  baselineChoice: "Trip",
  twinMatched: true,
  baselineMatched: false,
};
const result: DuelResult = { round, board: { rounds: 1, twinHits: 1, baselineHits: 0, liftPts: 100 }, next: { ...scenario, id: "s2" } };
const start: DuelState = { phase: "choosing", scenario, choice: null, board };

const run = (s: DuelState, ...actions: Parameters<typeof duelReducer>[1][]) => actions.reduce(duelReducer, s);

describe("duel state machine (plan §6.3)", () => {
  it("can't lock without a choice", () => {
    expect(run(start, { type: "lock" }).phase).toBe("choosing");
  });

  it("choice is locked before any reveal", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "pick", choice: "Trip" });
    expect(s).toMatchObject({ phase: "locked", choice: "Work", count: 3 });
  });

  it("never reveals before the answers arrive, even after the countdown", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "tick" }, { type: "tick" }, { type: "tick" });
    expect(s.phase).toBe("locked");
    expect(isThinking(s)).toBe(true);
    expect(duelReducer(s, { type: "answers", result }).phase).toBe("revealed");
  });

  it("answers arriving early wait for the countdown (the countdown hides latency)", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "answers", result }, { type: "tick" });
    expect(s.phase).toBe("locked");
    expect(run(s, { type: "tick" }, { type: "tick" }).phase).toBe("revealed");
  });

  it("the countdown can be skipped", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "answers", result }, { type: "skip" });
    expect(s.phase).toBe("revealed");
  });

  it("a failure returns to choosing with the pick kept and an error", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "failed", message: "boom" });
    expect(s).toMatchObject({ phase: "choosing", choice: "Work", error: "boom" });
  });

  it("next moves to the following scenario with the updated score", () => {
    const s = run(start, { type: "pick", choice: "Work" }, { type: "lock" }, { type: "answers", result }, { type: "skip" }, { type: "next" });
    expect(s).toMatchObject({ phase: "choosing", choice: null, scenario: { id: "s2" }, board: { rounds: 1, liftPts: 100 } });
  });
});
