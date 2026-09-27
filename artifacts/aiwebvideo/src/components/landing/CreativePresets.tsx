import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";

export interface CreativePreset {
  title: string;
  kind: "Image" | "Video";
  category: "Product" | "People" | "Interior";
  intent: CreationIntent;
  prompt: string;
  position: string;
  image?: string;
  preview?: string;
}

// Kept for older saved links. New gallery entries come exclusively from the admin library.
export const CREATIVE_PRESETS: CreativePreset[] = [];

function Preview({ item }: { item: MarketingVideo }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && document.visibilityState === "visible") void video.play().catch(() => {});
      else video.pause();
    }, { rootMargin: "100px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, [item.url]);
  if (item.kind === "image") return <img src={item.url ?? ""} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />;
  return <video ref={videoRef} src={item.url ?? ""} poster={item.posterUrl ?? undefined} muted loop playsInline preload="metadata" aria-hidden="true" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />;
}

export function CreativePresets({ inWorkspace = false, feature }: { inWorkspace?: boolean; feature?: CreationIntent }) {
  const [kind, setKind] = useState<"All" | "Image" | "Video">("All");
  const [category, setCategory] = useState<"All" | "Product" | "People" | "Interior">("All");
  const [items, setItems] = useState<MarketingVideo[]>([]);
  useEffect(() => {
    let active = true;
    void fetchMarketingSettings().then((settings) => {
      if (active) setItems(settings.videos.showcase.filter((item) => item.url && item.templateMode && item.published !== false));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const visible = items.filter((item) => {
    const itemKind = item.kind === "image" ? "Image" : "Video";
    const itemCategory = item.templateMode === "scenario" ? "People" : item.templateMode === "interior" ? "Interior" : "Product";
    return (!feature || item.templateMode === feature) && (kind === "All" || kind === itemKind) && (category === "All" || category === itemCategory);
  });
  function choose(item: MarketingVideo) {
    const intent = (item.templateMode || (item.kind === "image" ? "photo" : "product-video")) as CreationIntent;
    const preset: CreativePreset = {
      title: item.caption || "Create your version", kind: item.kind === "image" ? "Image" : "Video",
      category: intent === "scenario" ? "People" : intent === "interior" ? "Interior" : "Product",
      intent,
      prompt: item.templatePrompt?.trim() || (intent === "interior"
        ? "Use my uploaded space as the subject. Recreate the composition, atmosphere, lighting and material direction of the selected example while preserving the real room layout and proportions."
        : intent === "scenario"
          ? "Use the person in my uploaded portrait as the subject. Recreate the selected example's composition, light, camera direction and mood while preserving their recognizable features."
          : "Use my uploaded product as the subject. Recreate the selected example's composition, lighting, setting and visual rhythm while faithfully preserving my product's shape, color and branding."),
      position: "50% 50%", image: item.kind === "image" ? item.url ?? undefined : item.posterUrl ?? undefined,
      preview: item.kind === "video" ? item.url ?? undefined : undefined,
    };
    if (inWorkspace) {
      window.dispatchEvent(new CustomEvent("aiwebvideo:creative-preset", { detail: preset }));
      document.getElementById("workspace-creator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else window.location.assign(`/?create=${encodeURIComponent(intent)}&preset=${encodeURIComponent(item.id)}#generate`);
  }
  if (!items.length || (feature && !visible.length)) return null;
  return <section className={`mx-auto w-full max-w-7xl px-4 py-12 sm:px-5 lg:px-8 ${inWorkspace ? "!px-0 !py-8" : ""}`} aria-labelledby="presets-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-5">
      <h2 id="presets-title" className="font-display text-2xl font-semibold tracking-[-.04em] text-white sm:text-3xl">See what it creates.</h2>
      {!feature && <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1" aria-label="Filter gallery">
        {(["All", "Product", "People", "Interior"] as const).map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs transition ${category === value ? "bg-white text-[#171125]" : "bg-white/[.07] text-white/70 hover:bg-white/[.13]"}`}>{value}</button>)}
        <span className="mx-1 w-px shrink-0 bg-white/10" />
        {(["All", "Image", "Video"] as const).map((value) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value)} className={`shrink-0 rounded-full px-3 py-2 text-xs transition ${kind === value ? "bg-white text-[#171125]" : "bg-white/[.07] text-white/70 hover:bg-white/[.13]"}`}>{value === "All" ? "All media" : `${value}s`}</button>)}
      </div>}
    </div>
    {visible.length ? <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {visible.map((item) => <button key={item.id} type="button" onClick={() => choose(item)} aria-label={`Create your version of ${item.caption || "this example"}`} className="group relative aspect-[3/4] overflow-hidden bg-[#20192d] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">
        <Preview item={item} />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80 transition group-hover:opacity-100" />
        {item.kind !== "image" && <Play size={17} fill="currentColor" className="absolute right-3 top-3 text-white drop-shadow" aria-hidden="true" />}
        <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-sm font-medium text-white"><span className="line-clamp-2">{item.caption || "Create your version"}</span><ArrowUpRight size={18} className="shrink-0 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
      </button>)}
    </div> : <p className="py-12 text-center text-sm text-white/60">No examples in this view yet.</p>}
  </section>;
}
