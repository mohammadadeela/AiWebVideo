import { useEffect, useState } from "react";
import { BadgePercent } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { PricingTable } from "@/components/landing/PricingTable";
import { fetchWelcomeGrowthOffer, formatWelcomeCountdown, type WelcomeGrowthOffer } from "@/lib/growth";
import { useSeo } from "@/lib/useSeo";

export function PricingPage() {
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useSeo({
    title: "AI Video, Product Media & Interior Design Pricing",
    description:
      "See credit-based pricing for website and AI videos, product images and videos, talking scenes, and interior design images or tours.",
    path: "/pricing",
  });

  useEffect(() => {
    let cancelled = false;
    fetchWelcomeGrowthOffer()
      .then((offer) => { if (!cancelled) setWelcomeOffer(offer); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!welcomeOffer?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [welcomeOffer?.active]);

  const offerActive = Boolean(
    welcomeOffer?.active &&
    welcomeOffer.discountPercent > 0 &&
    new Date(welcomeOffer.expiresAt).getTime() > now,
  );

  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-white/[.07]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <p className="text-sm font-medium text-violet">Pricing</p>
            <div className="mt-3 grid gap-7 lg:grid-cols-[1fr_.72fr] lg:items-end">
              <h1 className="max-w-[15ch] font-display text-4xl font-semibold leading-[1.02] tracking-[-.05em] text-white sm:text-5xl lg:text-6xl">
                Know the cost before you generate.
              </h1>
              <p className="max-w-xl text-sm leading-7 text-text-muted sm:text-base">
                Credits pay for generated media. The creator shows the exact production quote before the paid action, based on the real pricing configuration.
              </p>
            </div>

            {offerActive && welcomeOffer ? (
              <a
                href="#buy-credits"
                className="mt-8 flex max-w-3xl flex-col gap-2 border-y border-mint/25 bg-mint/[.035] px-1 py-4 transition hover:bg-mint/[.055] sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <BadgePercent size={18} className="shrink-0 text-mint" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{welcomeOffer.discountPercent}% off credit packs</span>
                    <span className="mt-0.5 block text-xs text-text-muted">Same credits, lower checkout price.</span>
                  </span>
                </span>
                <span className="font-mono text-xs font-semibold text-mint">
                  {formatWelcomeCountdown(welcomeOffer.expiresAt, now)}
                </span>
              </a>
            ) : null}

            <div className="mt-10">
              <PricingTable />
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07] bg-white/[.012]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.58fr_1.42fr] lg:gap-16">
              <div>
                <p className="text-sm font-medium text-violet">How credits work</p>
                <h2 className="mt-3 max-w-[13ch] font-display text-3xl font-semibold tracking-[-.04em] text-white">
                  Clear before you commit.
                </h2>
              </div>
              <div className="border-t border-white/[.09]">
                {[
                  ["Choose a balance", "Use the real credit packs or subscription options shown above."],
                  ["See the quote first", "Duration, output quality, production mode, and supported audio choices determine the production estimate."],
                  ["Keep failure handling", "When the existing paid-generation refund path applies, reserved credits are restored after an unfinished render."],
                ].map(([title, body], index) => (
                  <div key={title} className="grid gap-2 border-b border-white/[.09] py-5 sm:grid-cols-[44px_180px_1fr]">
                    <span className="font-mono text-xs text-text-dim">{String(index + 1).padStart(2, "0")}</span>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-sm leading-6 text-text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr] lg:gap-16">
              <div>
                <p className="text-sm font-medium text-violet">Billing questions</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-white">
                  Credits without guesswork.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-text-muted">
                  Insufficient balance becomes a clear next action before final generation instead of a hidden production failure.
                </p>
              </div>
              <div className="border-t border-white/[.09]">
                {[
                  [
                    "What changes the credit quote?",
                    "Generated duration, output quality, production mode, and narration options are reflected by the existing shared credit calculation.",
                  ],
                  [
                    "Can I preview before paying for a video?",
                    "The website workflow can prepare its capture and production plan before the paid final generation step.",
                  ],
                  [
                    "What if a paid generation fails?",
                    "The current production flow communicates the failure and restores reserved credits where the existing refund path applies.",
                  ],
                  [
                    "Where do I manage my plan?",
                    "Signed-in users can open the account center for balance and billing actions, or return here to compare current options.",
                  ],
                ].map(([question, answer]) => (
                  <details key={question} className="group border-b border-white/[.09] py-5">
                    <summary className="flex min-h-11 list-none items-center justify-between gap-5 text-[15px] font-semibold text-white">
                      <span>{question}</span>
                      <span aria-hidden="true" className="text-xl font-light text-text-dim transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="max-w-3xl pb-1 pr-10 text-sm leading-7 text-text-muted">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
