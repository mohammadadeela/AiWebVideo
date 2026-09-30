import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { SHOWCASE_FEATURES, SHOWCASE_FEATURE_LABELS, type ShowcaseFeature } from "@/lib/api-client";
import { resolveVideoEmbed } from "@/lib/videoEmbed";
import { useSamples, startFromSample, type Sample } from "@/lib/showcase";
import { AutoplayVideo } from "./AutoplayVideo";

// A quiet rhythm of proportions so the grid reads as a wall of work, not a table of thumbnails.
const SHAPES = ["aspect-[3/4]", "aspect-square", "aspect-[4/5]", "aspect-[9/16]", "aspect-[4/5]", "aspect-[3/4]", "aspect-square"];

function Media({ sample, eager }: { sample: Sample; eager: boolean }) {
  if (sample.kind === "image") {
    return <img src={sample.url} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />;
  }
  const embed = resolveVideoEmbed(sample.url);
  if (embed.kind !== "file") {
    return <iframe src={embed.src} title="" className="pointer-events-none h-full w-full border-0" loading="lazy" allow="autoplay; encrypted-media" tabIndex={-1} />;
  }
  return <AutoplayVideo src={embed.src} poster={sample.posterUrl} eager={eager} />;
}

export function VideoShowcase() {
  const { samples, loaded } = useSamples();
  const [filter, setFilter] = useState<ShowcaseFeature | "all">("all");

  const features = useMemo(() => SHOWCASE_FEATURES.filter((feature) => samples.some((sample) => sample.feature === feature)), [samples]);
  const visible = filter === "all" ? samples : samples.filter((sample) => sample.feature === filter);

  // Nothing published yet: show no empty frame.
  if (loaded && !samples.length) return null;

  return (
    <section id="campaign-films" className="relative overflow-hidden border-b border-white/[.06]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(139,92,246,.18),transparent_34%),radial-gradient(circle_at_88%_32%,rgba(236,72,153,.1),transparent_32%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-5 sm:py-14 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[clamp(2rem,8vw,3.2rem)] font-bold leading-[.98] tracking-[-.045em] text-white">
            See what it <span className="bg-signature-text">creates.</span>
          </h2>
          {features.length > 1 && (
            <div role="tablist" aria-label="Filter examples" className="chat-scroll flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/[.05] p-1">
              {(["all", ...features] as const).map((feature) => (
                <button
                  key={feature}
                  type="button"
                  role="tab"
                  aria-selected={filter === feature}
                  onClick={() => setFilter(feature)}
                  className={`min-h-9 shrink-0 rounded-xl px-3.5 text-xs font-semibold transition ${filter === feature ? "bg-white text-[#1b1030]" : "text-white/60 hover:text-white"}`}
                >
                  {feature === "all" ? "All" : SHOWCASE_FEATURE_LABELS[feature]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-7 columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4">
          {visible.map((sample, index) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => startFromSample(sample)}
              aria-label="Make one like this"
              className={`group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-[22px] bg-[#0d0919] text-left ring-1 ring-white/10 transition duration-300 hover:-translate-y-0.5 hover:ring-violet/50 sm:mb-4 ${SHAPES[index % SHAPES.length]}`}
            >
              <Media sample={sample} eager={index < 4} />
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
              <span className="pointer-events-none absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white text-[#150f26] opacity-0 shadow-lg transition duration-300 group-hover:opacity-100 max-sm:opacity-90">
                <ArrowUpRight size={16} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
