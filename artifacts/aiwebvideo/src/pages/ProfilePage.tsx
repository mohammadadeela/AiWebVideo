import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { Button } from '@/components/ui/app-button';
import { formatCredits } from '@/components/account/UserMenu';
import { watchAuthState } from '@/lib/firebase/client';
import { fetchMe, fetchUserJobs, openBillingPortal, startTopup, type UserJobSummary } from '@/lib/api-client';
import { CircleUserRound } from 'lucide-react';

interface Me { email: string; plan: string; creditsBalance: number; isAdmin: boolean; }

export function ProfilePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchAuthState((user) => {
    setSignedIn(!!user);
    setAuthChecked(true);
    if (user) {
      void Promise.all([fetchMe(), fetchUserJobs()])
        .then(([account, history]) => { setMe(account); setJobs(history.jobs); })
        .catch(() => setError('We could not load your account details right now.'));
    }
  }), []);

  const stats = useMemo(() => ({
    total: jobs.length,
    completed: jobs.filter((job) => job.status === 'done').length,
    active: jobs.filter((job) => ['queued', 'capturing', 'storyboarding', 'rendering'].includes(job.status)).length,
  }), [jobs]);

  async function billing(action: 'portal' | 'topup') {
    setBusy(true); setError(null);
    try {
      const target = action === 'portal' ? (await openBillingPortal()).portalUrl : (await startTopup()).checkoutUrl;
      window.location.href = target;
    } catch {
      setError('Billing is temporarily unavailable. Your account and projects are safe; please try again shortly.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto min-h-[70vh] max-w-6xl px-5 py-12">
        {!authChecked ? <div className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" /> : !signedIn ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-border bg-panel p-8 text-center">
            <h1 className="font-display text-2xl font-bold text-text-primary">Sign in to view your profile</h1>
            <p className="mt-2 text-sm text-text-muted">Account, plan, billing, and production history are private to you.</p>
            <Link href="/"><Button className="mt-6">Go to sign in</Button></Link>
          </div>
        ) : (
          <div className="space-y-7 animate-fade-in-up">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="font-utility text-xs uppercase tracking-widest text-violet">Account center</p><h1 className="mt-2 font-display text-3xl font-bold text-text-primary">Profile & billing</h1><p className="mt-2 text-sm text-text-muted">Manage your production account from one place.</p></div>
              <Link href="/dashboard"><Button>Open workspace</Button></Link>
              {me?.isAdmin && <Link href="/admin"><Button variant="secondary">Admin control center</Button></Link>}
            </div>
            {error && <div className="rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-sm text-text-muted">{error}</div>}

            <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
              <section className="rounded-3xl border border-border bg-panel p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet/30 bg-violet/10 text-text-primary shadow-violet"><CircleUserRound size={34} strokeWidth={1.6} aria-hidden="true" /></div>
                  <div className="min-w-0"><h2 className="truncate font-display text-lg font-semibold text-text-primary">{me?.email}</h2><p className="mt-1 text-sm capitalize text-text-muted">{me?.plan} plan</p></div>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[['Projects', stats.total], ['Completed', stats.completed], ['Active', stats.active]].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-panel-alt p-4 text-center"><p className="font-utility text-xl font-semibold text-text-primary">{value}</p><p className="mt-1 text-[10px] text-text-dim">{label}</p></div>)}
                </div>
                <div className="mt-6 rounded-2xl border border-border bg-bg/30 p-4">
                  <p className="text-xs font-semibold text-text-primary">Account security</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">Your projects require an authenticated session. Sign out on shared devices and keep your login private.</p>
                </div>
              </section>

              <section className="rounded-3xl border border-border bg-panel p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-dim">Plan & production balance</p>
                <div className="mt-4 rounded-2xl bg-signature-soft p-5">
                  <p className="text-sm capitalize text-text-muted">{me?.plan} plan</p>
                  <p className="mt-1 font-utility text-3xl font-bold text-text-primary">{formatCredits(me?.creditsBalance)}</p>
                  <p className="mt-1 text-xs text-text-dim">available production credits</p>
                </div>
                <div className="mt-4 space-y-2">
                  {me && me.creditsBalance < 100_000 && me.plan !== 'free' && <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void billing('topup')}>Add 100 credits</Button>}
                  {me?.plan !== 'free' && <Button variant="ghost" className="w-full" disabled={busy} onClick={() => void billing('portal')}>Manage billing</Button>}
                  <Link href="/pricing"><Button variant="ghost" className="w-full">Compare plans</Button></Link>
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-border bg-panel p-6">
              <div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold text-text-primary">Recent projects</h2><p className="mt-1 text-xs text-text-muted">The same real account history shown in your workspace.</p></div><Link href="/dashboard" className="text-xs font-semibold text-violet hover:text-pink">View all →</Link></div>
              <div className="mt-4 divide-y divide-border">
                {jobs.slice(0, 5).map((job) => <Link key={job.id} href={`/dashboard?job=${encodeURIComponent(job.id)}`} className="flex items-center gap-4 py-3"><div className="h-10 w-14 overflow-hidden rounded-lg border border-border bg-panel-alt">{job.screenshotUrl && <img src={job.screenshotUrl} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{job.title}</p><p className="text-xs capitalize text-text-dim">{job.mode} · {job.status}</p></div><span className="text-text-dim">›</span></Link>)}
                {!jobs.length && <p className="py-8 text-center text-sm text-text-dim">No projects yet. Your first production will appear here.</p>}
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
