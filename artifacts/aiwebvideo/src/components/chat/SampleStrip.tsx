import { Check, Play } from "lucide-react";
import { ScrollRow } from "@/components/ui/scroll-row";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { useSamples, type Sample } from "@/lib/showcase";
import type { ShowcaseFeature } from "@/lib/api-client";

// Admins can add as many examples as they like per feature; the row scrolls sideways and never grows taller.
const MAX_SHOWN = 80;

function Thumb({ sample }: { sample: Sample }) {
  if (sample.kind === "image") return <img src={sample.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />;
  const embed = resolveVideoEmbed(sample.url);
  if (embed.kind !== "file") return sample.posterUrl ? <img src={sample.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/5" />;
  return <AutoplayVideo src={embed.src} poster={sample.posterUrl} />;
}

/**
 * Examples for the active creation mode, shown under the chat (landing page and workspace).
 * Picking one means "make one like this with MY references". Its hidden direction is applied on the
 * server; the visitor never sees any prompt text.
 */
export function SampleStrip({ feature, selectedId, onSelect, selectable }: {
  feature: ShowcaseFeature;
  selectedId: string | null;
  onSelect: (sample: Sample | null) => void;
  /** Website examples are inspiration only; every other mode can recreate a sample. */
  selectable: boolean;
}) {
  const { samples } = useSamples();
  const all = samples.filter((sample) => sample.feature === feature);
  const items = all.slice(0, MAX_SHOWN);
  if (!items.length) return null;
  const hasSelection = items.some((sample) => sample.id === selectedId);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium text-white/50">
          {selectable ? "Start from an example, then add your own photos" : "Examples"}
        </p>
        <p className="shrink-0 text-[11px] text-white/35">
          {selectable && hasSelection ? "Tap again to remove" : `${all.length} example${all.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <ScrollRow className="gap-2.5 pb-1.5" nudge={false}>
        {items.map((sample) => {
          const active = sample.id === selectedId;
          const dimmed = selectable && hasSelection && !active;
          return (
            selectable ? (
              <button
                key={sample.id}
                type="button"
                aria-pressed={active}
                aria-label={active ? "Remove this example" : "Use this example"}
                onClick={() => onSelect(active ? null : sample)}
                className={`group relative h-[132px] w-[96px] shrink-0 overflow-hidden rounded-[18px] bg-[#0d0919] transition duration-200 sm:h-[148px] sm:w-[108px] ${
                active
                  ? "scale-[1.02] ring-2 ring-mint shadow-[0_14px_34px_-14px_rgba(52,211,153,.7)]"
                  : selectable
                    ? `ring-1 ring-white/10 hover:-translate-y-0.5 hover:ring-violet/60 ${dimmed ? "opacity-60 hover:opacity-100" : ""}`
                    : "ring-1 ring-white/10"
              }`}
              >
              <Thumb sample={sample} />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
              {sample.kind === "video" && (
                <span className="pointer-events-none absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                  <Play size={11} className="ml-px fill-white" />
                </span>
              )}
              {active && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-mint text-[#10231f] shadow">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
              </button>
            ) : (
              // Inspiration only: a plain tile, not a disabled button (a disabled button swallows the mouse press,
              // so the row could not be dragged from it).
              <div key={sample.id} aria-label="Example" role="img" className={`group relative h-[132px] w-[96px] shrink-0 overflow-hidden rounded-[18px] bg-[#0d0919] transition duration-200 sm:h-[148px] sm:w-[108px] ${
                active
                  ? "scale-[1.02] ring-2 ring-mint shadow-[0_14px_34px_-14px_rgba(52,211,153,.7)]"
                  : selectable
                    ? `ring-1 ring-white/10 hover:-translate-y-0.5 hover:ring-violet/60 ${dimmed ? "opacity-60 hover:opacity-100" : ""}`
                    : "ring-1 ring-white/10"
              }`}>
              <Thumb sample={sample} />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
              {sample.kind === "video" && (
                <span className="pointer-events-none absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
                  <Play size={11} className="ml-px fill-white" />
                </span>
              )}
              {active && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-mint text-[#10231f] shadow">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
              </div>
            )
          );
        })}
      </ScrollRow>
    </div>
  );
}
