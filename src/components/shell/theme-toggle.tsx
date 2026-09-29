"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Cookie-backed theme toggle (plan §4). Cross-fades via a view transition where supported.
 * Reads the *effective* theme from the DOM, so it works whether the current theme came
 * from the cookie or from the OS preference.
 */
export function ThemeToggle() {
  function current(): Theme {
    const explicit = document.documentElement.dataset.theme;
    if (explicit === "light" || explicit === "dark") return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function toggle() {
    const next: Theme = current() === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
    };
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(apply);
    } else apply();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
      aria-label="Switch between light and dark theme"
    >
      {/* Both icons rendered; CSS picks one, so there's no hydration mismatch. */}
      <Sun className="hidden size-5 dark:block" strokeWidth={1.8} aria-hidden />
      <Moon className="size-5 dark:hidden" strokeWidth={1.8} aria-hidden />
    </button>
  );
}
