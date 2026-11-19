import { Link } from "wouter";
import { Wordmark } from "@/components/ui/Wordmark";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { BRAND } from "@/lib/brand";
import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";

// Every public page is one click from every other page: this is also the site's internal link map for search engines.
const COLUMNS: ReadonlyArray<{ title: string; links: ReadonlyArray<readonly [string, string]> }> = [
  {
    title: "Make",
    links: [
      ["/website-video-generator", "Website video"],
      ["/product-video-generator", "Product video"],
      ["/product-photo-generator", "Product photos"],
      ["/ai-video-generator", "AI video"],
      ["/talking-video-generator", "Talking video"],
      ["/ai-interior-design-generator", "Interior design"],
      ["/ai-architectural-visualization", "Architecture"],
    ],
  },
  {
    title: "Use it for",
    links: [
      ["/url-to-video", "URL to video"],
      ["/product-page-to-video", "Product link to video"],
      ["/saas-demo-video-generator", "SaaS demo video"],
      ["/real-estate-walkthrough-video", "Real estate walkthrough"],
      ["/interior-design-walkthrough-video", "Interior walkthrough"],
      ["/architecture-site-placement", "Building on a real site"],
      ["/floor-plan-to-3d", "Floor plan to 3D"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["/examples", "Examples"],
      ["/how-it-works", "How it works"],
      ["/guides/turn-website-into-video", "Website video guide"],
      ["/guides/product-page-video-ads", "Product ad guide"],
      ["/guides/create-ai-video-from-prompt", "Prompt guide"],
      ["/faq", "Questions"],
    ],
  },
  {
    title: "Company",
    links: [
      ["/pricing", "Pricing"],
      ["/about", "About"],
      ["/privacy", "Privacy"],
      ["/terms", "Terms"],
    ],
  },
];

export function Footer() {
  const theme = useTheme();
  return (
    <footer className="border-t border-white/[.07]">
      <div className="mx-auto max-w-6xl px-5 pb-10 pt-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label={`${BRAND.name} home`}><Wordmark /></Link>
            <p className="mt-4 max-w-[26ch] text-[14px] leading-6 text-text-dim">{BRAND.tagline}</p>
            <a href={SUPPORT_MAILTO} className="mt-4 inline-block text-[14px] text-text-muted transition hover:text-white">{SUPPORT_EMAIL}</a>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[13px] font-semibold text-white">{column.title}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="text-[14px] text-text-dim transition hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/[.07] pt-6">
          <p className="text-[13px] text-text-dim">© {new Date().getFullYear()} {BRAND.name}, formerly {BRAND.formerName}.</p>
          <button type="button" className="theme-switch" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </footer>
  );
}
