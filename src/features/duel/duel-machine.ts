import type { DuelRound, DuelScenario, DuelScoreboard } from "@/contracts";

/**
 * Duel state machine (UI/UX plan §6.3). The UI derives everything from this state.
 * choosing → locked (countdown ticks while answers load) → revealed → next.
 * Reveal requires BOTH: countdown finished (or skipped) AND answers arrived.
 */
export const COUNTDOWN_FROM = 3;
export const TICK_MS = 460;

export type DuelState =
  | { phase: "choosing"; scenario: DuelScenario; choice: string | null; board: DuelScoreboard; error?: string }
  | { phase: "locked"; scenario: DuelScenario; choice: string; board: DuelScoreboard; count: number; result: DuelResult | null }
  | { phase: "revealed"; scenario: DuelScenario; choice: string; board: DuelScoreboard; result: DuelResult };

export interface DuelResult {
  round: DuelRound;
  board: DuelScoreboard;
  next: DuelScenario;
}

export type DuelAction =
  | { type: "pick"; choice: string }
  | { type: "lock" }
  | { type: "tick" }
  | { type: "skip" }
  | { type: "answers"; result: DuelResult }
  | { type: "failed"; message: string }
  | { type: "next" };

export function duelReducer(s: DuelState, a: DuelAction): DuelState {
  switch (a.type) {
    case "pick":
      return s.phase === "choosing" ? { ...s, choice: a.choice, error: undefined } : s;
    case "lock":
      return s.phase === "choosing" && s.choice ? { phase: "locked", scenario: s.scenario, choice: s.choice, board: s.board, count: COUNTDOWN_FROM, result: null } : s;
    case "tick":
      if (s.phase !== "locked") return s;
      return maybeReveal({ ...s, count: Math.max(0, s.count - 1) });
    case "skip":
      return s.phase === "locked" ? maybeReveal({ ...s, count: 0 }) : s;
    case "answers":
      return s.phase === "locked" ? maybeReveal({ ...s, result: a.result }) : s;
    case "failed":
      // back to choosing with the same pick, so "Reveal again" is one tap
      return s.phase === "locked" ? { phase: "choosing", scenario: s.scenario, choice: s.choice, board: s.board, error: a.message } : s;
    case "next":
      return s.phase === "revealed"
        ? { phase: "choosing", scenario: s.result.next, choice: null, board: s.result.board }
        : s;
  }
}

function maybeReveal(s: Extract<DuelState, { phase: "locked" }>): DuelState {
  return s.count === 0 && s.result ? { phase: "revealed", scenario: s.scenario, choice: s.choice, board: s.board, result: s.result } : s;
}

/** Waiting on the model after the countdown ended: the button shows "thinking". */
export const isThinking = (s: DuelState) => s.phase === "locked" && s.count === 0 && !s.result;
