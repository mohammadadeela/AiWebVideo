import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { ResultGrid } from '@/components/chat/ResultGrid';
import { ProgressBar } from '@/components/chat/ProgressBar';
import { Button } from '@/components/ui/app-button';
import { Wordmark } from '@/components/ui/Wordmark';
import { UserMenu, formatCredits } from '@/components/account/UserMenu';
import { watchAuthState } from '@/lib/firebase/client';
import { deleteSavedChat, fetchJob, fetchMe, fetchUserJobs, reuseSavedCapture, updateSavedChat, type UserJobSummary } from '@/lib/api-client';
import { MODE_OPTIONS, type JobMode, type JobStatusResponse } from '@/components/chat/types';
import { CircleUserRound, MoreHorizontal, Paperclip, PanelLeftClose, PanelLeftOpen, Pin, Play, Search, Sparkles, Trash2, X } from 'lucide-react';

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

function ProjectHistoryView({ jobId, onNew, onReuse }: { jobId: string; onNew: () => void; onReuse: (jobId: string, mode?: JobMode) => Promise<void> }) {
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState(false);
  const [reusing, setReusing] = useState<JobMode | 'choose' | null>(null);
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const next = await fetchJob(jobId);
        if (cancelled) return;
        setJob(next);
        setError(false);
        if (ACTIVE_STATUSES.has(next.status)) timer = window.setTimeout(load, 2500);
      } catch {
        if (!cancelled) setError(true);
      }
    };
    void load();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [jobId]);

  if (error) return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-panel p-8 text-center">
      <p className="font-display text-lg font-semibold text-text-primary">This project could not be loaded</p>
      <p className="mt-2 text-sm text-text-muted">It may belong to a different account or the connection may be temporary.</p>
      <Button className="mt-5" onClick={onNew}>Start a new project</Button>
    </div>
  );

  if (!job) return <div className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" />;
  const currentJob = job;

  let host = job.sourceUrl;
  try { host = new URL(job.sourceUrl).hostname.replace(/^www\./, ''); } catch { /* keep URL */ }

  const pages = job.captureMetadata?.pages ?? [];
  const previewPages = pages.slice(0, 4);

  async function continueWith(mode?: JobMode) {
    setReusing(mode ?? 'choose');
    await onReuse(currentJob.id, mode).finally(() => setReusing(null));
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-4xl flex-col animate-fade-in-up">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusTone(job.status)}`}>{job.status}</span><span className="truncate text-xs text-text-dim">{host}</span></div>
          <h1 className="mt-2 truncate font-display text-lg font-bold text-text-primary">{job.title || job.captureMetadata?.title || host}</h1>
        </div>
        <Button variant="secondary" onClick={onNew}>＋ New chat</Button>
      </div>

      {ACTIVE_STATUSES.has(job.status) && (
        <div className="rounded-2xl border border-border bg-panel p-5">
          <ProgressBar status={job.status} progress={job.progress} statusMessage={job.statusMessage} etaSeconds={job.etaSeconds} />
          <p className="mt-3 text-xs text-text-dim">Running in the background — switch chats or close this view safely. Progress stays saved here.</p>
        </div>
      )}

      {job.errorMessage && (
        <div className="rounded-2xl border border-pink/20 bg-pink/5 p-4 text-sm text-text-muted">{job.errorMessage}</div>
      )}

      <section className="flex-1 space-y-4 pb-7">
        {job.messages.map((message) => <div key={message.id} className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto bg-signature text-white' : 'border border-border bg-panel text-text-muted'}`}>{message.content}</div>)}

        {job.captureMetadata && <div className="max-w-2xl rounded-2xl border border-border bg-panel p-3.5 shadow-lg shadow-black/5">
          <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet/15 text-violet"><Paperclip size={16} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-text-primary">Saved website capture</p><p className="text-[10px] text-text-dim">{job.captureMetadata.pageCount} pages · reusable in this chat</p></div></div><span className="rounded-full bg-mint/10 px-2 py-1 text-[9px] font-semibold text-mint">Ready</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {previewPages.map((page, index) => <button type="button" key={page.url} onClick={() => setPreview({ url: page.screenshotUrl, title: page.title })} className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-panel-alt text-left"><div className="relative"><img src={page.screenshotUrl} alt={page.title} className="aspect-video w-full object-cover object-top transition-transform group-hover:scale-105" /><span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[7px] font-bold tracking-wide text-white/90">AiWebVideo</span>{index === 3 && pages.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white">+{pages.length - 4}</span>}</div><p className="truncate px-2 py-1.5 text-[9px] text-text-muted">{page.title}</p></button>)}
          </div>
          {job.captureMetadata.recordingUrl && <details className="mt-2"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-text-muted hover:bg-white/5 hover:text-text-primary"><Play size={13} className="fill-current" /> Preview saved scroll recording</summary><video src={job.captureMetadata.recordingUrl} controls muted playsInline className="mt-2 aspect-video w-full max-w-sm rounded-lg bg-black" /></details>}
        </div>}

        {job.storyboard && <div className="max-w-xl rounded-2xl border border-border bg-panel px-4 py-3 text-sm text-text-muted"><p className="font-semibold text-text-primary">Creative plan</p><p className="mt-1 leading-relaxed">{job.storyboard.concept}</p><details className="mt-2 text-xs"><summary className="cursor-pointer text-violet">View {job.storyboard.scenes.length} scenes</summary><ol className="mt-2 space-y-1.5">{job.storyboard.scenes.map((scene) => <li key={scene.sceneNumber}><span className="font-semibold text-text-primary">{scene.sceneNumber}.</span><span className="text-text-dim"> {scene.shotDescription}</span></li>)}</ol></details></div>}

        {job.assets.length > 0 && <div className="max-w-xl rounded-2xl border border-border bg-panel p-4"><p className="mb-3 text-xs font-semibold text-text-primary">Generated files</p><ResultGrid assets={job.assets} onUnlock={() => {}} /></div>}
      </section>

      {job.captureMetadata && <div className="sticky bottom-4 rounded-2xl border border-violet/25 bg-[#17112c]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2 px-1"><Sparkles size={14} className="text-violet" /><p className="text-xs font-semibold text-text-primary">Continue with this saved capture</p><span className="ml-auto text-[9px] text-mint">No rescan</span></div>
        <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3 lg:grid-cols-4">{MODE_OPTIONS.map((option) => <button key={option.mode} type="button" disabled={!!reusing} onClick={() => void continueWith(option.mode)} className="min-w-0 truncate rounded-xl border border-border bg-panel px-3 py-2 text-[11px] font-medium text-text-muted transition hover:border-violet/50 hover:text-text-primary disabled:opacity-50">{option.label}</button>)}</div>
        <button type="button" disabled={!!reusing} onClick={() => void continueWith()} className="mt-1 flex w-full items-center justify-between rounded-xl border border-border bg-panel-alt px-4 py-3 text-left text-sm text-text-dim hover:border-violet/40 hover:text-text-muted disabled:opacity-50"><span>{reusing ? 'Opening the saved chat…' : 'Ask for something else using these files…'}</span><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signature text-white"><Sparkles size={15} /></span></button>
      </div>}
      {preview && <div role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={() => setPreview(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-md sm:p-8">
        <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/15"><X size={20} /></button>
        <div onClick={(event) => event.stopPropagation()} className="relative max-h-[88vh] max-w-[94vw] cursor-default overflow-hidden rounded-xl bg-black shadow-2xl"><img src={preview.url} alt={preview.title} className="max-h-[88vh] max-w-[94vw] object-contain" /><span className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold tracking-wide text-white/90 backdrop-blur">AiWebVideo</span></div>
      </div>}
    </div>
  );
}

export function DashboardClient() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('job'));
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
      setJobs(history.jobs);
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
    setSelectedJobId(null);
    setReuseJobId(null);
    setReuseMode(null);
    window.history.replaceState({}, '', '/dashboard');
    setNewProjectKey((value) => value + 1);
    setSidebarOpen(false);
  }

  async function reuseCapture(jobId: string, mode?: JobMode) {
    try {
      const reused = await reuseSavedCapture(jobId);
      setSelectedJobId(null);
      setReuseJobId(reused.jobId);
      setReuseMode(mode ?? null);
      setNewProjectKey((value) => value + 1);
      window.history.replaceState({}, '', `/dashboard?reuse=${encodeURIComponent(reused.jobId)}`);
      await refresh();
    } catch {
      setError('We could not reuse that saved capture right now. Please try again.');
    }
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search chats" className="w-full rounded-xl border border-border bg-panel/70 py-2.5 pl-9 pr-9 text-xs text-text-primary outline-none placeholder:text-text-dim focus:border-violet/50" />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-primary" aria-label="Clear search"><X size={14} /></button>}
        </div>
        <div className="chat-scroll mt-4 flex-1 overflow-y-auto">
          {runningJobs.length > 0 && <div className="mx-1 mb-3 rounded-xl border border-violet/25 bg-violet/10 px-3 py-2.5"><div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-mint" /><p className="text-[11px] font-semibold text-text-primary">{runningJobs.length} generation{runningJobs.length === 1 ? '' : 's'} running</p></div><p className="mt-1 pl-4 text-[9px] text-text-dim">You can switch chats. Work continues in the background.</p></div>}
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-text-dim">Your chats</p>
          <div className="space-y-1">
            {filteredJobs.map((item) => (
              <div key={item.id} className={`group relative rounded-xl transition-colors ${selectedJobId === item.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <button type="button" onClick={() => openProject(item.id)} className="w-full px-3 py-2.5 pr-9 text-left">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.status === 'done' ? 'bg-mint' : item.status === 'failed' ? 'bg-pink' : 'bg-violet animate-pulse-soft'}`} />
                  {item.pinned && <Pin size={11} className="shrink-0 fill-violet text-violet" />}
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">{item.title}</span>
                  <span className="text-[10px] text-text-dim">{relativeTime(item.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-3.5"><p className="min-w-0 flex-1 truncate text-[10px] capitalize text-text-dim">{item.mode} · {ACTIVE_STATUSES.has(item.status) ? `Running · ${Math.max(0, Math.min(100, Math.round(item.progress)))}%` : item.status}</p>{ACTIVE_STATUSES.has(item.status) && <span className="h-1 w-12 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-signature transition-all" style={{ width: `${Math.max(4, Math.min(100, item.progress))}%` }} /></span>}</div>
                </button>
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
            <Link href="/pricing" className="hidden rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-text-muted hover:text-text-primary sm:block">{formatCredits(me?.creditsBalance)} credits</Link>
            {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
          {error && <div className="mx-auto mb-4 max-w-4xl rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-xs text-text-muted">{error}</div>}
          {selectedJobId ? (
            <ProjectHistoryView jobId={selectedJobId} onNew={startNew} onReuse={reuseCapture} />
          ) : (
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-6 text-center">
                <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">What will we create today?</h1>
                <p className="mt-2 text-sm text-text-muted">Paste any public website, then direct every creative and delivery choice in chat.</p>
              </div>
              <ChatWidget key={newProjectKey} initialJobId={reuseJobId} initialMode={reuseMode} className="min-h-[620px]" onJobCreated={() => window.setTimeout(() => void refresh(), 1200)} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
