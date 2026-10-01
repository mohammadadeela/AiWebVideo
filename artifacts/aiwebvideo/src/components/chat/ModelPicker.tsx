import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { displayCredits } from "@/lib/credits";
import type { PublicModelCard, PublicModelId } from "@/lib/generationModels";

const FAMILY_HEADING = { video: "Video models", image: "Image models", interior: "Space models" } as const;

function shortName(model: PublicModelCard) {
  return model.name.replace(/^AiWebVideo\s+/, "");
}

function creditsFor(model: PublicModelCard, quality: "1080p" | "4k") {
  const q = model.supportedQualities.includes(quality) ? quality : (model.supportedQualities[0] ?? "1080p");
  const internal = model.family === "video"
    ? (q === "4k" ? (model.internalCredits4k ?? model.internalCredits1080p ?? 1) : (model.internalCredits1080p ?? 1))
    : (q === "4k" ? (model.internalCredits4k ?? model.internalCreditsPerImage ?? 1) : (model.internalCreditsPerImage ?? 1));
  return displayCredits(internal);
}

/**
 * Model selector in the style of the ChatGPT / Claude pickers: the trigger is just the model name and a
 * chevron; the list is plain text rows (name, one-line description, check on the chosen one).
 */
export function ModelPicker({ models, selected, quality, open, onOpenChange, onSelect, trigger }: {
  models: PublicModelCard[];
  selected: PublicModelCard;
  quality: "1080p" | "4k";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: PublicModelId) => void;
  /** Optional extra content inside the trigger (before the name). */
  trigger?: ReactNode;
}) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Model: ${shortName(selected)}`}
          className={`creator-secondary-button generation-control generation-control-model ${open ? "generation-control-active" : ""}`}
        >
          {trigger}
          <span className="max-w-[150px] truncate font-semibold">{shortName(selected)}</span>
          <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Choose a model"
          className="generation-control-menu generation-control-menu-wide"
        >
          <div role="listbox" aria-label="Model" className="p-1">
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-white/45">{FAMILY_HEADING[selected.family]}</p>
            {models.map((model) => {
              const active = model.id === selected.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(model.id)}
                  className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${active ? "bg-white/[.07]" : "hover:bg-white/[.05]"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold leading-tight text-white">{shortName(model)}</span>
                      <span className="text-[11px] tabular-nums text-white/35">{creditsFor(model, quality)} cr{model.family === "video" ? "/s" : ""}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-[1.35] text-white/55">{model.tagline}</span>
                  </span>
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-white">
                    {active && <Check size={16} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
