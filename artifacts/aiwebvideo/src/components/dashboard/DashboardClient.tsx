import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/app-button";
import { Wordmark } from "@/components/ui/Wordmark";
import { UserMenu, formatCredits } from "@/components/account/UserMenu";
import { CreditUpgradeNotice } from "@/components/account/CreditUpgradeNotice";
import { CreditPill, isLowBalance } from "@/components/account/CreditPill";
import { creditsBuyLines } from "@/lib/pricing";
import { CREDIT_DISPLAY_MULTIPLIER } from "@/lib/credits";
import { watchAuthState } from "@/lib/firebase/client";
import { deleteSavedChat, fetchMe, fetchUserJobs, fetchUserUsage, updateSavedChat, type UserJobSummary, type UserUsageSummary } from "@/lib/api-client";
import { type JobMode } from "@/components/chat/types";
import {
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Search,
  ShieldCheck,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { clearActiveJobId, setActiveJobId } from "@/lib/guestSession";

interface Me {
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
}

const ACTIVE_STATUSES = new Set(["queued", "capturing", "storyboarding", "rendering"]);

function relativeTime(value: string) {
  const date = new Date(value);
  const seconds = Math.max(1, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function statusLabel(status: string, progress: number) {
  if (status === "captured") return "Ready to continue";
  if (ACTIVE_STATUSES.has(status)) return `Running · ${Math.max(0, Math.min(100, Math.round(progress)))}%`;
  return status;
}

export function DashboardClient() {
  const [, navigate] = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [authSlow, setAuthSlow] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setAuthSlow(true), 4000); return () => window.clearTimeout(timer); }, []);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [usage, setUsage] = useState<UserUsageSummary | null>(null);
  // Opening /dashboard always starts on a clean default chat. A saved chat is
  // opened only when the URL explicitly names it (history click, refresh of an
  // active chat, or sign-in continuity). Never resurrect an arbitrary old job
  // just because it was the last id stored in localStorage.
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("job"),
  );
  const [composerJobId, setComposerJobId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newProjectKey, setNewProjectKey] = useState(0);
  const [reuseJobId, setReuseJobId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("reuse"),
  );
  const initialCreationIntent = useMemo<CreationIntent | undefined>(() => {
    const requested = new URLSearchParams(window.location.search).get("create");
    return requested === "website" ||
      requested === "video" ||
      requested === "photo" ||
      requested === "product-video" ||
      requested === "scenario" ||
      requested === "interior" ||
      requested === "architecture"
      ? requested
      : undefined;
  }, []);
  const [reuseMode, setReuseMode] = useState<JobMode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(window.localStorage.getItem("aiwebvideo_workspace_sidebar_width"));
    return Number.isFinite(saved) && saved >= 240 && saved <= 420 ? saved : 286;
  });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const restoreDashboardHistory = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedJobId(params.get("job"));
      setComposerJobId(null);
      setReuseJobId(params.get("reuse"));
      setReuseMode(null);
      setActionMenuId(null);
      setSidebarOpen(false);
    };
    window.addEventListener("popstate", restoreDashboardHistory);
    return () => window.removeEventListener("popstate", restoreDashboardHistory);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [account, history, usageSummary] = await Promise.all([fetchMe(), fetchUserJobs(), fetchUserUsage()]);
      setMe(account);
      setUsage(usageSummary);
      setJobs(Array.isArray(history.jobs) ? history.jobs.filter((job) => job && typeof job.id === "string") : []);
      setError(null);
    } catch {
      setError("We could not refresh your workspace. Please try again in a moment.");
    }
  }, []);

  useEffect(
    () =>
      watchAuthState((user) => {
        setIsSignedIn(!!user);
        setAuthChecked(true);
        if (user) void refresh();
      }),
    [refresh],
  );

  useEffect(() => {
    if (!isSignedIn) return;
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    if (checkout !== "success") return;
    // Credit grants are webhook/idempotency based. The payment
    // provider can redirect the browser a moment before its webhook reaches
    // this server, so refresh the account a few times instead of showing a
    // stale pre-purchase balance in Workspace.
    const delays = [0, 1500, 3500, 7000, 12000];
    const timers = delays.map((delay) => window.setTimeout(() => void refresh(), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [isSignedIn, refresh]);

  useEffect(() => {
    if (!isSignedIn) return;
    const hasRunningJob = jobs.some((job) => ACTIVE_STATUSES.has(job.status));
    const timer = window.setInterval(() => void refresh(), hasRunningJob ? 3_000 : 20_000);
    return () => window.clearInterval(timer);
  }, [isSignedIn, jobs, refresh]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || window.innerWidth >= 1024) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = sidebarOpen || startX <= 28;
    };
    const onEnd = (event: TouchEvent) => {
      if (!tracking || window.innerWidth >= 1024) return;
      const touch = event.changedTouches[0];
      tracking = false;
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (sidebarOpen && dx < 0) setSidebarOpen(false);
      else if (!sidebarOpen && startX <= 28 && dx > 0) setSidebarOpen(true);
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!actionMenuId) return;
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-chat-actions]")) return;
      setActionMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionMenuId]);

  const beginSidebarResize = (event: { clientX: number; preventDefault(): void }) => {
    if (window.innerWidth < 1024) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.max(240, Math.min(420, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(next);
      window.localStorage.setItem("aiwebvideo_workspace_sidebar_width", String(Math.round(next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const runningJobs = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)), [jobs]);

  const filteredJobs = useMemo(
    () => jobs
      .filter((job) => `${job.title} ${job.sourceUrl} ${job.mode} ${job.featureLabel ?? ""}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [jobs, query],
  );

  // A running project lives in the "Running now" card; the list below never repeats it.
  const recentJobs = useMemo(() => filteredJobs.filter((job) => !ACTIVE_STATUSES.has(job.status)), [filteredJobs]);

  const monthlyUsagePercent = useMemo(() => {
    const used = Math.max(0, usage?.thisMonth.creditsUsed ?? 0);
    const balance = Math.max(0, me?.creditsBalance ?? usage?.balance ?? 0);
    const total = used + balance;
    return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  }, [usage, me?.creditsBalance]);

  function startNew() {
    clearActiveJobId();
    setSelectedJobId(null);
    setComposerJobId(null);
    setReuseJobId(null);
    setReuseMode(null);
    navigate("/dashboard");
    setNewProjectKey((value) => value + 1);
    setSidebarOpen(false);
  }

  function registerComposerJob(jobId: string) {
    // The default composer becomes a real resumable chat only after it creates
    // its first backend job. Keep the current component mounted (so no UI
    // reset), but put the job id in the URL so refresh/back-to-workspace can
    // restore the exact conversation and live generation state.
    setComposerJobId(jobId);
    setActiveJobId(jobId);
    navigate(`/dashboard?job=${encodeURIComponent(jobId)}`, { replace: true });
    window.setTimeout(() => void refresh(), 500);
  }

  async function togglePin(item: UserJobSummary) {
    try {
      await updateSavedChat(item.id, { pinned: !item.pinned });
      setActionMenuId(null);
      await refresh();
    } catch {
      setError("We could not update that production. Please try again.");
    }
  }

  async function removeChat(item: UserJobSummary) {
    if (!window.confirm(`Delete “${item.title}” from your production history?`)) return;
    try {
      await deleteSavedChat(item.id);
      if ((selectedJobId ?? composerJobId) === item.id) startNew();
      setActionMenuId(null);
      await refresh();
    } catch {
      setError("We could not delete that production. Please try again.");
    }
  }

  function openProject(jobId: string) {
    setActiveJobId(jobId);
    setSelectedJobId(jobId);
    navigate(`/dashboard?job=${encodeURIComponent(jobId)}`);
    setSidebarOpen(false);
  }

  if (!authChecked)
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-bg px-6 text-center">
        <img src="/logo.svg" alt="" width={40} height={40} />
        <span className="page-loader-track" aria-hidden="true"><span /></span>
        {authSlow && (
          <div role="status" className="max-w-xs text-sm text-text-muted">
            <p>Still checking your account.</p>
            <p className="mt-1 text-[13px] text-text-dim">If you opened this inside another app, try Safari or Chrome.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
              <Button onClick={() => setShowAuthModal(true)}>Sign in</Button>
            </div>
          </div>
        )}
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSignedIn={() => { setShowAuthModal(false); void refresh(); }}
          />
        )}
      </div>
    );

  if (!isSignedIn)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-bg px-5">
        <div className="w-full max-w-sm text-center">
          <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-6 font-display text-2xl font-bold tracking-[-.03em] text-text-primary">Sign in to continue</h1>
          <p className="mt-2 text-[15px] text-text-muted">Your projects and credits are kept in your account.</p>
          <Button variant="primary" className="mt-7 w-full" onClick={() => setShowAuthModal(true)}>Sign in</Button>
          <Link href="/" className="mt-4 inline-block text-[14px] text-text-dim hover:text-white">Back to home</Link>
        </div>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSignedIn={() => {
              setShowAuthModal(false);
              void refresh();
            }}
          />
        )}
      </main>
    );

  const openJobId = selectedJobId ?? composerJobId;
  const openJob = openJobId ? jobs.find((job) => job.id === openJobId) ?? null : null;
  const balance = me?.creditsBalance;
  const low = isLowBalance(balance);
  // What the balance buys, in plain words (the server sends customer-facing credits; the price list works in internal ones).
  const buys = typeof balance === "number" ? creditsBuyLines(balance / CREDIT_DISPLAY_MULTIPLIER)[0] ?? null : null;
  const desktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  const projectRow = (item: UserJobSummary) => {
    const selected = openJobId === item.id;
    const running = ACTIVE_STATUSES.has(item.status);
    const percent = Math.max(0, Math.min(100, Math.round(item.progress)));
    return (
      <div key={item.id} className={`group relative rounded-xl transition-colors ${selected ? "bg-white/[.09]" : "hover:bg-white/[.05]"}`}>
        <a
          href={`/dashboard?job=${encodeURIComponent(item.id)}`}
          onClick={(event) => {
            // A real href keeps "open in new tab", middle-click and Cmd/Ctrl-click working. Only a plain click stays in-app.
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            openProject(item.id);
          }}
          aria-current={selected ? "true" : undefined}
          className="flex min-h-11 items-center gap-2.5 py-2 pl-2.5 pr-10"
        >
          {(item.previewUrl || item.screenshotUrl) ? (
            <img src={item.previewUrl || item.screenshotUrl || ""} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          ) : (
            <span className={`mx-[11px] h-1.5 w-1.5 shrink-0 rounded-full ${running ? "animate-pulse-soft bg-violet" : item.status === "failed" ? "bg-pink" : "bg-white/25"}`} aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {item.pinned && <Pin size={11} className="shrink-0 fill-gold text-gold" aria-label="Pinned" />}
              <span className="truncate text-[14px] text-text-primary">{item.title}</span>
            </span>
            {running ? (
              <span className="mt-1.5 flex items-center gap-2">
                <span className="credit-meter flex-1" role="progressbar" aria-label={`${item.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${Math.max(4, percent)}%` }} /></span>
                <span className="font-utility text-[11px] text-text-dim">{percent}%</span>
              </span>
            ) : item.status === "failed" ? (
              <span className="block text-[12px] text-pink">Didn't finish</span>
            ) : null}
          </span>
          {!running && <span className="shrink-0 text-[12px] text-text-dim group-hover:opacity-0 group-focus-within:opacity-0 max-sm:hidden">{relativeTime(item.updatedAt)}</span>}
        </a>
        <button
          data-chat-actions
          type="button"
          onClick={() => setActionMenuId((value) => (value === item.id ? null : item.id))}
          className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-lg text-text-dim opacity-100 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          aria-label={`Options for ${item.title}`}
        >
          <MoreHorizontal size={16} />
        </button>
        {actionMenuId === item.id && (
          <div data-chat-actions className="absolute right-1 top-full z-50 w-40 rounded-xl border border-white/10 bg-panel p-1 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
            <button type="button" onClick={() => void togglePin(item)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-[14px] text-text-muted hover:bg-white/[.06] hover:text-white">
              <Pin size={14} /> {item.pinned ? "Unpin" : "Pin"}
            </button>
            <button type="button" onClick={() => void removeChat(item)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-[14px] text-pink hover:bg-pink/10">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        id="workspace-project-menu"
        aria-label="Projects"
        style={desktop && !sidebarCollapsed ? { width: sidebarWidth } : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,300px)] shrink-0 flex-col border-r border-white/[.07] bg-sunken transition-transform duration-200 lg:relative lg:z-auto lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${sidebarCollapsed ? "lg:hidden" : ""}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between pl-4 pr-2">
          <Link href="/" aria-label="Home"><Wordmark /></Link>
          <button
            type="button"
            onClick={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) setSidebarCollapsed(true);
              else setSidebarOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-lg text-text-dim transition hover:bg-white/[.06] hover:text-white"
            aria-label="Close menu"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="px-2.5">
          <button type="button" onClick={startNew} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-[14px] font-medium text-text-primary transition hover:bg-white/[.06]">
            <SquarePen size={17} className="text-violet" /> New
          </button>
          <label className="relative mt-1 flex h-11 items-center rounded-xl px-2.5 text-text-dim transition focus-within:bg-white/[.05] hover:bg-white/[.05]">
            <Search size={16} className="shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search"
              aria-label="Search projects"
              className="h-full min-w-0 flex-1 bg-transparent pl-2.5 text-base text-text-primary outline-none placeholder:text-text-dim sm:text-[14px]"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="grid h-8 w-8 place-items-center rounded-lg hover:text-white" aria-label="Clear search"><X size={14} /></button>
            )}
          </label>
        </div>

        <div className="sidebar-scroll mt-3 flex-1 overflow-y-auto px-2.5 pb-3">
          {runningJobs.length > 0 && (
            <section aria-label="In progress" className="mb-4">
              <p className="px-2.5 pb-1.5 text-[12px] font-medium text-text-dim">In progress</p>
              <div className="space-y-0.5">{runningJobs.map(projectRow)}</div>
            </section>
          )}
          <p className="px-2.5 pb-1.5 text-[12px] font-medium text-text-dim">Recent</p>
          <div className="space-y-0.5">
            {recentJobs.map(projectRow)}
            {!recentJobs.length && (
              <p className="px-2.5 py-3 text-[14px] text-text-dim">
                {query ? "Nothing matches." : "What you make shows up here."}
              </p>
            )}
          </div>
        </div>

        {me && (
          <div className="shrink-0 space-y-1 border-t border-white/[.07] p-2.5">
            <div className={`rounded-2xl border p-3 ${low ? "border-gold/30 bg-gold/[.06]" : "border-white/[.08]"}`} data-testid="credit-card">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[14px] text-text-muted"><span className="font-utility text-[17px] font-semibold text-white">{formatCredits(balance)}</span> credits</p>
                {low && <span className="text-[12px] font-medium text-gold">Running low</span>}
              </div>
              <div className="credit-meter mt-2.5" data-low={low} role="progressbar" aria-label="Credits used this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={monthlyUsagePercent}>
                <span style={{ width: `${Math.max(3, 100 - monthlyUsagePercent)}%` }} />
              </div>
              <p className="mt-2 text-[12px] leading-4 text-text-dim">{buys ? `Enough for ${buys.split(" · ")[0]}` : "Not enough for a new creation"}</p>
              <Link
                href="/pricing#buy-credits"
                className={`mt-3 flex h-10 items-center justify-center rounded-full text-[14px] font-semibold transition ${low ? "bg-gold text-bg hover:brightness-105" : "bg-white/10 text-white hover:bg-white/15"}`}
              >
                Add credits
              </Link>
            </div>
            {me.isAdmin && (
              <Link href="/admin" className="flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[14px] text-text-muted transition hover:bg-white/[.06] hover:text-white">
                <ShieldCheck size={16} /> Admin
              </Link>
            )}
            <Link href="/profile" className="flex h-11 items-center gap-2.5 rounded-xl px-2.5 transition hover:bg-white/[.06]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] font-semibold text-white">{(me.email[0] ?? "?").toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-text-primary">{me.email}</span>
              </span>
              <span className="shrink-0 text-[12px] capitalize text-text-dim">{me.plan}</span>
            </Link>
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            type="button"
            aria-label="Resize sidebar"
            onPointerDown={beginSidebarResize}
            className="absolute -right-1 top-0 hidden h-full w-2 cursor-col-resize touch-none lg:block"
          />
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => { setSidebarOpen(true); setSidebarCollapsed(false); }}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-muted transition hover:bg-white/[.06] hover:text-white ${sidebarCollapsed ? "" : "lg:hidden"}`}
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              aria-controls="workspace-project-menu"
            >
              <PanelLeftOpen size={18} />
            </button>
            <button
              type="button"
              onClick={startNew}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-muted transition hover:bg-white/[.06] hover:text-white ${sidebarCollapsed ? "" : "lg:hidden"}`}
              aria-label="New"
            >
              <SquarePen size={18} />
            </button>
            {openJob && <p className="min-w-0 truncate pl-1 text-[15px] font-medium text-text-primary">{openJob.title}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {me && <CreditPill balance={me.creditsBalance} className="lg:hidden" />}
            {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
          </div>
        </header>

        <main className={`flex min-h-0 flex-1 flex-col ${openJobId ? "overflow-hidden" : "overflow-y-auto"}`}>
          {error && (
            <div className="mx-auto mb-3 mt-1 w-[calc(100%-1.5rem)] max-w-[760px] shrink-0 rounded-2xl border border-pink/25 bg-pink/[.07] px-4 py-3 text-[14px] text-text-primary" role="alert">
              {error}
            </div>
          )}
          {selectedJobId ? (
            <div className="flex h-full min-h-0 w-full flex-col">
              <ChatWidget
                key={selectedJobId}
                resumeJobId={selectedJobId}
                immersive
                className="h-full"
                onJobCreated={() => window.setTimeout(() => void refresh(), 1200)}
              />
            </div>
          ) : (
            <div className={composerJobId ? "flex h-full min-h-0 w-full flex-col" : "mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-3 pb-[12vh] pt-6 sm:px-5"}>
              {!composerJobId && (
                <h1 className="mb-7 text-center font-display text-[30px] font-bold leading-tight tracking-[-.035em] text-text-primary sm:text-[38px]">What are we making?</h1>
              )}
              <div id="workspace-creator" className={composerJobId ? "min-h-0 flex-1" : ""}>
                <ChatWidget
                  key={newProjectKey}
                  initialJobId={reuseJobId}
                  initialMode={reuseMode}
                  expandInitialPanel
                  initialCreationIntent={initialCreationIntent}
                  immersive
                  className={composerJobId ? "h-full min-h-0 w-full" : "w-full"}
                  onJobCreated={registerComposerJob}
                />
              </div>
              {!composerJobId && me && me.creditsBalance <= 0 && (
                <div className="mt-4">
                  <CreditUpgradeNotice plan={me.plan} creditsBalance={me.creditsBalance} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
