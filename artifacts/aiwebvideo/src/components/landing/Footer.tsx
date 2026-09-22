import { Link, useLocation } from "wouter";
import { SavedCardsPanel } from "@/components/account/SavedCardsPanel";
import { Wordmark } from "@/components/ui/Wordmark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export function Footer() {
  const [location] = useLocation();

  return (
    <>
      {location === "/profile" && <SavedCardsPanel />}
      <footer className="border-t border-white/[.06] bg-black/15">
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-16">
          <div className="mb-14 grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
            <div className="col-span-2 sm:col-span-1">
              <Wordmark />
              <p className="mt-4 max-w-[260px] text-xs leading-6 text-text-dim">
                Create AI video, product photos and videos, and interior design
                media from websites, ideas and your own references.
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
                <li><a href="/?create=scenario#generate" className="transition-colors hover:text-white">Talking video</a></li>
                <li><a href="/?create=interior#generate" className="transition-colors hover:text-white">Interior design</a></li>
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
              <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">Features</p>
              <ul className="space-y-3 text-xs text-text-muted">
                <li><Link href="/website-video-generator" className="transition-colors hover:text-white">Website video</Link></li>
                <li><Link href="/ai-video-generator" className="transition-colors hover:text-white">AI video generator</Link></li>
                <li><Link href="/product-photo-generator" className="transition-colors hover:text-white">Product photo generator</Link></li>
                <li><Link href="/product-video-generator" className="transition-colors hover:text-white">Product video generator</Link></li>
                <li><Link href="/talking-video-generator" className="transition-colors hover:text-white">Talking video generator</Link></li>
                <li><Link href="/ai-interior-design-generator" className="transition-colors hover:text-white">Interior design generator</Link></li>
                <li><Link href="/interior-design-walkthrough-video" className="transition-colors hover:text-white">Interior walkthrough</Link></li>
                <li><Link href="/features" className="transition-colors hover:text-white">All creation modes</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-4 font-utility text-[9px] uppercase tracking-[.18em] text-text-dim">
                Learn
              </p>
              <ul className="space-y-3 text-xs text-text-muted">
                <li><Link href="/url-to-video" className="transition-colors hover:text-white">URL to video</Link></li>
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
                <li><Link href="/guides/create-ai-video-from-prompt" className="transition-colors hover:text-white">AI video prompt guide</Link></li>
                <li><Link href="/guides/product-photos-and-videos-from-images" className="transition-colors hover:text-white">Product media guide</Link></li>
                <li><Link href="/guides/interior-design-from-photos-and-plans" className="transition-colors hover:text-white">Interior design guide</Link></li>
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
                <li>
                  <a href={SUPPORT_MAILTO} className="break-all transition-colors hover:text-white">
                    Support: {SUPPORT_EMAIL}
                  </a>
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
    </>
  );
}
