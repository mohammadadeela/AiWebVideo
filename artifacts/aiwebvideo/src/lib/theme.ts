import { useSyncExternalStore } from "react";

/** Light is the default. The choice is remembered on this device. */
export type Theme = "light" | "dark";
const KEY = "aiwebvideo_theme";
const listeners = new Set<() => void>();

export function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0F1218" : "#FFFFFF");
  try { localStorage.setItem(KEY, theme); } catch { /* the choice simply lasts for this visit */ }
  listeners.forEach((listener) => listener());
}

export function useTheme(): Theme {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, currentTheme, () => "light");
}
