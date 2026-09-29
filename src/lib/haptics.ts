/**
 * Haptics (UI/UX plan §8): optional, short (≤ 12 ms), never the only feedback, and
 * switchable off. The preference is a per-device convenience, so localStorage is fine.
 */
const KEY = "twinos-haptics";

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHaptics(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // storage blocked: haptics simply stay at the default
  }
}

export function tick(ms = 8): void {
  if (!hapticsEnabled() || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  navigator.vibrate(Math.min(ms, 12));
}
