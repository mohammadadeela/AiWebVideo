import { Link, useLocation } from "wouter";
import { SavedCardsPanel } from "@/components/account/SavedCardsPanel";
import { Wordmark } from "@/components/ui/Wordmark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

const createLinks = [
  ["Website Video", "/?create=website#generate"],
  ["AI Video", "/?create=video#generate"],
  ["Product Images", "/?create=photo#generate"],
  ["Product Video", "/?create=product-video#generate"],
  ["Talking Scene", "/?create=scenario#generate"],
  ["Interior Design", "/?create=interior#generate"],
] as const;

const exploreLinks = [
  ["Examples", "/examples"],
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Features", "/features"],
  ["FAQ", "/faq"],
] as const;

const guideLinks = [
  ["Website to video", "/guides/turn-website-into-video"],
  ["AI video from prompt", "/guides/create-ai-video-from-prompt"],
  ["Product media", "/guides/product-photos-and-videos-from-images"],
  ["Interior design", "/guides/interior-design-from-photos-and-plans"],
] as const;

export function Footer() {
  const [location] = useLocation();

  return (
    <>
      {location === "/profile" ? <SavedCardsPanel /> : null}
      <footer className="border-t border-white/[.08] bg-[#08080a]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <Wordmark />
              <p className="mt-4 max-w-sm text-sm leading-7 text-text-muted">
                Create website videos, original AI video, product media, talking scenes, and interior design from your own sources.
              </p>
              <Link href="/dashboard" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-white transition hover:text-violet">
                Open workspace
              </Link>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Create</p>
              <ul className="mt-4 space-y-3">
                {createLinks.map(([label, href]) => (
                  <li key={href}><a href={href} className="text-sm text-text-muted transition hover:text-white">{label}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Explore</p>
              <ul className="mt-4 space-y-3">
                {exploreLinks.map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-sm text-text-muted transition hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-white">Guides & company</p>
              <ul className="mt-4 space-y-3">
                {guideLinks.map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-sm text-text-muted transition hover:text-white">{label}</Link></li>
                ))}
                <li><Link href="/about" className="text-sm text-text-muted transition hover:text-white">About</Link></li>
                <li><Link href="/privacy" className="text-sm text-text-muted transition hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="text-sm text-text-muted transition hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/[.08] pt-6 text-xs text-text-dim sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} AiWebVideo.</p>
            <a href={SUPPORT_MAILTO} className="transition hover:text-white">Support: {SUPPORT_EMAIL}</a>
          </div>
        </div>
      </footer>
    </>
  );
}
