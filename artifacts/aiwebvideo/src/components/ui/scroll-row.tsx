import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal scroller that tells people there is more to swipe to.
 *  - soft edge fades appear only on the side that still has hidden content
 *  - a small arrow button on that side scrolls one "page" (tap or click)
 *  - on touch screens the row nudges once per session so the motion itself shows it slides
 *  - `activeKey` keeps the selected item in view when it changes
 */
export function ScrollRow({
  children,
  className = "",
  role,
  ariaLabel,
  activeKey,
  nudge = true,
  gutter = 44,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  ariaLabel?: string;
  activeKey?: string | number | null;
  nudge?: boolean;
  gutter?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    Array.from(el.children).forEach((child) => observer?.observe(child));
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // One gentle nudge per session on touch devices.
  useEffect(() => {
    if (!nudge) return;
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!coarse || reduced) return;
    try {
      if (window.sessionStorage.getItem("scroll-row-nudged")) return;
    } catch { /* storage may be unavailable */ }
    const timer = window.setTimeout(() => {
      if (el.scrollWidth <= el.clientWidth + 8) return;
      try { window.sessionStorage.setItem("scroll-row-nudged", "1"); } catch { /* ignore */ }
      el.scrollTo({ left: 56, behavior: "smooth" });
      window.setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 650);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  useEffect(() => {
    if (activeKey === undefined || activeKey === null) return;
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="true"], [data-active="true"]');
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeKey]);

  function page(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.7), behavior: "smooth" });
  }

  const fadeLeft = edges.left ? `transparent 0, #000 ${gutter}px` : "#000 0";
  const fadeRight = edges.right ? `#000 calc(100% - ${gutter}px), transparent 100%` : "#000 100%";
  const mask = `linear-gradient(to right, ${fadeLeft}, ${fadeRight})`;

  return (
    <div className="relative">
      <div
        ref={ref}
        role={role}
        aria-label={ariaLabel}
        className={`chat-scroll flex overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
        style={edges.left || edges.right ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
      >
        {children}
      </div>
      {edges.left && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Scroll left"
          onClick={() => page(-1)}
          className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-md backdrop-blur-md transition active:scale-90"
        >
          <ChevronLeft size={15} />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Scroll right for more"
          onClick={() => page(1)}
          className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-md backdrop-blur-md transition active:scale-90"
        >
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
