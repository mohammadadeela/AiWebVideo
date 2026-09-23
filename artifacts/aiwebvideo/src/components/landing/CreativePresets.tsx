import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Film, Image as ImageIcon, Play } from "lucide-react";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";
import { resolveVideoEmbed } from "@/lib/videoEmbed";

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

export const CREATIVE_PRESETS: CreativePreset[] = [
  { title: "Rose light", kind: "Image", category: "Product", intent: "photo", position: "0% 0%", prompt: "Place my exact uploaded product in a warm rose-colored editorial studio. Sculptural stone, sharp afternoon shadows, refined reflections and a premium campaign composition. Keep the real product shape, packaging, color and printed details faithful to my photo." },
  { title: "Golden hour", kind: "Image", category: "Product", intent: "photo", position: "50% 0%", prompt: "Place my exact uploaded product in a sunlit sand-and-stone setting with a sculptural arch, soft natural texture and long golden-hour shadows. Preserve the original product design, proportions, color and label from the reference." },
  { title: "Splash reveal", kind: "Video", category: "Product", intent: "product-video", position: "100% 0%", preview: "/splash-preview.mp4", prompt: "Create a short high-energy product film: my actual uploaded product rotates through a vivid blue water splash, with close-up detail, realistic droplets, clean lighting and a strong final hero shot. Keep the product and its packaging consistent with the reference throughout. No invented logos or text." },
  { title: "Creator campaign", kind: "Image", category: "People", intent: "photo", position: "0% 100%", prompt: "Create a premium lifestyle campaign with the real uploaded product held naturally by an adult creator against a warm yellow backdrop. Keep the product identity and visible branding faithful to the reference, with believable hands, light and skin texture." },
  { title: "Modern living", kind: "Image", category: "Interior", intent: "interior", position: "50% 100%", prompt: "Redesign my uploaded room as a warm contemporary living space with a cream sofa, natural walnut, architectural daylight and restrained details. Keep the actual room layout, walls, openings and proportions grounded in my reference photos." },
  { title: "Trend portrait", kind: "Video", category: "People", intent: "scenario", position: "0% 100%", image: "/trend-portrait.webp", preview: "/trend-preview.mp4", prompt: "Make a fast vertical social portrait video using the uploaded photo of a person I have permission to depict. Start with a close-up, transition to a confident full look, then finish on a memorable direct-to-camera moment. Keep the same person's recognizable face and features throughout, with natural movement, consistent lighting and no invented branding. I will describe the specific trend and dialogue I want below." },
  { title: "Speak to camera", kind: "Video", category: "People", intent: "scenario", position: "100% 100%", preview: "/talking-preview.mp4", prompt: "Use the uploaded portrait of a person I have permission to depict as the character reference. Create a natural direct-to-camera talking scene in a cinematic interview setting. I will write the exact words they should say. Preserve recognizable facial features, natural voice timing and believable mouth movement; avoid changing their identity or adding claims I did not write." },
];

function PlayingPreview({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && document.visibilityState === "visible") void video.play().catch(() => {});
      else video.pause();
    }, { rootMargin: "120px" });
    const resume = () => { if (document.visibilityState === "visible") void video.play().catch(() => {}); else video.pause(); };
    observer.observe(video);
    document.addEventListener("visibilitychange", resume);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", resume); };
  }, [src]);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />;
}

export function CreativePresets({ inWorkspace = false }: { inWorkspace?: boolean }) {
  const [kind, setKind] = useState<"All" | "Image" | "Video">("All");
  const [category, setCategory] = useState<"All" | CreativePreset["category"]>("All");
  const [published, setPublished] = useState<MarketingVideo[]>([]);
  useEffect(() => {
    let active = true;
    void fetchMarketingSettings().then((settings) => {
      if (active) setPublished(settings.videos.showcase.filter((video) => video.url && video.templateMode && video.templatePrompt));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const visible = CREATIVE_PRESETS.filter((item) => (kind === "All" || item.kind === kind) && (category === "All" || item.category === category));
  const publishedVisible = published.filter((video) => kind !== "Image" && (category === "All" || (video.templateMode === "scenario" ? category === "People" : video.templateMode === "interior" ? category === "Interior" : category === "Product")));

  function choose(item: CreativePreset, presetId = item.title) {
    if (!inWorkspace) {
      window.location.assign(`/dashboard?create=${encodeURIComponent(item.intent)}&preset=${encodeURIComponent(presetId)}`);
      return;
    }
    window.dispatchEvent(new CustomEvent("aiwebvideo:creative-preset", { detail: item }));
    document.getElementById("workspace-creator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className={`mx-auto w-full max-w-7xl px-4 py-10 sm:px-5 lg:px-8 ${inWorkspace ? "!px-0 !py-8" : ""}`} aria-labelledby={inWorkspace ? "workspace-presets-title" : "presets-title"}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={inWorkspace ? "workspace-presets-title" : "presets-title"} className="font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-3xl">{inWorkspace ? "Explore templates" : <>See what it <span className="bg-signature-text">creates.</span></>}</h2>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter presets">
          {(["All", "Product", "People", "Interior"] as const).map((value) => <button key={value} type="button" onClick={() => setCategory(value)} aria-pressed={category === value} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition ${category === value ? "bg-white text-[#17161b]" : "bg-white/[.06] text-white/65 hover:bg-white/[.11] hover:text-white"}`}>{value}</button>)}
          <span className="mx-1 h-9 w-px bg-white/10" />
          {(["Image", "Video"] as const).map((value) => <button key={value} type="button" onClick={() => setKind(kind === value ? "All" : value)} aria-pressed={kind === value} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${kind === value ? "bg-violet text-white" : "bg-white/[.06] text-white/65 hover:bg-white/[.11] hover:text-white"}`}>{value === "Image" ? <ImageIcon size={13} /> : <Film size={13} />}{value}s</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((item) => <button key={item.title} type="button" onClick={() => choose(item)} aria-label={`Use ${item.title} template for my ${item.category.toLowerCase()}`} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[.09] bg-[#171125] text-left transition duration-200 hover:-translate-y-1 hover:border-violet/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
          {item.preview ? <PlayingPreview src={item.preview} poster={item.image} /> : item.image ? <img src={item.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="absolute inset-0 bg-[url('/creative-presets.webp')] bg-[length:300%_200%] transition duration-500 group-hover:scale-105" style={{ backgroundPosition: item.position }} />}
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">{item.kind === "Video" && <Play size={11} fill="currentColor" />}{item.kind}</span>
          <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-1 font-display text-base font-semibold text-white"><span>{item.title}</span><ArrowUpRight size={18} className="shrink-0 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
        </button>)}
        {publishedVisible.map((video) => {
          const embed = resolveVideoEmbed(video.url ?? "");
          const preset: CreativePreset = { title: video.caption || "Video scene", kind: "Video", category: video.templateMode === "scenario" ? "People" : video.templateMode === "interior" ? "Interior" : "Product", intent: video.templateMode || "video", prompt: video.templatePrompt || "", position: "50% 0%" };
          return <button key={video.id} type="button" onClick={() => choose(preset, video.id)} className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[.09] bg-[#171125] text-left transition hover:-translate-y-1 hover:border-violet/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
            {embed.kind === "file" ? <PlayingPreview src={embed.src} poster={video.posterUrl ?? undefined} /> : <iframe src={embed.src} title={preset.title} tabIndex={-1} loading="lazy" allow="autoplay; encrypted-media" className="pointer-events-none absolute inset-0 h-full w-full border-0 object-cover" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm"><Play size={11} fill="currentColor" />Video</span>
            <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-1 font-display text-sm font-bold text-white sm:text-base"><span className="line-clamp-2">{preset.title}</span><ArrowUpRight size={17} className="shrink-0" /></span>
          </button>;
        })}
      </div>
    </section>
  );
}
