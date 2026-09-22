import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import {
  ChevronDown,
  Film,
  Globe2,
  House,
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

const productItems = [
  ["Website Video", "Use a live website as the source", "/?create=website#generate", Globe2],
  ["AI Video", "Create from a prompt or references", "/?create=video#generate", Film],
  ["Product Images", "Create campaign images from product photos", "/?create=photo#generate", ImageIcon],
  ["Product Video", "Turn product references into motion", "/?create=product-video#generate", PackageOpen],
  ["Talking Scene", "Direct dialogue and scenario video", "/?create=scenario#generate", MessageCircleMore],
  ["Interior Design", "Redesign spaces or create walkthroughs", "/?create=interior#generate", House],
] as const;

export function Nav() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [location, navigate] = useLocation();
  const productRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProductOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => mobileCloseRef.current?.focus({ preventScroll: true }), 20);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => mobileTriggerRef.current?.focus({ preventScroll: true }), 0);
    };
  }, [mobileOpen]);

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

  function handleCreatorNavigation(event: ReactMouseEvent<HTMLAnchorElement>, href: string) {
    if (window.location.pathname !== "/") return;
    const target = new URL(href, window.location.origin);
    if (target.pathname !== "/") return;

    const requested = target.searchParams.get("create");
    const intent =
      requested === "video" ||
      requested === "photo" ||
      requested === "product-video" ||
      requested === "scenario" ||
      requested === "interior" ||
      requested === "website"
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

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled || mobileOpen ? "border-white/[.08] bg-bg/95 backdrop-blur-xl" : "border-transparent bg-bg/80 backdrop-blur-lg"
      }`}
    >
      <nav className="mx-auto flex h-[68px] max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <Link href="/" aria-label="AiWebVideo home" className="rounded-md">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <div ref={productRef} className="relative">
            <button
              type="button"
              onClick={() => setProductOpen((value) => !value)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white"
              aria-expanded={productOpen}
              aria-haspopup="menu"
            >
              Create <ChevronDown size={14} className={productOpen ? "rotate-180 transition" : "transition"} />
            </button>

            {productOpen ? (
              <div
                role="menu"
                aria-label="Creation modes"
                className="absolute left-0 top-12 w-[350px] border border-white/[.1] bg-[#101014] p-2 shadow-[0_24px_70px_-32px_rgba(0,0,0,.95)]"
              >
                {productItems.map(([label, helper, href, Icon]) => (
                  <Link
                    key={label}
                    href={href}
                    role="menuitem"
                    onClick={(event) => handleCreatorNavigation(event, href)}
                    className="group grid grid-cols-[20px_1fr] gap-3 rounded-lg px-3 py-3 transition hover:bg-white/[.045]"
                  >
                    <Icon size={17} className="mt-0.5 text-text-dim transition group-hover:text-violet" />
                    <span>
                      <span className="block text-sm font-semibold text-white">{label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-text-dim">{helper}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <Link href="/examples" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">
            Explore
          </Link>
          <Link href="/features" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">
            Tools
          </Link>
          <Link href="/pricing" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">
            Pricing
          </Link>
          <Link href="/guides/turn-website-into-video" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-text-muted transition hover:bg-white/[.04] hover:text-white">
            Guides
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {!authChecked ? (
            <div className="hidden h-10 w-40 animate-pulse bg-white/[.04] sm:block" aria-label="Checking account" />
          ) : isSignedIn ? (
            <>
              <Link href="/pricing" className="hidden min-h-10 items-center px-2 text-xs font-medium text-text-muted transition hover:text-white lg:inline-flex">
                {formatCredits(me?.creditsBalance)} credits
              </Link>
              {me?.isAdmin ? (
                <Link href="/admin" className="hidden min-h-10 items-center gap-2 px-2 text-xs font-semibold text-text-muted transition hover:text-white xl:inline-flex">
                  <ShieldCheck size={15} /> Admin
                </Link>
              ) : null}
              <Link href="/dashboard" className="hidden min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 sm:inline-flex">
                Workspace
              </Link>
              {me ? <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} /> : null}
            </>
          ) : (
            <>
              <Button className="hidden sm:inline-flex" variant="ghost" size="sm" onClick={() => setShowAuthModal(true)}>
                Sign in
              </Button>
              <a href="/#generate" className="hidden min-h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 sm:inline-flex">
                Start creating
              </a>
            </>
          )}

          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/[.1] text-white transition hover:bg-white/[.04] md:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-panel"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </nav>

      {portalReady && mobileOpen
        ? createPortal(
            <div className="fixed inset-0 z-[10000] md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="absolute inset-0 bg-black/65"
              />
              <section
                id="mobile-navigation-panel"
                className="absolute inset-y-0 right-0 flex w-[min(92vw,420px)] flex-col border-l border-white/[.1] bg-[#0d0d10] pt-[env(safe-area-inset-top)] shadow-[-24px_0_70px_-42px_rgba(0,0,0,.95)]"
              >
                <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/[.08] px-5">
                  <Wordmark />
                  <button
                    ref={mobileCloseRef}
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/[.1] text-white"
                    aria-label="Close navigation"
                  >
                    <X size={19} />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <p className="mb-2 text-sm font-semibold text-white">Create</p>
                  <div className="border-t border-white/[.08]">
                    {productItems.map(([label, helper, href, Icon]) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={(event) => handleCreatorNavigation(event, href)}
                        className="grid min-h-[64px] grid-cols-[22px_1fr] items-center gap-3 border-b border-white/[.08] py-3"
                      >
                        <Icon size={17} className="text-text-dim" />
                        <span>
                          <span className="block text-sm font-semibold text-white">{label}</span>
                          <span className="mt-0.5 block text-xs text-text-dim">{helper}</span>
                        </span>
                      </Link>
                    ))}
                  </div>

                  <nav aria-label="More navigation" className="mt-7 border-t border-white/[.08]">
                    {[
                      ["Explore", "/examples"],
                      ["Tools", "/features"],
                      ["Pricing", "/pricing"],
                      ["Guides", "/guides/turn-website-into-video"],
                      ["How it works", "/how-it-works"],
                    ].map(([label, href]) => (
                      <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center border-b border-white/[.08] text-sm font-medium text-text-muted">
                        {label}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="shrink-0 border-t border-white/[.08] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  {!authChecked ? (
                    <div className="h-11 animate-pulse bg-white/[.04]" />
                  ) : isSignedIn ? (
                    <div className="space-y-2">
                      <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black">
                        Open workspace
                      </Link>
                      <div className="flex items-center justify-between text-sm text-text-muted">
                        <Link href="/pricing" onClick={() => setMobileOpen(false)}>{formatCredits(me?.creditsBalance)} credits</Link>
                        {me?.isAdmin ? <Link href="/admin" onClick={() => setMobileOpen(false)}>Admin</Link> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="md" onClick={() => { setMobileOpen(false); setShowAuthModal(true); }}>
                        Sign in
                      </Button>
                      <a href="/#generate" onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-black">
                        Start creating
                      </a>
                    </div>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      {showAuthModal ? (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignedIn={() => {
            setShowAuthModal(false);
            navigate(resolveDashboardDestination());
          }}
        />
      ) : null}
    </header>
  );
}
