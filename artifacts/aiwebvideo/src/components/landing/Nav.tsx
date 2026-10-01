import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BadgeDollarSign, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/ui/Wordmark";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
import { UserMenu, formatCredits } from "@/components/account/UserMenu";
import { fetchMe } from "@/lib/api-client";
import { watchAuthState } from "@/lib/firebase/client";

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
  const [scrolled, setScrolled] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

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
            <Wordmark />
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/pricing"
              aria-label="Pricing"
              className="cinematic-nav-pill group inline-flex h-10 items-center gap-2 rounded-xl border border-white/[.10] bg-white/[.045] px-2.5 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-violet/40 hover:bg-violet/[.10] hover:text-white sm:px-3"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-[linear-gradient(135deg,rgba(52,217,196,.16),rgba(139,92,246,.22),rgba(236,72,153,.16))] text-mint">
                <BadgeDollarSign size={14} />
              </span>
              <span className="hidden text-[11px] font-semibold sm:inline">Pricing</span>
            </Link>

            {!authChecked ? (
              <div className="flex items-center gap-2" aria-label="Checking account">
                <span className="hidden h-10 w-24 animate-pulse rounded-xl bg-white/[.045] sm:block" />
                <span className="h-10 w-10 animate-pulse rounded-xl bg-white/[.065]" />
              </div>
            ) : isSignedIn ? (
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
                <Button className="hidden sm:inline-flex" variant="ghost" size="sm" onClick={() => setShowAuthModal(true)}>
                  Log in
                </Button>
                <Button variant="primary" size="sm" className="px-3 text-xs" asChild>
                  <a href="/#generate" className="inline-flex">Start creating</a>
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </>
  );
}
