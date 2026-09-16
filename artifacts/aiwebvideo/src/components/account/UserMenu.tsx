import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BadgePercent, CircleUserRound, Layers3 } from 'lucide-react';
import { signOut } from '@/lib/firebase/client';
import { fetchWelcomeGrowthOffer, formatWelcomeCountdown, type WelcomeGrowthOffer } from '@/lib/growth';

export function formatCredits(value: number | undefined) {
  if (value === undefined) return '—';
  // Customer API balances are already x5. Preserve the old internal 100k
  // "Unlimited" sentinel by moving the display threshold to 500k.
  if (value >= 500_000) return 'Unlimited';
  return Math.round(value).toLocaleString();
}

export function UserMenu({ email, plan, creditsBalance, isAdmin = false }: { email: string; plan: string; creditsBalance: number; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const [offer, setOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);
  const inWorkspace = location.startsWith('/dashboard');

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!inWorkspace) return;
    let cancelled = false;
    fetchWelcomeGrowthOffer()
      .then((value) => { if (!cancelled) setOffer(value); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [inWorkspace]);

  useEffect(() => {
    if (!offer?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [offer?.active]);

  const activeOffer = inWorkspace && offer?.active && offer.discountPercent > 0 && new Date(offer.expiresAt).getTime() > now
    ? offer
    : null;

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate('/');
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {inWorkspace && (
        <Link
          href="/studio"
          className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet/25 bg-violet/[.08] px-2.5 text-[11px] font-semibold text-white transition hover:border-violet/45 hover:bg-violet/[.14] sm:px-3"
          aria-label="Open AI editing Studio"
        >
          <Layers3 size={15} className="text-violet" aria-hidden="true" />
          <span className="hidden sm:inline">Studio</span>
        </Link>
      )}

      {inWorkspace && (
        <Link
          href="/pricing#buy-credits"
          className={`group inline-flex min-h-10 items-center gap-2 rounded-xl border px-2.5 text-[11px] font-semibold transition sm:px-3 ${activeOffer ? 'border-mint/35 bg-mint/[.08] text-mint hover:bg-mint/[.14]' : 'border-white/10 bg-white/[.035] text-text-muted hover:border-violet/30 hover:bg-violet/[.08] hover:text-white'}`}
          aria-label={activeOffer ? `${activeOffer.discountPercent}% off credit packs` : 'View pricing'}
        >
          <BadgePercent size={15} className={activeOffer ? 'text-mint' : 'text-violet'} aria-hidden="true" />
          <span className="hidden sm:inline">Pricing</span>
          {activeOffer && (
            <span className="inline-flex items-center gap-1 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[9px] font-bold text-mint">
              {activeOffer.discountPercent}% OFF
              <span className="hidden lg:inline text-mint/75">· {formatWelcomeCountdown(activeOffer.expiresAt, now)}</span>
            </span>
          )}
        </Link>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel-alt text-text-primary shadow-lg transition-all hover:scale-105 hover:border-violet/50 hover:bg-violet/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        <CircleUserRound size={23} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-panel p-2 shadow-2xl animate-fade-in">
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-semibold text-text-primary">{email}</p>
            <p className="mt-1 text-xs capitalize text-text-muted">{plan} plan · {formatCredits(creditsBalance)} credits</p>
          </div>
          <div className="py-1 text-sm">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-text-muted hover:bg-white/5 hover:text-text-primary">Workspace</Link>
            <Link href="/studio" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-semibold text-violet hover:bg-violet/10">Studio editor</Link>
            <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-text-muted hover:bg-white/5 hover:text-text-primary">Profile & billing</Link>
            <Link href="/profile#usage" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-text-muted hover:bg-white/5 hover:text-text-primary">Usage</Link>
            {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-semibold text-violet hover:bg-violet/10">Admin control center</Link>}
            <Link href="/pricing" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-text-muted hover:bg-white/5 hover:text-text-primary">Plans & credits</Link>
            <button type="button" onClick={handleSignOut} className="w-full rounded-xl px-3 py-2.5 text-left text-text-muted hover:bg-white/5 hover:text-text-primary">Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}