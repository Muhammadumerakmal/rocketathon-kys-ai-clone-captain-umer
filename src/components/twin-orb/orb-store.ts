"use client";

import { useSyncExternalStore } from "react";

/**
 * One global orb state (plan §5) so every orb on screen reacts together:
 * a duel match pulses the top-bar orb AND the big one on the page.
 */
export type OrbMode = "idle" | "listening" | "thinking";

interface OrbState {
  readiness: number;
  mode: OrbMode;
  pulseKey: number;
  missKey: number;
}

let state: OrbState = { readiness: 0, mode: "idle", pulseKey: 0, missKey: 0 };
const listeners = new Set<() => void>();

function set(patch: Partial<OrbState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const orb = {
  setReadiness: (readiness: number) => {
    const r = Math.min(1, Math.max(0, readiness));
    if (r !== state.readiness) set({ readiness: r });
  },
  setMode: (mode: OrbMode) => {
    if (mode !== state.mode) set({ mode });
  },
  /** twin matched you: rings pull together */
  pulse: () => set({ pulseKey: state.pulseKey + 1 }),
  /** twin missed: rings knock apart */
  miss: () => set({ missKey: state.missKey + 1 }),
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useOrbState(): OrbState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
