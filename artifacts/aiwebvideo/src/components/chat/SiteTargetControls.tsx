import type { ReactNode } from "react";
import { Building2, Layers, Store, Trees, X } from "lucide-react";
import { LEVEL_OPTIONS, TARGET_OPTIONS, markerRect, needsLevel, type SiteSelection, type TargetKind, type TargetLevel } from "@/lib/siteTarget";

const KIND_ICONS: Record<TargetKind, typeof Building2> = { building: Building2, unit: Store, floor: Layers, land: Trees };

/**
 * "What do you want to design here?": the whole building, one shop or unit, one floor, or empty land. This is the
 * customer's own choice and decides what the AI designs; for a shop or a floor they also say which level.
 */
export function TargetKindPicker({ value, onChange, attention }: {
  value: SiteSelection;
  onChange: (next: SiteSelection) => void;
  /** The customer tapped a spot but has not said what it is yet. */
  attention?: boolean;
}) {
  return (
    <div data-testid="target-kind-picker">
      <p className="text-xs font-semibold text-white">What do you want to design here?</p>
      <div role="radiogroup" aria-label="What to design" className="mt-2 grid grid-cols-2 gap-2">
        {TARGET_OPTIONS.map(({ id, label, hint }) => {
          const Icon = KIND_ICONS[id];
          const selected = value.kind === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...value, kind: selected ? null : id, level: id === "floor" && value.level === "ground" ? "1" : value.level })}
              className={`flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition active:scale-[.98] ${
                selected ? "border-mint/70 bg-mint/[.10]" : attention ? "border-[#f5b942]/70 bg-[#2a2110] hover:border-[#f5b942]" : "border-white/[.10] bg-[#100c24] hover:border-white/30"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-mint text-[#10231f]" : "bg-[#241d47] text-violet"}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold leading-tight text-white">{label}</span>
                <span className="block text-[11px] leading-tight text-white/50">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {attention && <p role="alert" className="mt-1.5 text-[11.5px] leading-4 text-amber-200">You marked a spot. Now choose what it is.</p>}

      {needsLevel(value.kind) && (
        <div className="mt-2.5">
          <p className="text-[11.5px] font-semibold text-white/80">{value.kind === "unit" ? "Which level is the shop or unit on?" : "Which floor?"}</p>
          <div role="radiogroup" aria-label="Floor" className="mt-1.5 flex flex-wrap gap-1.5">
            {LEVEL_OPTIONS.map(({ id, label }) => {
              const selected = value.level === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ ...value, level: id as TargetLevel })}
                  className={`h-10 min-w-[52px] rounded-lg border px-3 text-[12.5px] font-semibold transition ${selected ? "border-transparent bg-gradient-to-r from-violet to-blue-500 text-white" : "border-white/[.12] bg-[#1b1530] text-white/80 hover:border-white/30"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-white/45">
            {value.kind === "unit" ? "Upper floors and basements work too. Look up or down, then tap the shop." : "The rest of the building stays as it is."}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * A picture the customer can tap to say exactly which place they mean. The box drawn here is the box the AI is shown on a copy
 * of the picture, so what the customer sees is what is used. Keyboard users press Enter to mark the centre.
 */
export function TapSurface({ children, selection, active, label, onTap, onClear, className = "" }: {
  children: ReactNode;
  className?: string;
  selection: SiteSelection;
  /** False while something else (the map) is showing instead of the picture. */
  active: boolean;
  label: string;
  onTap: (x: number, y: number) => void;
  onClear: () => void;
}) {
  const marked = selection.x !== null && selection.y !== null;
  const box = marked ? markerRect(selection.kind, selection.x!, selection.y!) : null;
  return (
    <div className={`relative ${className}`}>
      {children}
      {active && (
        <button
          type="button"
          aria-label={label}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const centred = event.detail === 0;   // pressed with the keyboard
            const x = centred ? 0.5 : (event.clientX - rect.left) / Math.max(1, rect.width);
            const y = centred ? 0.5 : (event.clientY - rect.top) / Math.max(1, rect.height);
            onTap(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
          }}
          className="absolute inset-0 z-10 cursor-crosshair bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-mint"
        />
      )}
      {active && box && selection.x !== null && selection.y !== null && (
        <>
          <span
            data-testid="target-marker"
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-[3px] border-[3px] border-[#ff2d2d] shadow-[inset_0_0_0_2px_rgba(255,255,255,.9),0_0_0_1px_rgba(0,0,0,.35)]"
            style={{ left: `${box.left * 100}%`, top: `${box.top * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}
          />
          <span aria-hidden="true" className="pointer-events-none absolute z-10 h-[3px] w-[18px] -translate-x-1/2 -translate-y-1/2 bg-[#ff2d2d]" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%` }} />
          <span aria-hidden="true" className="pointer-events-none absolute z-10 h-[18px] w-[3px] -translate-x-1/2 -translate-y-1/2 bg-[#ff2d2d]" style={{ left: `${selection.x * 100}%`, top: `${selection.y * 100}%` }} />
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear the mark"
            className="absolute bottom-2 right-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/75 text-white transition active:scale-95"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
