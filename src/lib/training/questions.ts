import type { TrainingQuestion } from "@/contracts";

/**
 * Decision DNA question bank. Mirror of supabase/seed.sql (the DB copy is what live mode reads);
 * tests/unit/training-bank.test.ts fails if the two drift apart.
 * Ids are deterministic so mock mode can round-trip answers.
 */
const q = (n: number) => `00000000-0000-4000-9000-${n.toString(16).padStart(12, "0")}`;

export const QUESTION_BANK: TrainingQuestion[] = [
  {
    id: q(1), slug: "job-offer", category: "career", isRetest: true,
    question: "Two job offers land at once: a steady corporate role, or a startup paying 20% less with equity. You pick…",
    options: [
      { id: "steady", label: "The steady role", weights: { risk_tolerance: -0.8, opportunity_over_stability: -0.8 } },
      { id: "startup", label: "The startup", weights: { risk_tolerance: 0.8, opportunity_over_stability: 0.9 } },
    ],
  },
  {
    id: q(2), slug: "windfall", category: "money", isRetest: true,
    question: "You get an unexpected $2,000. Most of it goes to…",
    options: [
      { id: "save", label: "Savings", weights: { frugality: 0.9, long_term_focus: 0.6 } },
      { id: "course", label: "A course or skill", weights: { long_term_focus: 0.8, opportunity_over_stability: 0.4 } },
      { id: "treat", label: "Treating myself", weights: { frugality: -0.8, long_term_focus: -0.4 } },
    ],
  },
  {
    id: q(3), slug: "big-purchase", category: "money", isRetest: false,
    question: "Before a big purchase you usually…",
    options: [
      { id: "research", label: "Research for days", weights: { gut_over_analysis: -0.9 } },
      { id: "feel", label: "Go with what feels right", weights: { gut_over_analysis: 0.9 } },
      { id: "ask", label: "Ask friends what they would do", weights: { social_influence: 0.8, independence: -0.6 } },
    ],
  },
  {
    id: q(4), slug: "deadline", category: "learning", isRetest: true,
    question: "A deadline is two weeks away. Honestly, you usually…",
    options: [
      { id: "today", label: "Start today", weights: { procrastination: -0.9 } },
      { id: "midway", label: "Plan, then start about halfway", weights: { procrastination: 0.1 } },
      { id: "rush", label: "Rush it near the end", weights: { procrastination: 0.9 } },
    ],
  },
  {
    id: q(5), slug: "friends-pick", category: "relationships", isRetest: false,
    question: "All your friends push a plan you're unsure about. You…",
    options: [
      { id: "along", label: "Go along with it", weights: { social_influence: 0.8, independence: -0.4 } },
      { id: "own", label: "Suggest your own plan", weights: { independence: 0.7, social_influence: -0.5 } },
    ],
  },
  {
    id: q(6), slug: "move-city", category: "lifestyle", isRetest: true,
    question: "You're offered a better role — in a city where you know nobody. You…",
    options: [
      { id: "move", label: "Move", weights: { risk_tolerance: 0.7, opportunity_over_stability: 0.8 } },
      { id: "stay", label: "Stay near your people", weights: { opportunity_over_stability: -0.6, social_influence: 0.3 } },
    ],
  },
  {
    id: q(7), slug: "health-routine", category: "health", isRetest: false,
    question: "A new routine would pay off in five years but costs an hour a day now. You…",
    options: [
      { id: "now", label: "Start this week", weights: { long_term_focus: 0.9, procrastination: -0.4 } },
      { id: "later", label: "Start when life is less busy", weights: { long_term_focus: -0.5, procrastination: 0.6 } },
    ],
  },
  {
    id: q(8), slug: "gut-call", category: "career", isRetest: true,
    question: "A deal looks great on paper, but your gut says no. You…",
    options: [
      { id: "gut", label: "Trust your gut", weights: { gut_over_analysis: 0.9 } },
      { id: "numbers", label: "Trust the numbers", weights: { gut_over_analysis: -0.9 } },
    ],
  },
  {
    id: q(9), slug: "free-weekend", category: "lifestyle", isRetest: false,
    question: "A completely free weekend. You'd rather…",
    options: [
      { id: "project", label: "Start a risky side project", weights: { risk_tolerance: 0.6, independence: 0.5 } },
      { id: "rest", label: "Rest and recharge", weights: { risk_tolerance: -0.3, long_term_focus: 0.2 } },
      { id: "friends", label: "Say yes to whatever friends plan", weights: { social_influence: 0.6 } },
    ],
  },
  {
    id: q(10), slug: "manager-path", category: "career", isRetest: false,
    question: "Your manager suggests a career path you're lukewarm about. You…",
    options: [
      { id: "follow", label: "Follow their advice", weights: { social_influence: 0.6, independence: -0.7 } },
      { id: "carve", label: "Carve your own path", weights: { independence: 0.9 } },
    ],
  },
  {
    id: q(11), slug: "subscription", category: "money", isRetest: false,
    question: "For something you use daily: pay yearly (cheaper) or monthly (flexible)?",
    options: [
      { id: "yearly", label: "Yearly", weights: { frugality: 0.7, long_term_focus: 0.5 } },
      { id: "monthly", label: "Monthly", weights: { frugality: -0.3, opportunity_over_stability: 0.3 } },
    ],
  },
  {
    id: q(12), slug: "skill-choice", category: "learning", isRetest: false,
    question: "Learn a skill that pays off now, or one you love that might pay off later?",
    options: [
      { id: "now", label: "Pays off now", weights: { long_term_focus: -0.6, opportunity_over_stability: -0.3 } },
      { id: "love", label: "The one I love", weights: { long_term_focus: 0.7, opportunity_over_stability: 0.5, risk_tolerance: 0.3 } },
    ],
  },
];

export const questionBySlug = new Map(QUESTION_BANK.map((x) => [x.slug, x]));
