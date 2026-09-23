import { useEffect, useState } from "react";
import { ArrowUpRight, Film, Image as ImageIcon } from "lucide-react";
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
}

export const CREATIVE_PRESETS: CreativePreset[] = [
  { title: "Rose light", kind: "Image", category: "Product", intent: "photo", position: "0% 0%", prompt: "Place my exact uploaded product in a warm rose-colored editorial studio. Sculptural stone, sharp afternoon shadows, refined reflections and a premium campaign composition. Keep the real product shape, packaging, color and printed details faithful to my photo." },
  { title: "Golden hour", kind: "Image", category: "Product", intent: "photo", position: "50% 0%", prompt: "Place my exact uploaded product in a sunlit sand-and-stone setting with a sculptural arch, soft natural texture and long golden-hour shadows. Preserve the original product design, proportions, color and label from the reference." },
  { title: "Splash reveal", kind: "Video", category: "Product", intent: "product-video", position: "100% 0%", prompt: "Create a short high-energy product film: my actual uploaded product rotates through a vivid blue water splash, with close-up detail, realistic droplets, clean lighting and a strong final hero shot. Keep the product and its packaging consistent with the reference throughout. No invented logos or text." },
  { title: "Creator campaign", kind: "Image", category: "People", intent: "photo", position: "0% 100%", prompt: "Create a premium lifestyle campaign with the real uploaded product held naturally by an adult creator against a warm yellow backdrop. Keep the product identity and visible branding faithful to the reference, with believable hands, light and skin texture." },
  { title: "Modern living", kind: "Image", category: "Interior", intent: "interior", position: "50% 100%", prompt: "Redesign my uploaded room as a warm contemporary living space with a cream sofa, natural walnut, architectural daylight and restrained details. Keep the actual room layout, walls, openings and proportions grounded in my reference photos." },
  { title: "Trend portrait", kind: "Video", category: "People", intent: "scenario", position: "0% 100%", prompt: "Make a fast vertical social portrait video using the uploaded photo of a person I have permission to depict. Start with a close-up, transition to a confident full look, then finish on a memorable direct-to-camera moment. Keep the same person's recognizable face and features throughout, with natural movement, consistent lighting and no invented branding. I will describe the specific trend and dialogue I want below." },
  { title: "Speak to camera", kind: "Video", category: "People", intent: "scenario", position: "100% 100%", prompt: "Use the uploaded portrait of a person I have permission to depict as the character reference. Create a natural direct-to-camera talking scene in a cinematic interview setting. I will write the exact words they should say. Preserve recognizable facial features, natural voice timing and believable mouth movement; avoid changing their identity or adding claims I did not write." },
];

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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-utility text-xs font-semibold uppercase tracking-[.16em] text-mint">Ready scenes</p>
          <h2 id={inWorkspace ? "workspace-presets-title" : "presets-title"} className="font-display text-2xl font-bold tracking-[-.04em] text-white sm:text-3xl">Explore presets</h2>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter presets">
          {(["All", "Product", "People", "Interior"] as const).map((value) => <button key={value} type="button" onClick={() => setCategory(value)} aria-pressed={category === value} className={`min-h-10 rounded-full px-3 text-xs font-semibold transition ${category === value ? "bg-white text-[#17161b]" : "bg-white/[.06] text-white/65 hover:bg-white/[.11] hover:text-white"}`}>{value}</button>)}
          <span className="mx-1 h-9 w-px bg-white/10" />
          {(["Image", "Video"] as const).map((value) => <button key={value} type="button" onClick={() => setKind(kind === value ? "All" : value)} aria-pressed={kind === value} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${kind === value ? "bg-[#d8ff19] text-[#161a02]" : "bg-white/[.06] text-white/65 hover:bg-white/[.11] hover:text-white"}`}>{value === "Image" ? <ImageIcon size={13} /> : <Film size={13} />}{value}s</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7 lg:gap-3">
        {visible.map((item) => <button key={item.title} type="button" onClick={() => choose(item)} className="group relative aspect-[4/5] overflow-hidden rounded-[20px] border border-white/10 bg-[#28232a] text-left transition duration-200 hover:-translate-y-1 hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8ff19]">
          <span className="absolute inset-0 bg-[url('/creative-presets.webp')] bg-[length:300%_200%] transition duration-500 group-hover:scale-110" style={{ backgroundPosition: item.position }} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">{item.kind}</span>
          <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-1 font-display text-sm font-bold text-white sm:text-base"><span>{item.title}</span><ArrowUpRight size={17} className="shrink-0 opacity-70 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
        </button>)}
        {publishedVisible.map((video) => {
          const embed = resolveVideoEmbed(video.url ?? "");
          const preset: CreativePreset = { title: video.caption || "Video scene", kind: "Video", category: video.templateMode === "scenario" ? "People" : video.templateMode === "interior" ? "Interior" : "Product", intent: video.templateMode || "video", prompt: video.templatePrompt || "", position: "50% 0%" };
          return <button key={video.id} type="button" onClick={() => choose(preset, video.id)} className="group relative aspect-[4/5] overflow-hidden rounded-[20px] border border-white/10 bg-[#25242a] text-left transition hover:-translate-y-1 hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d8ff19]">
            {video.posterUrl ? <img src={video.posterUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : embed.kind === "file" ? <video src={embed.src} muted loop playsInline autoPlay preload="metadata" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,#9866bd70,transparent_55%),#222128]" />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" />
            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">Video preset</span>
            <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-1 font-display text-sm font-bold text-white sm:text-base"><span className="line-clamp-2">{preset.title}</span><ArrowUpRight size={17} className="shrink-0" /></span>
          </button>;
        })}
      </div>
    </section>
  );
}
