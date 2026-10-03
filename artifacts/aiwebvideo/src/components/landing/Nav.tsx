import { FeatureDropdown, FeaturePills } from "./FeatureMenu";
import type { CreationIntent } from "@/lib/creationFeatures";
import { requestCreationMode } from "@/lib/creationMode";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { BadgeDollarSign, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu, formatCredits } from "@/components/account/UserMenu";
import { fetchMe } from "@/lib/api-client";
import { watchAuthState } from "@/lib/firebase/client";
import { resolveDashboardDestination } from "@/lib/guestSession";

interface Me {
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
}

export function Nav() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  // If the sign-in check is slow (restricted in-app browsers), show the buttons anyway instead of grey placeholders
  // with no way in.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setWaited(true), 2500); return () => window.clearTimeout(timer); }, []);
  const openAuth = (mode: 'signin' | 'signup') => { setAuthMode(mode); setShowAuthModal(true); };
  const [scrolled, setScrolled] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [location, navigate] = useLocation();

  /** Opens a feature. On the home page it switches the chat box right there; from any other page it goes home to it. */
  function pickFeature(intent: CreationIntent) {
    if (location === "/") {
      requestCreationMode(intent);
      document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(`/?create=${intent}#generate`);
    }
  }

  useEffect(
    () =>
      watchAuthState((user) => {
        setIsSignedIn(Boolean(user));
        setAuthChecked(true);
        if (user) void fetchMe().then(setMe).catch(() => setMe(null));
        else setMe(null);
      }),
    [],
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-50 border-b transition-all duration-300 ${scrolled ? "border-white/[.09] bg-[#070511]/78 shadow-[0_18px_55px_-36px_rgba(79,70,229,.9)] backdrop-blur-2xl" : "border-transparent bg-[#080512]/28 backdrop-blur-xl"}`}>
        <nav className="mx-auto flex max-w-[1500px] items-center justify-between px-3 py-2.5 sm:px-5 sm:py-3 lg:px-8" aria-label="Main navigation">
          <Link href="/" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet" aria-label="AiWebVideo home">
            <Wordmark className="max-[359px]:[&>span:last-child]:hidden" />
          </Link>

          <FeaturePills onPick={pickFeature} />

          <div className="flex items-center gap-1.5 max-[419px]:gap-0.5 sm:gap-2.5">
            <FeatureDropdown onPick={pickFeature} />
            <Link
              href="/pricing"
              aria-label="Pricing"
              className="cinematic-nav-pill group inline-flex h-11 items-center gap-2 rounded-xl max-[479px]:hidden border border-white/[.10] bg-white/[.045] px-2.5 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet/40 hover:bg-violet/[.10] hover:text-white sm:px-3"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-[linear-gradient(135deg,rgba(52,217,196,.16),rgba(139,92,246,.22),rgba(236,72,153,.16))] text-mint">
                <BadgeDollarSign size={14} />
              </span>
              <span className="hidden text-[11px] font-semibold sm:inline">Pricing</span>
            </Link>

            {!authChecked && !waited ? (
              <div className="flex items-center gap-2" aria-label="Checking account">
                <span className="hidden h-10 w-24 animate-pulse rounded-xl bg-white/[.045] sm:block" />
                <span className="h-10 w-10 animate-pulse rounded-xl bg-white/[.065]" />
              </div>
            ) : authChecked && isSignedIn ? (
              <>
                <Link
                  href="/pricing"
                  className="hidden rounded-full border border-white/[.09] bg-black/20 px-3 py-2 font-utility text-[9px] text-white/60 transition hover:border-mint/25 hover:text-mint lg:block"
                >
                  {formatCredits(me?.creditsBalance)} credits
                </Link>
                {me?.isAdmin && (
                  <Link
                    href="/admin"
                    className="hidden h-10 items-center justify-center gap-2 rounded-xl border border-violet/30 bg-violet/[.10] px-3 text-[11px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-violet/[.16] xl:inline-flex"
                  >
                    <ShieldCheck size={15} className="text-violet" />
                    Admin
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="hidden h-10 min-w-[112px] items-center justify-center rounded-xl bg-signature px-4 text-xs font-bold text-white shadow-[0_12px_34px_-16px_rgba(236,72,153,.78)] transition hover:-translate-y-0.5 hover:brightness-110 sm:inline-flex"
                >
                  Workspace
                </Link>
                {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
              </>
            ) : (
              <>
                <Button className="min-h-11 shrink-0 whitespace-nowrap max-[419px]:px-1.5" variant="ghost" size="sm" onClick={() => openAuth('signin')}>
                  Log in
                </Button>
                {/* Phones: a clear way to REGISTER (the "Start creating" button below is hidden on small screens). */}
                <span className="sm:hidden">
                  <Button className="min-h-11 shrink-0 whitespace-nowrap px-3 text-xs max-[419px]:px-2" variant="primary" size="sm" onClick={() => openAuth('signup')}>
                    Sign up
                  </Button>
                </span>
                <span className="hidden sm:inline-flex">
                  <Button variant="primary" size="sm" className="px-3 text-xs" asChild>
                    <a href="/#generate">Start creating</a>
                  </Button>
                </span>
              </>
            )}
          </div>
        </nav>
      </header>

      {showAuthModal && (
        <AuthModal
          key={authMode}
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSignedIn={() => {
            setShowAuthModal(false);
            navigate(resolveDashboardDestination());
          }}
        />
      )}
    </>
  );
}
