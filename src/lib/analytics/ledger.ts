/**
 * Decision ledger + cumulative accuracy for Insights (UI/UX plan §6.6). Pure, unit-tested.
 * One entry per resolved decision (predictions you confirmed AND duel rounds), oldest first.
 */
export interface LedgerEntry {
  at: string;
  scenario: string;
  twinCorrect: boolean;
  baselineCorrect: boolean;
}

export interface AccuracyPoint {
  /** 1-based decision number */
  n: number;
  twin: number;
  stranger: number;
}

export function cumulativeAccuracy(ledger: readonly LedgerEntry[]): AccuracyPoint[] {
  let twin = 0;
  let stranger = 0;
  return ledger.map((e, i) => {
    twin += Number(e.twinCorrect);
    stranger += Number(e.baselineCorrect);
    return { n: i + 1, twin: twin / (i + 1), stranger: stranger / (i + 1) };
  });
}

/** The lead sentence: plain words, not a big-number widget. */
export function leadSentence(ledger: readonly LedgerEntry[]): string {
  if (ledger.length === 0) return "Confirm a few predictions and your twin's score will show up here.";
  const twin = ledger.filter((e) => e.twinCorrect).length;
  const stranger = ledger.filter((e) => e.baselineCorrect).length;
  const times = (k: number) => `${k} of ${ledger.length} time${ledger.length === 1 ? "" : "s"}`;
  return `Your twin matched you ${times(twin)}. A stranger matched ${stranger}.`;
}

/** SVG path through points scaled into a width × height box (y: 1 at top, 0 at bottom). */
export function linePath(values: readonly number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(values.length === 1 ? width / 2 : i * step).toFixed(1)},${((1 - v) * height).toFixed(1)}`)
    .join(" ");
}

/** Which decision index a pointer x (0..width) is over. */
export function indexAt(x: number, width: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(0, Math.round((x / width) * (count - 1))));
}
