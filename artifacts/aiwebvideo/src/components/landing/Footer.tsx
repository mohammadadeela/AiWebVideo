import { ArrowUpRight, Mail } from "lucide-react";
import { Link } from "wouter";
import { Wordmark } from "@/components/ui/Wordmark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

const linkClass = "transition-colors hover:text-white";

export function Footer() {
  return (
    <footer className="border-t border-white/[.06] bg-black/15">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:pt-14">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))] lg:gap-x-8">
          <div className="col-span-2 border-b border-white/[.06] pb-8 md:col-span-4 lg:col-span-1 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
            <Wordmark />
            <p className="mt-4 max-w-[280px] text-xs leading-6 text-text-dim">
              AI-directed marketing production from websites, original ideas,
              and real product references.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border border-violet/25 bg-violet/10 px-3.5 py-2.5 text-[11px] font-semibold text-violet transition hover:border-violet/40 hover:bg-violet/15"
            >
              Open workspace <ArrowUpRight size={13} />
            </Link>
          </div>

          <nav aria-label="Create">
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-violet">
              Create
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li><a href="/#generate" className={linkClass}>Website video</a></li>
              <li><a href="/?create=video#generate" className={linkClass}>AI video</a></li>
              <li><a href="/?create=photo#generate" className={linkClass}>Product photos</a></li>
              <li><a href="/?create=product-video#generate" className={linkClass}>Product video</a></li>
              <li><a href="/?create=scenario#generate" className={linkClass}>Talking scene</a></li>
            </ul>
          </nav>

          <nav aria-label="Solutions">
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-violet">
              Solutions
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li><Link href="/url-to-video" className={linkClass}>URL to video</Link></li>
              <li><Link href="/website-video-generator" className={linkClass}>Website generator</Link></li>
              <li><Link href="/saas-demo-video-generator" className={linkClass}>SaaS demo video</Link></li>
              <li><Link href="/product-page-to-video" className={linkClass}>Product page video</Link></li>
            </ul>
          </nav>

          <nav aria-label="Resources">
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-violet">
              Resources
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li><Link href="/features" className={linkClass}>Features</Link></li>
              <li><Link href="/how-it-works" className={linkClass}>How it works</Link></li>
              <li><Link href="/examples" className={linkClass}>Examples</Link></li>
              <li><Link href="/pricing" className={linkClass}>Pricing</Link></li>
              <li><Link href="/faq" className={linkClass}>Help &amp; FAQ</Link></li>
              <li><Link href="/guides/turn-website-into-video" className={linkClass}>Website video guide</Link></li>
            </ul>
          </nav>

          <nav aria-label="Company">
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-violet">
              Company
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li><Link href="/about" className={linkClass}>About</Link></li>
              <li><Link href="/profile" className={linkClass}>Account</Link></li>
              <li><Link href="/privacy" className={linkClass}>Privacy</Link></li>
              <li><Link href="/terms" className={linkClass}>Terms</Link></li>
            </ul>
          </nav>

          <section className="col-span-2 md:col-span-1" aria-labelledby="footer-support-heading">
            <p id="footer-support-heading" className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-violet">
              Support
            </p>
            <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
                <Mail size={15} />
              </span>
              <p className="mt-3 text-[11px] font-semibold text-text-primary">Need help?</p>
              <p className="mt-1 text-[10px] leading-4 text-text-dim">Account, billing, or production support.</p>
              <a href={SUPPORT_MAILTO} className="mt-3 block break-all text-[11px] font-semibold text-violet transition-colors hover:text-white">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </section>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/[.06] pt-6 sm:flex-row sm:items-center">
          <p className="text-[10px] text-text-dim">
            © {new Date().getFullYear()} AiWebVideo. All rights reserved.
          </p>
          <p className="font-utility text-[8px] uppercase tracking-[.18em] text-text-dim">
            From brief to final master
          </p>
        </div>
      </div>
    </footer>
  );
}
