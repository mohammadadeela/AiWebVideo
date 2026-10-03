import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { BadgeDollarSign, Check, ChevronDown, LayoutGrid, X } from "lucide-react";
import { Link } from "wouter";
import { CREATION_FEATURES, featureById, type CreationIntent } from "@/lib/creationFeatures";
import { OPEN_FEATURE_MENU_EVENT, requestOpenFeatureMenu, useCreationMode } from "@/lib/creationMode";

/** True on phones (under 640 px). Phones get the feature rail and a bottom sheet; larger screens keep the pop-over. */
function useIsPhone(): boolean {
  const query = "(max-width: 639px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setPhone(media.matches);
    update();
    if (media.addEventListener) { media.addEventListener("change", update); return () => media.removeEventListener("change", update); }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);
  return phone;
}

const RAIL_HINT_KEY = "aiwebvideo.featureRailHint.v1";

/**
 * The features, in the navbar. Anyone can open any feature (it switches the chat box); an account is only needed
 * when they press Generate. Wide screens show all seven as pills; tablets show a "Features" menu with an icon and one
 * line for each; PHONES get a swipeable rail of every feature right under the logo row (with an "All" chip that opens a
 * bottom sheet of large cards), so nobody can miss that there is more than the feature that is open. The chat box's
 * "Change" button opens the same menu.
 */
export function FeaturePills({ onPick }: { onPick: (intent: CreationIntent) => void }) {
  const active = useCreationMode();
  return (
    <div className="hidden items-center gap-0.5 rounded-2xl border border-white/[.08] bg-black/25 p-1 backdrop-blur-md xl:flex" role="group" aria-label="Features">
      {CREATION_FEATURES.map(({ id, short, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          aria-pressed={active === id}
          title={label}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold transition ${
            active === id ? "bg-gradient-to-r from-violet to-blue-500 text-white shadow-[0_8px_22px_-12px_rgba(99,102,241,.95)]" : "text-white/65 hover:bg-white/[.08] hover:text-white"
          }`}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{short}</span>
        </button>
      ))}
    </div>
  );
}

/** Phones: a swipeable row of every feature. The first chip ("All") opens the full sheet; the row nudges once on a first visit. */
export function FeatureRail({ onPick, collapsed = false }: { onPick: (intent: CreationIntent) => void; collapsed?: boolean }) {
  const active = useCreationMode();
  const scroller = useRef<HTMLDivElement | null>(null);
  const chips = useRef(new Map<string, HTMLElement>());
  const firstRender = useRef(true);
  const [fade, setFade] = useState({ left: 0, right: 36 });

  function measure() {
    const el = scroller.current;
    if (!el) return;
    const left = el.scrollLeft > 4 ? 28 : 0;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4 ? 36 : 0;
    setFade((current) => (current.left === left && current.right === right ? current : { left, right }));
  }

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keep the open feature visible when it was chosen somewhere else (the sheet, the chat box's "Change" button).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    chips.current.get(active)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  // First visit on this device: a short nudge to the left and back shows that the row scrolls.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof window.matchMedia !== "function") return;
    let seen = false;
    try { seen = window.localStorage.getItem(RAIL_HINT_KEY) === "1"; } catch { seen = true; }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches || el.scrollWidth <= el.clientWidth + 8) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => el.scrollTo({ left: 72, behavior: "smooth" }), 1100));
    timers.push(window.setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 1900));
    try { window.localStorage.setItem(RAIL_HINT_KEY, "1"); } catch { /* storage blocked: the nudge may repeat, harmless */ }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const base = "snap-start inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition active:scale-[.97]";
  const idle = "border-white/[.14] bg-[#171233] text-white/85 hover:border-white/30 hover:text-white";
  const tab = collapsed ? -1 : undefined;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 sm:hidden ${collapsed ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
      aria-hidden={collapsed || undefined}
      data-feature-rail=""
    >
      <div className="min-h-0 overflow-hidden">
        <div
          ref={scroller}
          onScroll={measure}
          role="group"
          aria-label="Features"
          className="feature-rail flex snap-x gap-2 overflow-x-auto px-3 pb-2.5 pt-0.5"
          style={{ ["--fade-l" as string]: `${fade.left}px`, ["--fade-r" as string]: `${fade.right}px` }}
        >
          <button type="button" tabIndex={tab} onClick={requestOpenFeatureMenu} aria-label="All features" className={`${base} border-violet/50 bg-[#241a4d] text-white`}>
            <LayoutGrid size={16} className="text-violet" aria-hidden="true" />
            <span>All</span>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-violet/30 px-1 text-[11px] font-bold" aria-hidden="true">{CREATION_FEATURES.length}</span>
          </button>
          {CREATION_FEATURES.map(({ id, short, label, icon: Icon }) => (
            <button
              key={id}
              ref={(node) => { if (node) chips.current.set(id, node); else chips.current.delete(id); }}
              type="button"
              tabIndex={tab}
              onClick={() => onPick(id)}
              aria-pressed={active === id}
              aria-label={label}
              className={`${base} ${active === id ? "border-transparent bg-gradient-to-r from-violet to-blue-500 text-white shadow-[0_8px_22px_-12px_rgba(99,102,241,.95)]" : idle}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{short}</span>
            </button>
          ))}
          <Link href="/pricing" tabIndex={tab} className={`${base} ${idle}`}>
            <BadgeDollarSign size={16} className="text-mint" aria-hidden="true" />
            <span>Pricing</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Phones, once the rail has folded away on scroll: one clear button that still opens every feature. */
export function FeatureMenuButton() {
  return (
    <button
      type="button"
      onClick={requestOpenFeatureMenu}
      aria-label="All features"
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/[.12] bg-[#171233] px-3 text-[12px] font-semibold text-white/90 transition active:scale-[.97] sm:hidden"
    >
      <LayoutGrid size={17} className="text-violet" aria-hidden="true" />
      Features
    </button>
  );
}

export function FeatureDropdown({ onPick }: { onPick: (intent: CreationIntent) => void }) {
  const active = useCreationMode();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_FEATURE_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_FEATURE_MENU_EVENT, show);
  }, []);
  const current = featureById(active);
  const phone = useIsPhone();

  if (phone) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="feature-sheet-overlay fixed inset-0 z-[75] bg-black/65" />
          <Dialog.Content
            aria-label="Choose a feature"
            className="feature-sheet fixed inset-x-0 bottom-0 z-[80] max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-[28px] border border-b-0 border-white/[.12] bg-[#0e0a22] px-4 pt-2.5 text-white shadow-[0_-30px_80px_-30px_rgba(0,0,0,.95)] outline-none"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <span className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 pt-1">
                <Dialog.Title className="text-[18px] font-bold leading-tight">What do you want to make?</Dialog.Title>
                <Dialog.Description className="mt-1 text-[12.5px] leading-snug text-white/60">
                  {CREATION_FEATURES.length} ways to create. Tap one to start.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#1c1638] text-white/80 transition active:scale-95">
                <X size={18} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {CREATION_FEATURES.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setOpen(false); onPick(id); }}
                  aria-pressed={active === id}
                  className={`relative flex min-h-[112px] flex-col items-start gap-2 rounded-2xl border p-3 text-left transition active:scale-[.98] [&:last-child]:col-span-2 [&:last-child]:min-h-[84px] ${
                    active === id ? "border-violet/70 bg-[#2a1f58]" : "border-white/[.09] bg-[#16112f]"
                  }`}
                >
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${active === id ? "bg-gradient-to-br from-violet to-blue-500 text-white" : "bg-[#241d47] text-violet"}`}>
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="block text-[14px] font-bold leading-tight">{label}</span>
                  <span className="block text-[12px] leading-snug text-white/60">{description}</span>
                  {active === id && <Check size={16} className="absolute right-3 top-3 text-violet" aria-hidden="true" />}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 px-1 pt-3.5">
              <p className="text-[11.5px] leading-4 text-white/50">Sign in or create a free account when you press Generate.</p>
              <Link href="/pricing" onClick={() => setOpen(false)} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-white/85"><BadgeDollarSign size={14} aria-hidden="true" />Pricing</Link>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Features. Open: ${current.label}`}
          className="cinematic-nav-pill inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[.10] bg-white/[.045] px-2 text-white/85 transition hover:bg-white/[.08] min-[420px]:px-2.5 sm:px-3 xl:hidden"
        >
          {/* shows what is open, so the button is also the "which feature am I on" label */}
          <current.icon size={16} className="text-violet" aria-hidden="true" />
          <span className="text-[11px] font-semibold">{current.short}</span>
          <ChevronDown size={13} className={`text-white/50 transition max-[419px]:hidden ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={10}
          aria-label="Choose a feature"
          className="z-[70] w-[min(94vw,540px)] rounded-2xl border border-white/10 bg-[#0e0a22]/[.97] p-2.5 text-white shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] backdrop-blur-xl"
        >
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CREATION_FEATURES.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setOpen(false); onPick(id); }}
                aria-pressed={active === id}
                className={`flex min-h-[58px] items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  active === id ? "border-violet/60 bg-violet/[.16]" : "border-white/[.07] bg-white/[.03] hover:border-white/20 hover:bg-white/[.07]"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active === id ? "bg-gradient-to-br from-violet to-blue-500 text-white" : "bg-white/[.07] text-violet"}`}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold leading-tight">{label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/55">{description}</span>
                </span>
                {active === id && <Check size={16} className="shrink-0 text-violet" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-2.5">
            <p className="text-[11px] leading-4 text-white/45">Sign in or create a free account when you press Generate.</p>
            <Link href="/pricing" onClick={() => setOpen(false)} className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white min-[480px]:hidden"><BadgeDollarSign size={13} aria-hidden="true" />Pricing</Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
