import { Check } from "lucide-react";
import { ScrollRow } from "@/components/ui/scroll-row";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { useSamples, type Sample } from "@/lib/showcase";
import type { ShowcaseFeature } from "@/lib/api-client";

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
  const items = samples.filter((sample) => sample.feature === feature).slice(0, 14);
  if (!items.length) return null;

  return (
    <div className="mt-3">
      <p className="mb-2 text-[11px] font-medium text-white/50">
        {selectable ? "Start from an example, then add your own photos" : "Examples"}
      </p>
      <ScrollRow className="gap-2 pb-1" nudge={false}>
        {items.map((sample) => {
          const active = sample.id === selectedId;
          return (
            <button
              key={sample.id}
              type="button"
              disabled={!selectable}
              aria-pressed={selectable ? active : undefined}
              aria-label={selectable ? (active ? "Remove this example" : "Use this example") : "Example"}
              onClick={() => onSelect(active ? null : sample)}
              className={`relative h-28 w-[84px] shrink-0 overflow-hidden rounded-2xl bg-black transition sm:h-32 sm:w-24 ${active ? "ring-2 ring-mint" : selectable ? "opacity-85 ring-1 ring-white/10 hover:opacity-100 hover:ring-violet/50" : "ring-1 ring-white/10"} ${selectable ? "" : "cursor-default"}`}
            >
              <Thumb sample={sample} />
              {active && (
                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-mint text-[#10231f]"><Check size={12} strokeWidth={3} /></span>
              )}
            </button>
          );
        })}
      </ScrollRow>
    </div>
  );
}
