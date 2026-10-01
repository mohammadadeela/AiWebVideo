import { useEffect, useLayoutEffect, type RefObject } from "react";

/**
 * Makes a textarea grow with what is typed, up to a sensible cap, then scroll inside itself.
 * The cap is the smaller of `maxPx` and a fraction of the window height, so a long message can never push
 * the rest of the chat off the screen (and it still fits on a phone with the keyboard open).
 */
export function autoGrowHeights(contentHeight: number, minPx: number, maxPx: number, windowHeight: number, viewportFraction: number) {
  const cap = Math.max(minPx, Math.min(maxPx, Math.round(windowHeight * viewportFraction)));
  return { height: Math.min(Math.max(contentHeight, minPx), cap), scrolls: contentHeight > cap };
}

export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minPx, maxPx = 280, viewportFraction = 0.4 }: { minPx: number; maxPx?: number; viewportFraction?: number },
) {
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const { height, scrolls } = autoGrowHeights(el.scrollHeight, minPx, maxPx, window.innerHeight, viewportFraction);
    el.style.height = `${height}px`;
    el.style.overflowY = scrolls ? "auto" : "hidden";
  };
  useLayoutEffect(resize, [value, minPx, maxPx, viewportFraction]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }); // eslint-disable-line react-hooks/exhaustive-deps
}
