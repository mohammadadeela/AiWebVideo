import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  Film,
  Globe2,
  Image as ImageIcon,
  Menu,
  MessageCircleMore,
  PackageOpen,
  ShieldCheck,
  X,
} from "lucide-react";
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

function ArrowRightIcon() {
  return <span aria-hidden="true" className="shrink-0 text-base leading-none text-text-dim">›</span>;
}

const productItems = [
  ["Website to Video", "Website-aware campaign direction", "/?create=website#generate", Globe2],
  ["AI Video", "Generate from an original idea", "/?create=video#generate", Film],
  ["Product Photos", "Campaign images from real references", "/?create=photo#generate", ImageIcon],
  ["Product Video", "Generated product film from references", "/?create=product-video#generate", PackageOpen],
  ["Talking Scenes", "Dialogue and scenario-driven video", "/?create=scenario#generate", MessageCircleMore],
] as const;

export function Nav() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [location, navigate] = useLocation();
  const productRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(
    () =>
      watchAuthState((user) => {
        setIsSignedIn(!!user);
        setAuthChecked(true);
        if (user) {
          void fetchMe().then(setMe).catch(() => setMe(null));
        } else {
          setMe(null);
        }
      }),
    [],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProductOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const focusTimer = window.setTimeout(() => mobileCloseRef.current?.focus({ preventScroll: true }), 30);
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = previous;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.setTimeout(() => mobileTriggerRef.current?.focus({ preventScroll: true }), 0);
    };
  }, [mobileOpen]);

  function handleCreatorNavigation(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (window.location.pathname !== "/") return;
    const target = new URL(href, window.location.origin);
    if (target.pathname !== "/") return;

    const requested = target.searchParams.get("create");
    const intent =
      requested === "video" || requested === "photo" || requested === "product-video" || requested === "scenario" || requested === "website"
        ? requested
        : "website";

    event.preventDefault();
    window.history.pushState({}, "", `${target.pathname}${target.search}${target.hash}`);
    window.dispatchEvent(new CustomEvent("aiwebvideo:creation-intent", { detail: intent }));
    setProductOpen(false);
    setMobileOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(event.target as Node)) setProductOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className={`sticky top-0 z-50 border-b transition-all duration-200 ${scrolled || mobileOpen ? "border-white/[.08] bg-bg/95 shadow-[0_12px_40px_-28px_rgba(0,0,0,.9)] backdrop-blur-xl" : "border-transparent bg-bg/75 backdrop-blur-lg"}`}>
      <nav className="mx-auto flex max-w-[1500px] items-center justify-between px-3 py-2.5 sm:px-5 sm:py-3.5 lg:px-8" aria-label="Main navigation">
        <Link href="/" className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet" aria-label="AiWebVideo home">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <div ref={productRef} className="relative">
            <button
              type="button"
              onClick={() => setProductOpen((value) => !value)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white"
              aria-expanded={productOpen}
              aria-haspopup="menu"
            >
              Create <ChevronDown size={13} className={`transition ${productOpen ? "rotate-180" : ""}`} />
            </button>
            {productOpen && (
              <div role="menu" aria-label="Product creation modes" className="absolute left-0 top-12 w-[390px] overflow-hidden rounded-2xl border border-white/10 bg-[#151027]/98 p-2 shadow-[0_24px_70px_-28px_rgba(0,0,0,.95)] backdrop-blur-xl">
                <div className="px-3 pb-2 pt-2">
                  <p className="font-utility text-[8px] uppercase tracking-[.16em] text-text-dim">Choose what to create</p>
                </div>
                {productItems.map(([label, helper, href, Icon]) => (
                  <Link key={label} href={href} onClick={(event) => handleCreatorNavigation(event, href)} role="menuitem" className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/[.055]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.035] text-violet transition group-hover:border-mint/25 group-hover:text-mint">
                      <Icon size={16} />
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-white">{label}</span>
                      <span className="mt-0.5 block text-[10px] text-text-dim">{helper}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link href="/examples" className="inline-flex min-h-11 items-center rounded-xl px-3.5 text-xs font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">Examples</Link>
          <Link href="/how-it-works" className="inline-flex min-h-11 items-center rounded-xl px-3.5 text-xs font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">How it works</Link>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-xl px-3.5 text-xs font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">Pricing</Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!authChecked ? (
            <div className="hidden h-10 w-[210px] items-center justify-end gap-2 sm:flex" aria-label="Checking account">
              <span className="h-9 w-20 animate-pulse rounded-xl bg-white/[.045]" />
              <span className="h-9 w-28 animate-pulse rounded-xl bg-white/[.065]" />
            </div>
          ) : isSignedIn ? (
            <>
              <Link href="/pricing" className="hidden rounded-full border border-white/[.08] bg-white/[.03] px-3 py-2 font-utility text-[9px] text-text-muted transition hover:text-white lg:block">
                {formatCredits(me?.creditsBalance)} credits
              </Link>
              {me?.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-violet/30 bg-[linear-gradient(135deg,rgba(139,92,246,.18),rgba(236,72,153,.10))] px-3.5 text-[11px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_12px_28px_-22px_rgba(139,92,246,.75)] transition hover:-translate-y-0.5 hover:border-violet/45 hover:bg-[linear-gradient(135deg,rgba(139,92,246,.24),rgba(236,72,153,.14))] xl:inline-flex"
                >
                  <ShieldCheck size={15} className="shrink-0 text-violet" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/dashboard"
                className="hidden h-10 min-w-[112px] items-center justify-center whitespace-nowrap rounded-xl bg-signature px-4 text-xs font-bold text-white shadow-[0_14px_30px_-20px_rgba(236,72,153,.75)] transition hover:-translate-y-0.5 hover:brightness-110 sm:inline-flex"
              >
                Workspace
              </Link>
              {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
            </>
          ) : (
            <>
              <Button className="hidden sm:inline-flex" variant="ghost" size="sm" onClick={() => setShowAuthModal(true)}>Log in</Button>
              <Button variant="primary" size="sm" className="px-3 text-xs" asChild><a href="/#generate" className="hidden sm:inline-flex">Start creating</a></Button>
            </>
          )}
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.10] bg-white/[.045] text-white shadow-[0_8px_24px_-18px_rgba(0,0,0,.9)] transition active:scale-95 md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-panel"
          >
            {mobileOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </nav>

      {portalReady && mobileOpen && createPortal(
        <div className="fixed inset-0 z-[10000] md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[#05030b]/55 backdrop-blur-[2px]"
          />

          <section
            id="mobile-navigation-panel"
            className="absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+4.1rem)] flex max-h-[calc(100dvh-env(safe-area-inset-top)-5rem)] flex-col overflow-hidden rounded-[24px] border border-white/[.11] bg-[#120d25]/[.98] shadow-[0_28px_80px_-30px_rgba(0,0,0,.95)] backdrop-blur-2xl sm:left-auto sm:right-4 sm:w-[380px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/[.07] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Create with AiWebVideo</p>
                <p className="mt-0.5 text-[9px] text-text-dim">Choose a tool or continue to another page</p>
              </div>
              <button
                ref={mobileCloseRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.05] text-white transition active:scale-95"
                aria-label="Close navigation"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Link
                href={productItems[0][2]}
                onClick={(event) => handleCreatorNavigation(event, productItems[0][2])}
                className="group mb-2.5 flex min-h-[58px] items-center gap-3 rounded-2xl border border-mint/20 bg-[linear-gradient(135deg,rgba(45,212,191,.12),rgba(139,92,246,.08))] px-3 py-2.5 transition active:scale-[.985]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mint/20 bg-mint/10 text-mint"><Globe2 size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-white">Website to Video</span>
                  <span className="mt-0.5 block truncate text-[9px] text-text-dim">Paste a URL and turn the site into a campaign</span>
                </span>
                <ArrowRightIcon />
              </Link>

              <div className="grid grid-cols-2 gap-2">
                {productItems.slice(1).map(([label, , href, Icon]) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={(event) => handleCreatorNavigation(event, href)}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border border-white/[.07] bg-white/[.025] px-3 py-2 transition active:scale-[.985] active:bg-white/[.055]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.035] text-violet"><Icon size={14} /></span>
                    <span className="min-w-0 truncate text-[11px] font-semibold text-white">{label}</span>
                  </Link>
                ))}
              </div>

              <div className="my-3 h-px bg-white/[.07]" />
              <div className="grid grid-cols-3 gap-2">
                <Link href="/examples" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center justify-center rounded-xl border border-white/[.06] bg-white/[.02] px-2 text-center text-[10px] font-medium text-text-muted transition active:bg-white/[.05] active:text-white">Examples</Link>
                <Link href="/how-it-works" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center justify-center rounded-xl border border-white/[.06] bg-white/[.02] px-2 text-center text-[10px] font-medium text-text-muted transition active:bg-white/[.05] active:text-white">How it works</Link>
                <Link href="/pricing" onClick={() => setMobileOpen(false)} className="flex min-h-10 items-center justify-center rounded-xl border border-white/[.06] bg-white/[.02] px-2 text-center text-[10px] font-medium text-text-muted transition active:bg-white/[.05] active:text-white">Pricing</Link>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/[.07] bg-black/10 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
              {!authChecked ? (
                <div className="grid grid-cols-2 gap-2" aria-label="Checking account">
                  <span className="min-h-11 animate-pulse rounded-xl bg-white/[.045]" />
                  <span className="min-h-11 animate-pulse rounded-xl bg-white/[.065]" />
                </div>
              ) : isSignedIn ? (
                <div className="flex items-center gap-2">
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-signature px-4 text-xs font-bold text-white shadow-[0_14px_28px_-20px_rgba(236,72,153,.72)]">Workspace</Link>
                  <Link href="/pricing" onClick={() => setMobileOpen(false)} className="flex min-h-11 min-w-[96px] items-center justify-center rounded-xl border border-white/[.08] bg-white/[.025] px-3 font-utility text-[9px] font-semibold text-mint">{formatCredits(me?.creditsBalance)} credits</Link>
                  {me?.isAdmin && (
                    <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet/25 bg-violet/10 text-violet" aria-label="Admin"><ShieldCheck size={15} /></Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="md" onClick={() => { setMobileOpen(false); setShowAuthModal(true); }}>Log in</Button>
                  <Button className="w-full" variant="primary" size="md" asChild><a href="/#generate" onClick={() => setMobileOpen(false)}>Start creating</a></Button>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignedIn={() => {
            setShowAuthModal(false);
            navigate(resolveDashboardDestination());
          }}
        />
      )}
    </header>
  );
}
