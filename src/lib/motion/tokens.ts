/**
 * Motion tokens (UI/UX plan §2.4). Mirrored in CSS as --dur-*, --ease-*, --spring.
 * Every animation in the app uses these — see the motion map in plan §3.3.
 */
export const dur = { fast: 0.16, med: 0.28, slow: 0.56 } as const;

export const ease = {
  /** entrances, most UI */
  out: [0.22, 1, 0.36, 1],
  /** exits */
  in: [0.55, 0, 1, 0.45],
} as const;

export const springs = {
  /** snap-backs, toggles */
  snappy: { type: "spring", stiffness: 380, damping: 26 },
  /** card return, pill */
  bouncy: { type: "spring", stiffness: 320, damping: 19 },
  /** layout moves */
  gentle: { type: "spring", stiffness: 170, damping: 22 },
  /** throwing a card off-screen */
  fling: { type: "spring", stiffness: 60, damping: 12 },
  /** twin orb distance */
  orb: { type: "spring", stiffness: 120, damping: 14 },
} as const;

/** Standard "pop" entrance for chips (habit learned, pivotal badge). */
export const pop = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: springs.bouncy },
  exit: { opacity: 0, scale: 0.8, transition: { duration: dur.fast, ease: ease.in } },
} as const;
