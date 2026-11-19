import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { BadgePercent } from 'lucide-react';
import { signOut } from '@/lib/firebase/client';
import { setTheme, useTheme } from '@/lib/theme';
import { fetchWelcomeGrowthOffer, formatWelcomeCountdown, type WelcomeGrowthOffer } from '@/lib/growth';

export function formatCredits(value: number | undefined) {
  if (value === undefined) return '—';
  if (value >= 500_000) return 'Unlimited';
  return Math.round(value).toLocaleString();
}

export function UserMenu({ email, plan, creditsBalance, isAdmin = false }: { email: string; plan: string; creditsBalance: number; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
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

  const initial = (email.trim()[0] ?? "?").toUpperCase();
  const itemClass = "block rounded-xl px-3 py-2.5 text-text-muted transition hover:bg-white/[.06] hover:text-white";

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {activeOffer && (
        <Link
          href="/pricing#buy-credits"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/[.08] px-3 text-[13px] font-semibold text-gold transition hover:bg-gold/[.14]"
          aria-label={`${activeOffer.discountPercent}% off credit packs for ${formatWelcomeCountdown(activeOffer.expiresAt, now)}`}
        >
          <BadgePercent size={15} aria-hidden="true" />
          <span>{activeOffer.discountPercent}% off</span>
          <span className="font-utility font-medium text-gold/80 max-sm:hidden">{formatWelcomeCountdown(activeOffer.expiresAt, now)}</span>
        </Link>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[14px] font-semibold text-white transition hover:bg-white/15"
        aria-label="Open account menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-panel p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
          <div className="px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-medium text-text-primary">{email}</p>
            <p className="mt-0.5 text-[13px] capitalize text-text-dim">{plan} plan · {formatCredits(creditsBalance)} credits</p>
          </div>
          <div className="border-t border-white/[.07] pt-1 text-sm">
            <Link href="/dashboard" onClick={() => setOpen(false)} className={itemClass}>Open app</Link>
            <Link href="/profile" onClick={() => setOpen(false)} className={itemClass}>Account and billing</Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className={itemClass}>Plans and credits</Link>
            {isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className={itemClass}>Admin</Link>}
            <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={`${itemClass} w-full text-left`}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
            <button type="button" onClick={handleSignOut} className={`${itemClass} w-full text-left`}>Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}
