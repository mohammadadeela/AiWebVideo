import {
  ArrowRight,
  Film,
  Globe2,
  Image,
  MessageCircleMore,
  PackageOpen,
} from "lucide-react";
import { Link } from "wouter";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/app-button";
import { useSeo } from "@/lib/useSeo";

const modes = [
  {
    href: "/?create=website#generate",
    label: "Website Video",
    detail: "Paste a URL and turn the business into a directed campaign.",
    meta: "URL → campaign",
    Icon: Globe2,
  },
  {
    href: "/?create=video#generate",
    label: "AI Video",
    detail: "Describe an original concept and generate it as a video production.",
    meta: "Idea → film",
    Icon: Film,
  },
  {
    href: "/?create=photo#generate",
    label: "Product Photos",
    detail: "Upload real product references and art-direct a marketing image set.",
    meta: "References → photos",
    Icon: Image,
  },
  {
    href: "/?create=product-video#generate",
    label: "Product Video",
    detail: "Use product references as grounding for a generated campaign film.",
    meta: "References → film",
    Icon: PackageOpen,
  },
  {
    href: "/?create=scenario#generate",
    label: "Talking Scene",
    detail: "Create dialogue-driven or performance-led video with scene audio.",
    meta: "Dialogue → scene",
    Icon: MessageCircleMore,
  },
] as const;

export function StudioIndexPage() {
  useSeo({
    title: "AI Video and Photo Creator",
    description:
      "Use one AiWebVideo creator for website campaigns, original AI video, product photos, product video, and talking scenes.",
    path: "/studio",
  });

  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">
              Unified creator
            </p>
            <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_.7fr] lg:items-end">
              <div>
                <h1 className="max-w-4xl font-display text-4xl font-bold leading-[.98] tracking-[-.05em] text-white sm:text-6xl">
                  One creative workspace. Five ways to begin.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">
                  These are not separate products. Each entry configures the
                  same AiWebVideo creation experience with the right inputs and
                  production mode already selected.
                </p>
              </div>
              <div className="lg:text-right">
                <Button variant="primary" asChild><Link href="/?create=website#generate">Open unified creator</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <div className="overflow-hidden rounded-3xl border border-border bg-panel/60">
            {modes.map(({ href, label, detail, meta, Icon }, index) => (
              <Link
                key={label}
                href={href}
                className={`group grid min-h-28 gap-4 p-5 transition hover:bg-white/[.035] sm:grid-cols-[52px_1fr_auto] sm:items-center sm:p-6 ${index ? "border-t border-border" : ""}`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet/25 bg-violet/10 text-violet transition group-hover:border-mint/30 group-hover:text-mint">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-lg font-semibold text-text-primary">{label}</span>
                    <span className="font-utility text-[9px] uppercase tracking-[.12em] text-text-dim">{meta}</span>
                  </span>
                  <span className="mt-1 block max-w-2xl text-sm leading-6 text-text-muted">{detail}</span>
                </span>
                <span className="hidden items-center gap-2 text-xs font-semibold text-text-primary transition group-hover:text-mint sm:flex">
                  Configure creator <ArrowRight size={14} aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-col justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
            <p className="max-w-2xl text-xs leading-5 text-text-muted">
              Existing `/studio/*` links remain available for compatibility,
              but creation is presented through the same composer, chat,
              progress and results system.
            </p>
            <Link href="/dashboard" className="text-xs font-semibold text-violet transition hover:text-mint">
              Already signed in? Open workspace
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
