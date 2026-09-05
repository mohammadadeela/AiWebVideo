import { ArrowLeft, Film, Image, MessageCircleMore } from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useSeo } from "@/lib/useSeo";
import { STUDIO_CONFIGS, type StudioKind } from "@/lib/studioConfig";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";

const intentForKind: Record<StudioKind, CreationIntent> = {
  product: "photo",
  idea: "video",
  scenario: "scenario",
};

const iconForKind = {
  product: Image,
  idea: Film,
  scenario: MessageCircleMore,
} as const;

export function StudioPage({ kind }: { kind: StudioKind }) {
  const config = STUDIO_CONFIGS[kind];
  const Icon = iconForKind[kind];
  useSeo({
    title: config.seoTitle,
    description: config.seoDescription,
    path: config.path,
  });

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-bg">
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto max-w-7xl px-4 pb-5 pt-7 sm:px-5 sm:pb-9 sm:pt-14">
            <Link
              href="/#generate"
              className="inline-flex items-center gap-2 text-xs font-semibold text-text-dim transition hover:text-white"
            >
              <ArrowLeft size={14} /> Back to the unified creator
            </Link>
            <div className="mt-6 max-w-3xl">
              <div className="flex items-center gap-3 text-mint">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-mint/20 bg-mint/10">
                  <Icon size={19} />
                </span>
                <p className="font-utility text-[10px] uppercase tracking-[.2em]">
                  {config.eyebrow}
                </p>
              </div>
              <h1 className="mt-4 font-display text-[28px] font-bold leading-[1.02] tracking-[-.04em] text-white sm:text-5xl">
                {config.heading}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">
                {config.subheading}
              </p>
            </div>
          </div>
        </section>
        <section id="generate" className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-10">
          <ChatWidget
            initialCreationIntent={intentForKind[kind]}
            expandInitialPanel
            className="w-full"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
