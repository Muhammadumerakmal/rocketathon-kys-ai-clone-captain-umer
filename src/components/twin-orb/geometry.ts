/** Pure orb geometry (plan §5), unit-tested. viewBox "-4 -4 108 72", rings r=24. */

export const ORB_R = 24;
export const ORB_CY = 32;
export const ORB_CX = 50;
export const FAR = 46;
export const NEAR = 16;
export const LISTENING_PULL = 8;
export const PULSE_VELOCITY = -140;
export const MISS_VELOCITY = 190;

export const ORB_SIZES = { sm: 36, md: 92, lg: 132, xl: 156 } as const;
export type OrbSize = keyof typeof ORB_SIZES;

/** readiness 0..1 → centre distance 46 → 16 (viewBox units); listening pulls 8 closer. */
export function targetDistance(readiness: number, listening = false): number {
  const r = Math.min(1, Math.max(0, readiness));
  const d = FAR - (FAR - NEAR) * r;
  return Math.max(NEAR - LISTENING_PULL, listening ? d - LISTENING_PULL : d);
}

export const ringCenters = (distance: number) => ({ ax: ORB_CX - distance / 2, bx: ORB_CX + distance / 2 });

/** Idle breathing (r ± 0.7) and the "thinking" orbit of ring B on a small ellipse. */
export function idleRadius(tMs: number): number {
  return ORB_R + 0.7 * Math.sin(tMs / 1100);
}
export function thinkingOffset(tMs: number): { dx: number; dy: number } {
  return { dx: 3 * Math.cos(tMs / 380), dy: 2.2 * Math.sin(tMs / 380) };
}

export const orbLabel = (readiness: number) =>
  `Your twin: ${Math.round(Math.min(1, Math.max(0, readiness)) * 100)}% of the way to knowing how you decide`;
