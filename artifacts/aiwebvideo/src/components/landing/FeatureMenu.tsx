import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, LayoutGrid } from "lucide-react";
import { CREATION_FEATURES, featureById, type CreationIntent } from "@/lib/creationFeatures";
import { OPEN_FEATURE_MENU_EVENT, useCreationMode } from "@/lib/creationMode";

/**
 * The features, in the navbar. Anyone can open any feature (it switches the chat box); an account is only needed
 * when they press Generate. Wide screens show all seven as pills; narrower ones show a "Features" menu with an icon
 * and one line for each, which the chat box's "Change" button can also open.
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

export function FeatureDropdown({ onPick }: { onPick: (intent: CreationIntent) => void }) {
  const active = useCreationMode();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_FEATURE_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_FEATURE_MENU_EVENT, show);
  }, []);
  const current = featureById(active);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Features. Open: ${current.label}`}
          className="cinematic-nav-pill inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-white/[.10] bg-white/[.045] px-2.5 text-white/85 transition hover:bg-white/[.08] sm:px-3 xl:hidden"
        >
          <LayoutGrid size={16} className="text-violet" aria-hidden="true" />
          <span className="hidden text-[11px] font-semibold sm:inline">Features</span>
          <ChevronDown size={13} className={`hidden text-white/50 transition sm:block ${open ? "rotate-180" : ""}`} aria-hidden="true" />
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
          <p className="px-2 pb-1 pt-2.5 text-[11px] leading-4 text-white/45">Open any feature to look around. You'll sign in or create a free account when you press Generate.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
