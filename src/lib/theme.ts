/** Theme preference: an explicit choice lives in a cookie so the server renders it (no flash). */
export const THEME_COOKIE = "twinos-theme";
export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}
