import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { ResultGrid } from '@/components/chat/ResultGrid';
import { ProgressBar } from '@/components/chat/ProgressBar';
import { Button } from '@/components/ui/app-button';
import { Wordmark } from '@/components/ui/Wordmark';
import { UserMenu, formatCredits } from '@/components/account/UserMenu';
import { CreditUpgradeNotice } from '@/components/account/CreditUpgradeNotice';
import { watchAuthState } from '@/lib/firebase/client';
import { deleteSavedChat, fetchJob, fetchMe, fetchUserJobs, reuseSavedCapture, updateSavedChat, type UserJobSummary } from '@/lib/api-client';
import { MODE_OPTIONS, type JobMode, type JobStatusResponse } from '@/components/chat/types';
import { CircleUserRound, MoreHorizontal, Paperclip, PanelLeftClose, PanelLeftOpen, Pin, Play, Search, Sparkles, Trash2, X } from 'lucide-react';
import { clearActiveJobId, getActiveJobId, setActiveJobId } from '@/lib/guestSession';

interface Me { email: string; plan: string; creditsBalance: number; isAdmin: boolean; }

const ACTIVE_STATUSES = new Set(['queued', 'capturing', 'storyboarding', 'rendering']);

function relativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusTone(status: string) {
  if (status === 'done') return 'bg-mint/15 text-mint';
  if (status === 'failed') return 'bg-pink/15 text-pink';
  return 'bg-violet/15 text-violet';
}

function statusLabel(status: string, progress: number) {
  if (status === 'captured') return 'Ready to continue';
  if (ACTIVE_STATUSES.has(status)) return `Running · ${Math.max(0, Math.min(100, Math.round(progress)))}%`;
  return status;
}

export function DashboardClient() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('job') ?? getActiveJobId());
  const [query, setQuery] = useState('');
  const [newProjectKey, setNewProjectKey] = useState(0);
  const [reuseJobId, setReuseJobId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('reuse'));
  const [reuseMode, setReuseMode] = useState<JobMode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [account, history] = await Promise.all([fetchMe(), fetchUserJobs()]);
      setMe(account);
      setJobs(Array.isArray(history.jobs) ? history.jobs.filter((job) => job && typeof job.id === 'string') : []);
      setError(null);
    } catch {
      setError('We could not refresh your workspace. Please try again in a moment.');
    }
  }, []);

  useEffect(() => watchAuthState((user) => {
    setIsSignedIn(!!user);
    setAuthChecked(true);
    if (user) void refresh();
  }), [refresh]);

  useEffect(() => {
    if (!isSignedIn) return;
    const hasRunningJob = jobs.some((job) => ACTIVE_STATUSES.has(job.status));
    const timer = window.setInterval(() => void refresh(), hasRunningJob ? 3_000 : 20_000);
    return () => window.clearInterval(timer);
  }, [isSignedIn, jobs, refresh]);

  const runningJobs = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)), [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((job) =>
    `${job.title} ${job.sourceUrl} ${job.mode}`.toLowerCase().includes(query.toLowerCase())
  ), [jobs, query]);

  function startNew() {
    clearActiveJobId();
    setSelectedJobId(null);
    setReuseJobId(null);
    setReuseMode(null);
    window.history.replaceState({}, '', '/dashboard');
    setNewProjectKey((value) => value + 1);
    setSidebarOpen(false);
  }

  async function togglePin(item: UserJobSummary) {
    try {
      await updateSavedChat(item.id, { pinned: !item.pinned });
      setActionMenuId(null);
      await refresh();
    } catch { setError('We could not update that chat. Please try again.'); }
  }

  async function removeChat(item: UserJobSummary) {
    if (!window.confirm(`Delete “${item.title}” from your chat history?`)) return;
    try {
      await deleteSavedChat(item.id);
      if (selectedJobId === item.id) startNew();
      setActionMenuId(null);
      await refresh();
    } catch { setError('We could not delete that chat. Please try again.'); }
  }

  function openProject(jobId: string) {
    setActiveJobId(jobId);
    setSelectedJobId(jobId);
    window.history.replaceState({}, '', `/dashboard?job=${encodeURIComponent(jobId)}`);
    setSidebarOpen(false);
  }

  if (!authChecked) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div>;

  if (!isSignedIn) return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md rounded-3xl border border-border bg-panel p-8 text-center">
        <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
        <h1 className="mt-4 font-display text-xl font-bold text-text-primary">Sign in to open your workspace</h1>
        <p className="mt-2 text-sm text-text-muted">Your projects, files, credits, and billing stay connected to your account.</p>
        <Link href="/"><Button className="mt-6">Go to sign in</Button></Link>
      </div>
    </main>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {sidebarOpen && <button aria-label="Close sidebar" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-border bg-[#100c20] p-3 transition-all lg:sticky lg:top-0 lg:h-screen ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${sidebarCollapsed ? 'lg:w-0 lg:overflow-hidden lg:border-0 lg:p-0' : 'lg:w-[286px]'}`}>
        <div className="flex items-center justify-between px-2 py-2">
          <Link href="/"><Wordmark /></Link>
          <button type="button" onClick={() => { setSidebarOpen(false); setSidebarCollapsed(true); }} className="rounded-lg p-2 text-text-dim hover:bg-white/5 hover:text-text-primary" aria-label="Close sidebar"><PanelLeftClose size={19} /></button>
        </div>
        <button type="button" onClick={startNew} className="premium-button mt-3 flex w-full items-center gap-3 rounded-xl border border-violet/30 bg-violet/10 px-3 py-3 text-left text-sm font-semibold text-text-primary hover:bg-violet/15">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signature text-white">＋</span>
          New chat
        </button>
        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search chats" className="w-full rounded-xl border border-border bg-panel/70 py-2.5 pl-9 pr-9 text-base text-text-primary outline-none placeholder:text-text-dim focus:border-violet/50 sm:text-xs" />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary" aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="chat-scroll mt-4 flex-1 overflow-y-auto">
          {runningJobs.length > 0 && (
            <div className="sticky top-0 z-10 mx-1 mb-3 space-y-1.5 rounded-xl border border-violet/25 bg-[#100c20] p-2 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-mint" />
                <p className="text-[11px] font-semibold text-text-primary">{runningJobs.length} generation{runningJobs.length === 1 ? '' : 's'} running</p>
              </div>
              {/* Always-visible and clickable — pinned to the top of the list
                  (even while scrolled) so a running job is never something
                  you have to go hunting for after switching chats. */}
              {runningJobs.map((job) => (
                <a
                  key={job.id}
                  href={`/dashboard?job=${encodeURIComponent(job.id)}`}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    openProject(job.id);
                  }}
                  className="block rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                >
                  <p className="truncate text-[11px] font-medium text-text-primary">{job.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-signature transition-all" style={{ width: `${Math.max(4, Math.min(100, job.progress))}%` }} />
                    </span>
                    <span className="text-[9px] text-text-dim">{Math.max(0, Math.min(100, Math.round(job.progress)))}%</span>
                  </div>
                </a>
              ))}
            </div>
          )}
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-text-dim">Your chats</p>
          <div className="space-y-1">
            {filteredJobs.map((item) => (
              <div key={item.id} className={`group relative rounded-xl transition-colors ${selectedJobId === item.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <a
                  href={`/dashboard?job=${encodeURIComponent(item.id)}`}
                  onClick={(event) => {
                    // A real href makes right-click → "open in new tab",
                    // middle-click, and Cmd/Ctrl-click work like any normal
                    // link. Only a plain left-click is intercepted for
                    // in-app SPA navigation.
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    openProject(item.id);
                  }}
                  className="block w-full px-3 py-2.5 pr-9 text-left"
                >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'done' ? 'bg-mint' : item.status === 'failed' ? 'bg-pink' : 'bg-violet animate-pulse-soft'}`} />
                  {item.pinned && <Pin size={11} className="shrink-0 fill-violet text-violet" />}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{item.title}</span>
                  <span className="text-[10px] text-text-dim">{relativeTime(item.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-3.5"><p className="min-w-0 flex-1 truncate text-[10px] capitalize text-text-dim">{item.mode} · {statusLabel(item.status, item.progress)}</p>{ACTIVE_STATUSES.has(item.status) && <span className="h-1 w-12 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-signature transition-all" style={{ width: `${Math.max(4, Math.min(100, item.progress))}%` }} /></span>}</div>
                </a>
                <button type="button" onClick={() => setActionMenuId((value) => value === item.id ? null : item.id)} className="absolute right-1.5 top-2 rounded-lg p-1.5 text-text-dim opacity-0 hover:bg-white/10 hover:text-text-primary group-hover:opacity-100 focus:opacity-100" aria-label={`Chat options for ${item.title}`}><MoreHorizontal size={15} /></button>
                {actionMenuId === item.id && <div className="absolute right-2 top-10 z-50 w-40 rounded-xl border border-border bg-panel p-1.5 shadow-2xl"><button type="button" onClick={() => void togglePin(item)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-text-muted hover:bg-white/5 hover:text-text-primary"><Pin size={14} />{item.pinned ? 'Unpin chat' : 'Pin chat'}</button><button type="button" onClick={() => void removeChat(item)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-pink hover:bg-pink/10"><Trash2 size={14} />Delete chat</button></div>}
              </div>
            ))}
            {!filteredJobs.length && <p className="px-3 py-6 text-center text-xs text-text-dim">{query ? 'No matching projects.' : 'Your first project will appear here.'}</p>}
          </div>
        </div>
        {me && (
          <Link href="/profile" className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-panel/60 p-3 hover:bg-panel">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel-alt text-text-primary"><CircleUserRound size={21} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-text-primary">{me.email}</span><span className="block text-[10px] capitalize text-text-muted">{me.plan} · {formatCredits(me.creditsBalance)} credits</span></span>
            <span className="text-text-dim">›</span>
          </Link>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setSidebarOpen(true); setSidebarCollapsed(false); }} className={`rounded-xl border border-border p-2 text-text-muted hover:text-text-primary ${sidebarCollapsed ? '' : 'lg:hidden'}`} aria-label="Open chat history"><PanelLeftOpen size={19} /></button>
            <div><p className="text-sm font-semibold text-text-primary">{selectedJobId ? 'Saved chat' : 'New production'}</p><p className="hidden text-[10px] text-text-dim sm:block">Website-to-video creative workspace</p></div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={me && me.creditsBalance <= 0 ? '/pricing#buy-credits' : '/pricing'} className={`hidden rounded-full border px-3 py-1.5 text-xs sm:block ${me && me.creditsBalance <= 0 ? 'border-violet/40 bg-violet/10 font-semibold text-violet hover:bg-violet/15' : 'border-border bg-panel text-text-muted hover:text-text-primary'}`}>{me && me.creditsBalance <= 0 ? 'Recharge credits' : `${formatCredits(me?.creditsBalance)} credits`}</Link>
            {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
          </div>
        </header>

        <main className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
          {error && <div className="mx-auto mb-4 w-full max-w-4xl shrink-0 rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-xs text-text-muted">{error}</div>}
          {me && me.creditsBalance <= 0 && <div className="mx-auto mb-4 w-full max-w-4xl shrink-0"><CreditUpgradeNotice plan={me.plan} creditsBalance={me.creditsBalance} /></div>}
          {selectedJobId ? (
            <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col">
              <ChatWidget key={selectedJobId} resumeJobId={selectedJobId} className="h-full" onJobCreated={() => window.setTimeout(() => void refresh(), 1200)} />
            </div>
          ) : (
            <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col">
              <div className="mb-6 shrink-0 text-center">
                <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">What will we create today?</h1>
                <p className="mt-2 text-sm text-text-muted">Paste any public website, then direct every creative and delivery choice in chat.</p>
              </div>
              <ChatWidget key={newProjectKey} initialJobId={reuseJobId} initialMode={reuseMode} className="min-h-0 flex-1" onJobCreated={() => window.setTimeout(() => void refresh(), 1200)} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
