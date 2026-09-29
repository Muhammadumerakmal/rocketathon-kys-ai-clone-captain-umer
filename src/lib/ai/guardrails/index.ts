import type { InputGuardrail, OutputGuardrail } from "@openai/agents";

/**
 * Guardrails (plan §4, §15). Deterministic pattern checks — cheap, fast, testable.
 * They run on every twin chat; tripping one ends the run with a friendly message.
 */

const IMPERSONATION_REQUEST = [
  /\b(twin|clone|copy|model|simulate|impersonate)\b.{0,40}\b(of|as)\b.{0,20}\b(my|his|her|their)\s+(ex|boss|partner|wife|husband|friend|mom|mother|dad|father|coworker|colleague)\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\s+(me|him|her|them)\b.{0,60}\b(sign|send|email|reply|text|message)\b/i,
  /\b(sign|send)\b.{0,30}\bas\s+(me|if\s+you\s+were\s+me)\b/i,
];

/** Twins are self-only; the twin never acts AS the user towards others. */
export function detectImpersonation(text: string): string | null {
  const hit = IMPERSONATION_REQUEST.find((re) => re.test(text));
  return hit ? "TwinOS only models you, for your own decisions. It can't impersonate you or model other people." : null;
}

const FIRST_PERSON_CLAIM = /\b(I am|I'm)\s+(really\s+)?(you|the real\s+\w+|a human|not an AI)\b/i;

export function detectFirstPersonClaim(text: string, twinName: string): boolean {
  const escaped = twinName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const iAmName = twinName.trim() ? new RegExp(`\\b(I am|I'm)\\s+${escaped}\\b`, "i") : null;
  return FIRST_PERSON_CLAIM.test(text) || Boolean(iAmName?.test(text));
}

export const impersonationGuard: InputGuardrail = {
  name: "self_only_twin",
  runInParallel: false,
  execute: async ({ input }) => {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const reason = detectImpersonation(text);
    return { tripwireTriggered: reason !== null, outputInfo: { reason } };
  },
};

export function noFirstPersonClaimGuard(twinName: string): OutputGuardrail {
  return {
    name: "no_first_person_identity",
    execute: async ({ agentOutput }) => {
      const text = typeof agentOutput === "string" ? agentOutput : JSON.stringify(agentOutput);
      const hit = detectFirstPersonClaim(text, twinName);
      return { tripwireTriggered: hit, outputInfo: { hit } };
    },
  };
}

const INSTRUCTION_LIKE =
  /(ignore (all |any )?(previous|prior|above) instructions|disregard (the )?(system|previous)|you are now|new instructions:|system prompt|<\/?\s*(system|user_data|instructions?)\b)/i;

/** For memories and connector results: flag instruction-like text (plan §13 adversarial set). */
export function looksLikeInjection(text: string): boolean {
  return INSTRUCTION_LIKE.test(text);
}
