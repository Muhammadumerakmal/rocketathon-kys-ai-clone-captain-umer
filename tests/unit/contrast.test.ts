import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contrast CI (UI/UX plan §2.1, §9): body-text token pairs must pass WCAG AA (4.5:1)
 * in BOTH themes. Parses src/styles/tokens.css so token edits are checked automatically.
 */
const css = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

const themes = {
  light: block(":root {"),
  dark: block(':root[data-theme="dark"]'),
};

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** [text, background] pairs used for body text somewhere in the UI. */
const BODY_PAIRS: [string, string][] = [
  ["ink", "paper"],
  ["ink", "surface"],
  ["ink-2", "paper"],
  ["ink-2", "surface"],
  ["ink-3", "surface"],
  ["ink-3", "paper"],
  ["twin-ink", "twin"],
  ["twin-ink", "surface"],
  ["stranger-ink", "stranger"],
  ["stranger-ink", "surface"],
  ["ok", "ok-bg"],
  ["bad", "bad-bg"],
  ["warn", "warn-bg"],
  ["paper", "ink"], // primary button label
];

describe.each(Object.entries(themes))("%s theme", (_name, t) => {
  it("dark block defines every token the light block does", () => {
    const missing = Object.keys(themes.light).filter((k) => !(k in t));
    expect(missing).toEqual([]);
  });

  it.each(BODY_PAIRS)("%s on %s ≥ 4.5:1", (fg, bg) => {
    const ratio = contrast(t[fg]!, t[bg]!);
    expect(ratio, `${fg} ${t[fg]} on ${bg} ${t[bg]} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
});

it("the dark media-query block mirrors the explicit dark theme exactly", () => {
  expect(block(':root:not([data-theme="light"])')).toEqual(themes.dark);
});
