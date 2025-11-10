"use client";

import { useEffect, useState } from "react";

const LIGHT_THEME = "light";
const DARK_THEME = "dark";
const STORAGE_KEY = "quickway-theme";

function applyTheme(theme: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  document.body.dataset.theme = theme;
  document.body.style.colorScheme = theme === DARK_THEME ? "dark" : "light";
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>(LIGHT_THEME);
  const isDark = theme === DARK_THEME;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as string | null;
    if (stored === DARK_THEME || stored === LIGHT_THEME) {
      setTheme(stored);
      applyTheme(stored);
      return;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme(DARK_THEME);
      applyTheme(DARK_THEME);
      return;
    }
    applyTheme(LIGHT_THEME);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = isDark ? LIGHT_THEME : DARK_THEME;
    setTheme(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]"
      aria-label="Toggle theme"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
