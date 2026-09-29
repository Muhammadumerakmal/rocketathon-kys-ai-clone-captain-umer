/**
 * Swipe-deck commit rule (UI/UX plan §6.2), pure for unit tests.
 * Commit when |offset| > 100, or when flicked (|velocity| > 550) in the same direction
 * after at least 24px. Otherwise the card springs back.
 */
export const COMMIT_OFFSET = 100;
export const FLICK_VELOCITY = 550;
export const FLICK_MIN_OFFSET = 24;
export const RUBBER_BAND_AT = 150;

export type SwipeDir = -1 | 0 | 1;

export function commitDirection(offsetX: number, velocityX: number): SwipeDir {
  if (Math.abs(offsetX) > COMMIT_OFFSET) return offsetX > 0 ? 1 : -1;
  const sameDirection = Math.sign(offsetX) === Math.sign(velocityX);
  if (Math.abs(velocityX) > FLICK_VELOCITY && sameDirection && Math.abs(offsetX) > FLICK_MIN_OFFSET) {
    return velocityX > 0 ? 1 : -1;
  }
  return 0;
}

/** Which option a swipe direction means: left = first option, right = last. */
export function optionForDirection<T>(options: readonly T[], dir: -1 | 1): T {
  return dir < 0 ? options[0]! : options[options.length - 1]!;
}
