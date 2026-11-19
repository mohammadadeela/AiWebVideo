import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Wordmark } from "@/components/ui/Wordmark";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu } from "@/components/account/UserMenu";
import { CreditPill } from "@/components/account/CreditPill";
import { fetchMe } from "@/lib/api-client";
import { watchAuthState } from "@/lib/firebase/client";
import { resolveDashboardDestination } from "@/lib/guestSession";
import { BRAND } from "@/lib/brand";

interface Me {
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
}

const linkClass = "inline-flex h-10 items-center rounded-full px-3.5 text-[14px] font-medium text-text-muted transition hover:bg-white/[.06] hover:text-white";

/** The public header: the mark, two links, and the way in. Nothing else competes with the composer. */
export function Nav() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  // If the sign-in check is slow (restricted in-app browsers), show the buttons anyway instead of placeholders
  // with no way in.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setWaited(true), 2500); return () => window.clearTimeout(timer); }, []);
  const openAuth = (mode: "signin" | "signup") => { setAuthMode(mode); setShowAuthModal(true); };
  const [scrolled, setScrolled] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [, navigate] = useLocation();

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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`sticky top-0 z-50 border-b bg-bg/85 backdrop-blur-xl transition-colors ${scrolled ? "border-white/[.08]" : "border-transparent"}`}>
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-5" aria-label="Main navigation">
          <Link href="/" className="rounded-xl" aria-label={`${BRAND.name} home`}>
            <Wordmark />
          </Link>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link href="/examples" className={`${linkClass} max-sm:hidden`}>Examples</Link>
            <Link href="/pricing" className={`${linkClass} max-[359px]:hidden`}>Pricing</Link>

            {!authChecked && !waited ? (
              <span className="ml-1 h-10 w-24 animate-pulse rounded-full bg-white/[.06]" aria-label="Checking account" />
            ) : authChecked && isSignedIn ? (
              <>
                {me && <CreditPill balance={me.creditsBalance} className="max-sm:hidden" />}
                <Link href="/dashboard" className="ml-1 inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-bg transition hover:bg-white/90">
                  Open app
                </Link>
                {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
              </>
            ) : (
              <>
                <button type="button" onClick={() => openAuth("signin")} className={linkClass}>Log in</button>
                <button
                  type="button"
                  onClick={() => openAuth("signup")}
                  className="ml-1 inline-flex h-10 items-center rounded-full bg-white px-4 text-[14px] font-semibold text-bg transition hover:bg-white/90"
                >
                  Start free
                </button>
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
