import { ArrowRight, Film, Globe2, House, Image as ImageIcon, MessageCircleMore, PackageOpen } from "lucide-react";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";

const modes = [
  { intent: "website", title: "Website video", source: "From a URL", detail: "Turn your live website into a campaign film.", path: "/website-video-generator", icon: Globe2, accent: "text-mint", glow: "from-mint/[.09]" },
  { intent: "video", title: "AI video", source: "From an idea", detail: "Direct an original video with a prompt and optional images.", path: "/ai-video-generator", icon: Film, accent: "text-violet", glow: "from-violet/[.12]" },
  { intent: "photo", title: "Product photos", source: "From your product", detail: "Create campaign images using real product references.", path: "/product-photo-generator", icon: ImageIcon, accent: "text-pink", glow: "from-pink/[.09]" },
  { intent: "product-video", title: "Product video", source: "From your product", detail: "Bring product images into motion.", path: "/product-video-generator", icon: PackageOpen, accent: "text-gold", glow: "from-gold/[.09]" },
  { intent: "scenario", title: "Talking scenes", source: "From a script", detail: "Set the scene, dialogue, and camera direction.", path: "/talking-video-generator", icon: MessageCircleMore, accent: "text-mint", glow: "from-mint/[.09]" },
  { intent: "interior", title: "Interior design", source: "From your space", detail: "Use room photos, plans, and measurements for designs or a walkthrough.", path: "/ai-interior-design-generator", icon: House, accent: "text-violet", glow: "from-violet/[.12]" },
] as const;

function selectMode(intent: CreationIntent) {
  window.history.replaceState({}, "", `/?create=${intent}#generate`);
  window.dispatchEvent(new CustomEvent<CreationIntent>("aiwebvideo:creation-intent", { detail: intent }));
  document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CreationModes() {
  return (
    <section id="modes" className="scroll-mt-20 border-b border-white/[.06]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16">
        <div className="max-w-2xl">
          <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">Explore the studio</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">What will you make?</h2>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map(({ intent, title, source, path, icon: Icon, accent, glow }) => (
            <article key={intent} className={`group relative flex min-h-[160px] flex-col overflow-hidden rounded-[22px] border border-white/[.09] bg-gradient-to-br ${glow} to-panel p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 focus-within:border-white/25`}>
              <div className="flex items-start justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 ${accent}`}><Icon size={19} /></span>
                <span className="font-utility text-[9px] uppercase tracking-[.12em] text-text-dim">{source}</span>
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold tracking-[-.025em] text-white">{title}</h3>
              <div className="mt-auto flex items-center gap-5 pt-3">
                <button type="button" onClick={() => selectMode(intent)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-xs font-semibold text-white transition hover:text-mint focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">Create <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></button>
                <a href={path} className="inline-flex min-h-10 items-center text-xs text-text-muted underline decoration-white/30 underline-offset-4 transition hover:text-white">Learn more</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MoreCreationModes({ currentIntent }: { currentIntent: CreationIntent }) {
  return (
    <section className="border-b border-white/[.06] bg-black/10" aria-labelledby="more-creation-modes">
      <div className="mx-auto max-w-6xl px-5 py-9 sm:py-11">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="more-creation-modes" className="font-display text-xl font-semibold tracking-[-.03em] text-white sm:text-2xl">More ways to create</h2>
          <a href="/#modes" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-white">All modes <ArrowRight size={13} /></a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {modes.filter(({ intent }) => intent !== currentIntent).map(({ title, path, icon: Icon, accent }) => (
            <a key={path} href={path} className="group flex min-h-[68px] items-center gap-2.5 rounded-xl border border-white/[.09] bg-white/[.025] px-3 py-3 transition hover:border-white/25 hover:bg-white/[.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">
              <Icon size={16} className={`shrink-0 ${accent}`} />
              <span className="text-xs font-semibold text-white">{title}</span>
              <ArrowRight size={12} className="ml-auto shrink-0 text-text-dim transition group-hover:translate-x-0.5" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
