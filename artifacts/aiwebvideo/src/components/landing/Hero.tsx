import { useEffect, useState } from "react";
import { Film, Globe2, House, Image as ImageIcon, MapPinned, MessageCircleMore, PackageOpen, ArrowUpRight } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CreativePresets } from "@/components/landing/CreativePresets";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { fetchMarketingSettings, type MarketingVideo } from "@/lib/api-client";

const tools = [
  { intent: "website", name: "Website Video", note: "Turn any URL into a cinematic campaign", Icon: Globe2, accent: "#75dcc9" },
  { intent: "video", name: "AI Video", note: "Direct an original scene from your prompt", Icon: Film, accent: "#b59aff" },
  { intent: "photo", name: "Product Photos", note: "Create campaign images from your real product", Icon: ImageIcon, accent: "#f3a9bd" },
  { intent: "product-video", name: "Product Video", note: "Turn a product reference into a moving commercial", Icon: PackageOpen, accent: "#eac68d" },
  { intent: "scenario", name: "Talking Person", note: "Create dialogue-led scenes with controlled direction", Icon: MessageCircleMore, accent: "#a7bdfa" },
  { intent: "interior", name: "Interior Design", note: "Redesign a real space while preserving its structure", Icon: House, accent: "#bdcba6" },
  { intent: "architecture", name: "Architecture Preview", note: "Design on a real site using Maps-grounded context", Icon: MapPinned, accent: "#8fd7c8" },
] as const;

function intentFromUrl(): CreationIntent {
  const candidate = new URLSearchParams(window.location.search).get("create");
  return tools.find((tool) => tool.intent === candidate)?.intent ?? "website";
}

export function Hero() {
  const [active, setActive] = useState<CreationIntent>(intentFromUrl);
  const [media, setMedia] = useState<MarketingVideo[]>([]);
  useEffect(() => {
    let mounted = true;
    void fetchMarketingSettings().then((settings) => {
      if (mounted) setMedia(settings.videos.showcase.filter((item) => item.url && item.templateMode && item.published !== false));
    }).catch(() => {});
    const onMode = (event: Event) => setActive((event as CustomEvent<CreationIntent>).detail);
    const onPop = () => setActive(intentFromUrl());
    window.addEventListener("aiwebvideo:creation-intent", onMode);
    window.addEventListener("popstate", onPop);
    return () => { mounted = false; window.removeEventListener("aiwebvideo:creation-intent", onMode); window.removeEventListener("popstate", onPop); };
  }, []);
  function select(intent: CreationIntent) {
    setActive(intent);
    window.history.replaceState({}, "", `/?create=${intent}#generate`);
    window.dispatchEvent(new CustomEvent("aiwebvideo:creation-intent", { detail: intent }));
    window.requestAnimationFrame(() => document.getElementById("workspace-creator")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }
  return <section id="generate" className="scroll-mt-20 bg-[#0d0b15]">
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-14 sm:px-5 sm:pt-20 lg:px-8">
      <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] font-semibold leading-[1.03] tracking-[-.055em] text-white">Make something worth showing.</h1>
      <p className="mt-3 text-sm text-white/55 sm:text-base">Pick a tool and start creating.</p>
      <div className="mt-9 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-7" role="tablist" aria-label="Creation tools">
        {tools.map(({ intent, name, note, Icon, accent }) => {
          const sample = intent === "architecture" ? undefined : media.find((item) => item.templateMode === intent);
          const selected = active === intent;
          return <button key={intent} type="button" role="tab" aria-selected={selected} onClick={() => select(intent)} className={`group relative flex min-h-[220px] flex-col overflow-hidden rounded-[24px] border p-4 text-left transition duration-200 hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 sm:min-h-[265px] ${selected ? "border-white/40 bg-[#201a2d] ring-1 ring-white/15" : "border-white/10 bg-[#171420] opacity-80 hover:border-white/25 hover:opacity-100"}`}>
            {sample && <div className="absolute inset-x-0 bottom-0 top-[44%] overflow-hidden"><div className="absolute inset-0 z-10 bg-gradient-to-t from-[#171420]/25 to-[#171420]" />{sample.kind === "image" ? <img src={sample.url ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" /> : <video src={sample.url ?? ""} poster={sample.posterUrl ?? undefined} muted playsInline loop autoPlay preload="metadata" aria-hidden="true" className="h-full w-full object-cover" />}</div>}
            <span className="relative z-10 grid h-10 w-10 place-items-center rounded-[14px] border border-white/10 bg-black/25" style={{ color: accent }}><Icon size={19} /></span>
            <span className="relative z-10 mt-4 text-[14px] font-semibold text-white">{name}</span>
            <span className="relative z-10 mt-1 text-xs text-white/55">{note}</span>
            <ArrowUpRight size={16} className="relative z-10 mt-auto self-end text-white/70 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>;
        })}
      </div>
      <div id="workspace-creator" className="mt-4 scroll-mt-24 rounded-[28px] border border-white/10 bg-[#14111e] p-3 sm:p-5">
        <div className="mb-3 flex items-center gap-2 px-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tools.find((tool) => tool.intent === active)?.accent }} /><span className="text-xs font-medium text-white/75">{tools.find((tool) => tool.intent === active)?.name}</span></div>
        <ChatWidget compactLanding className="w-full" resumeJobId={new URLSearchParams(window.location.search).get('job')} />
        <CreativePresets inWorkspace feature={active} />
      </div>
    </div>
  </section>;
}
