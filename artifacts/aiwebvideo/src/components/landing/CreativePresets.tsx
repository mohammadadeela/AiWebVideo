import { useEffect, useState } from "react";
import { Film, Image as ImageIcon } from "lucide-react";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";
import { LoopingMedia } from "./LoopingMedia";

export interface CreativePreset {
  title: string;
  kind: "Image" | "Video";
  category: "Product" | "People" | "Interior" | "Architecture" | "Website" | "Other";
  intent: CreationIntent;
  prompt: string;
  sourceUrl?: string;
  posterUrl?: string;
}

export function mediaKind(item: MarketingVideo): "Image" | "Video" {
  return item.kind === "image" || (!item.kind && /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(item.url ?? "")) ? "Image" : "Video";
}

export function presetFromMedia(item: MarketingVideo): CreativePreset | null {
  if (!item.url || !item.templateMode) return null;
  const intent = item.templateMode;
  const category = intent === "photo" || intent === "product-video" ? "Product" : intent === "scenario" ? "People" : intent === "interior" ? "Interior" : intent === "architecture" ? "Architecture" : intent === "website" ? "Website" : "Other";
  return { title: item.caption || "Creative example", kind: mediaKind(item), category, intent, prompt: item.templatePrompt || "", sourceUrl: item.url, posterUrl: item.posterUrl ?? undefined };
}

export function CreativePresets({ inWorkspace = false }: { inWorkspace?: boolean }) {
  const [kind, setKind] = useState<"All" | "Image" | "Video">("All");
  const [category, setCategory] = useState<"All" | CreativePreset["category"]>("All");
  const [published, setPublished] = useState<MarketingVideo[]>([]);
  useEffect(() => {
    let active = true;
    void fetchMarketingSettings().then((settings) => {
      if (active) setPublished(settings.videos.showcase.filter((item) => item.url?.startsWith("/api/assets/marketing/") && item.templateMode));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const examples = published.flatMap((item) => { const preset = presetFromMedia(item); return preset ? [{ item, preset }] : []; });
  const categories = ["All", ...new Set(examples.map(({ preset }) => preset.category))] as Array<"All" | CreativePreset["category"]>;
  const visible = examples.filter(({ preset }) => (kind === "All" || kind === preset.kind) && (category === "All" || category === preset.category));

  function choose(item: MarketingVideo, preset: CreativePreset) {
    if (inWorkspace) {
      window.dispatchEvent(new CustomEvent("aiwebvideo:creative-preset", { detail: preset }));
      document.getElementById("workspace-creator")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.history.pushState({}, "", `/?create=${encodeURIComponent(preset.intent)}&preset=${encodeURIComponent(item.id)}#generate`);
    window.dispatchEvent(new CustomEvent("aiwebvideo:creative-preset", { detail: preset }));
    document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!examples.length) return null;
  return (
    <section className={`mx-auto w-full max-w-7xl px-4 py-10 sm:px-5 lg:px-8 ${inWorkspace ? "!px-0 !py-8" : ""}`} aria-label="Creative examples">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-3xl">See what it <span className="bg-signature-text">creates.</span></h2>
        <div className="chat-scroll flex max-w-full items-center gap-1.5 overflow-x-auto pb-1" aria-label="Filter examples">
          {categories.map((value) => <button key={value} type="button" onClick={() => setCategory(value)} aria-pressed={category === value} className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold transition ${category === value ? "bg-white text-[#17161b]" : "bg-white/[.06] text-white/70 hover:bg-white/[.12] hover:text-white"}`}>{value}</button>)}
          <span className="mx-1 h-6 w-px shrink-0 bg-white/10" />
          {(["All", "Image", "Video"] as const).map((value) => <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold transition ${kind === value ? "bg-white text-[#17161b]" : "bg-white/[.06] text-white/70 hover:bg-white/[.12] hover:text-white"}`}>{value === "Image" ? <ImageIcon size={12} /> : value === "Video" ? <Film size={12} /> : null}{value === "All" ? value : `${value}s`}</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map(({ item, preset }) => <button key={item.id} type="button" onClick={() => choose(item, preset)} aria-label={`Use ${preset.title} as a reference for my ${preset.category.toLowerCase()} creation`} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-[#171125] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">
          {preset.kind === "Image" ? <img src={item.url!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" /> : <LoopingMedia src={item.url!} poster={item.posterUrl ?? undefined} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-3 pt-10 text-xs font-semibold text-white/95 sm:text-sm">{preset.title}</span>
        </button>)}
      </div>
    </section>
  );
}
