import { Link } from "wouter";
import { Wordmark } from "@/components/ui/Wordmark";

export function Footer() {
  return (
    <footer className="border-t border-white/[.06] bg-black/15">
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-16">
        <div className="mb-14 grid grid-cols-2 gap-10 sm:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <Wordmark />
            <p className="mt-4 max-w-[260px] text-xs leading-6 text-text-dim">
              AI-directed marketing production from websites, ideas and real
              product references—all inside one creative workspace.
            </p>
          </div>
          <div>
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">
              Create
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li>
                <a
                  href="/#generate"
                  className="transition-colors hover:text-white"
                >
                  Website video
                </a>
              </li>
              <li>
                <a
                  href="/?create=video#generate"
                  className="transition-colors hover:text-white"
                >
                  AI video
                </a>
              </li>
              <li>
                <a
                  href="/?create=photo#generate"
                  className="transition-colors hover:text-white"
                >
                  Product photos
                </a>
              </li>
              <li>
                <a
                  href="/?create=product-video#generate"
                  className="transition-colors hover:text-white"
                >
                  Product video
                </a>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-white"
                >
                  Workspace
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">
              Learn
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li><Link href="/url-to-video" className="transition-colors hover:text-white">URL to video</Link></li>
              <li><Link href="/website-video-generator" className="transition-colors hover:text-white">Website video generator</Link></li>
              <li><Link href="/saas-demo-video-generator" className="transition-colors hover:text-white">SaaS demo video</Link></li>
              <li><Link href="/product-page-to-video" className="transition-colors hover:text-white">Product page to video</Link></li>
              <li><Link href="/examples" className="transition-colors hover:text-white">Examples</Link></li>
              <li>
                <Link
                  href="/features"
                  className="transition-colors hover:text-white"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="transition-colors hover:text-white"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="transition-colors hover:text-white"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="transition-colors hover:text-white"
                >
                  Help & FAQ
                </Link>
              </li>
              <li><Link href="/guides/turn-website-into-video" className="transition-colors hover:text-white">Website video guide</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">
              Company
            </p>
            <ul className="space-y-3 text-xs text-text-muted">
              <li>
                <Link
                  href="/about"
                  className="transition-colors hover:text-white"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/profile"
                  className="transition-colors hover:text-white"
                >
                  Account
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-white"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="transition-colors hover:text-white"
                >
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 border-t border-white/[.06] pt-6 sm:flex-row sm:items-center">
          <p className="text-[10px] text-text-dim">
            © {new Date().getFullYear()} AiWebVideo. AI-directed from brief to
            final master.
          </p>
          <p className="font-utility text-[8px] uppercase tracking-[.18em] text-text-dim">
            Built for original AI production
          </p>
        </div>
      </div>
    </footer>
  );
}
