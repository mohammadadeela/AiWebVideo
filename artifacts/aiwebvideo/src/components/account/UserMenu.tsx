import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { CircleUserRound } from 'lucide-react';
import { signOut } from '@/lib/firebase/client';

export function formatCredits(value: number | undefined) {
  if (value === undefined) return '—';
  if (value >= 100_000) return 'Unlimited';
  return value.toLocaleString();
}

export function UserMenu({ email, plan, creditsBalance, isAdmin = false }: { email: string; plan: string; creditsBalance: number; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    navigate('/');
  }

  return (
    <div ref={ref} className="relative">
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
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-border bg-panel p-2 shadow-2xl animate-fade-in">
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-semibold text-text-primary">{email}</p>
            <p className="mt-1 text-xs capitalize text-text-muted">{plan} plan · {formatCredits(creditsBalance)} credits</p>
          </div>
          <div className="py-1 text-sm">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-text-muted hover:bg-white/5 hover:text-text-primary">Workspace</Link>
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
