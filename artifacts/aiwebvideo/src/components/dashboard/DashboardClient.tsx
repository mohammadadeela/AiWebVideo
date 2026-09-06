import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/app-button";
import { Wordmark } from "@/components/ui/Wordmark";
import { UserMenu, formatCredits } from "@/components/account/UserMenu";
import { CreditUpgradeNotice } from "@/components/account/CreditUpgradeNotice";
import { watchAuthState } from "@/lib/firebase/client";
import {
  deleteSavedChat,
  fetchMe,
  fetchUserJobs,
  updateSavedChat,
  type UserJobSummary,
} from "@/lib/api-client";
import { type JobMode } from "@/components/chat/types";
import {
  CircleUserRound,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  clearActiveJobId,
  setActiveJobId,
} from "@/lib/guestSession";

interface Me {
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
}

const ACTIVE_STATUSES = new Set([
  "queued",
  "capturing",
  "storyboarding",
  "rendering",
]);

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
  if (ACTIVE_STATUSES.has(status))
    return `Running · ${Math.max(0, Math.min(100, Math.round(progress)))}%`;
  return status;
}

export function DashboardClient() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
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
    return requested === "website" || requested === "video" || requested === "photo" || requested === "product-video" || requested === "scenario"
      ? requested
      : undefined;
  }, []);
  const [reuseMode, setReuseMode] = useState<JobMode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [account, history] = await Promise.all([
        fetchMe(),
        fetchUserJobs(),
      ]);
      setMe(account);
      setJobs(
        Array.isArray(history.jobs)
          ? history.jobs.filter((job) => job && typeof job.id === "string")
          : [],
      );
      setError(null);
    } catch {
      setError(
        "We could not refresh your workspace. Please try again in a moment.",
      );
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
    const timer = window.setInterval(
      () => void refresh(),
      hasRunningJob ? 3_000 : 20_000,
    );
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

  const runningJobs = useMemo(
    () => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)),
    [jobs],
  );

  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) =>
        `${job.title} ${job.sourceUrl} ${job.mode}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [jobs, query],
  );


  function startNew() {
    clearActiveJobId();
    setSelectedJobId(null);
    setComposerJobId(null);
    setReuseJobId(null);
    setReuseMode(null);
    window.history.replaceState({}, "", "/dashboard");
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
    window.history.replaceState({}, "", `/dashboard?job=${encodeURIComponent(jobId)}`);
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
    if (!window.confirm(`Delete “${item.title}” from your production history?`))
      return;
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
    window.history.replaceState(
      {},
      "",
      `/dashboard?job=${encodeURIComponent(jobId)}`,
    );
    setSidebarOpen(false);
  }

  if (!authChecked)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" />
      </div>
    );

  if (!isSignedIn)
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="max-w-md rounded-3xl border border-border bg-panel p-8 text-center">
          <img src="/logo.svg" alt="" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 font-display text-xl font-bold text-text-primary">
            Sign in to open your workspace
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Your projects, files, credits, and billing stay connected to your
            account.
          </p>
          <Button className="mt-6" onClick={() => setShowAuthModal(true)}>
            Sign in to workspace
          </Button>
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

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close project menu"
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-black/35 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="workspace-project-menu"
        aria-label="Workspace projects"
        className={`fixed bottom-2.5 left-2.5 top-[4.15rem] z-40 flex w-[min(82vw,292px)] max-w-[calc(100vw-3.25rem)] flex-col overflow-hidden rounded-[22px] border border-white/[.10] bg-[#100c20]/[.99] p-2.5 shadow-[0_28px_80px_-34px_rgba(0,0,0,.98)] backdrop-blur-2xl transition-[transform,opacity] duration-200 sm:left-3 sm:w-[300px] sm:p-3 lg:sticky lg:bottom-auto lg:left-auto lg:top-0 lg:h-screen lg:max-w-none lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:bg-[#100c20] lg:shadow-none lg:backdrop-blur-none ${sidebarOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-[115%] opacity-0 lg:pointer-events-auto lg:translate-x-0 lg:opacity-100"} ${sidebarCollapsed ? "lg:w-0 lg:overflow-hidden lg:border-0 lg:p-0" : "lg:w-[286px]"}`}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <Link href="/">
            <Wordmark />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.matchMedia("(min-width: 1024px)").matches) setSidebarCollapsed(true);
              else setSidebarOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[.06] bg-white/[.025] text-text-dim transition hover:bg-white/5 hover:text-text-primary active:scale-95 lg:h-10 lg:w-10 lg:border-0 lg:bg-transparent"
            aria-label="Close project menu"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="premium-button mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2.5 text-left text-[12px] font-semibold text-text-primary transition hover:bg-violet/15 active:scale-[.99] sm:mt-3 sm:py-3 sm:text-sm"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signature text-sm text-white">
            ＋
          </span>
          New creation
        </button>
        <div className="relative mt-3">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search projects"
            className="w-full rounded-xl border border-border bg-panel/70 py-2.5 pl-9 pr-9 text-base text-text-primary outline-none placeholder:text-text-dim focus:border-violet/50 sm:text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-text-dim hover:bg-white/5 hover:text-text-primary"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="chat-scroll mt-4 flex-1 overflow-y-auto">
          {runningJobs.length > 0 && (
            <div className="sticky top-0 z-10 mx-1 mb-3 space-y-1.5 rounded-xl border border-violet/25 bg-[#100c20] p-2 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-mint" />
                <p className="text-[11px] font-semibold text-text-primary">
                  {runningJobs.length} generation
                  {runningJobs.length === 1 ? "" : "s"} running
                </p>
              </div>
              {/* Always-visible and clickable — pinned to the top of the list
                  (even while scrolled) so a running job is never something
                  you have to go hunting for after switching chats. */}
              {runningJobs.map((job) => (
                <a
                  key={job.id}
                  href={`/dashboard?job=${encodeURIComponent(job.id)}`}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    openProject(job.id);
                  }}
                  className="block rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                >
                  <p className="truncate text-[11px] font-medium text-text-primary">
                    {job.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-signature transition-all"
                        style={{
                          width: `${Math.max(4, Math.min(100, job.progress))}%`,
                        }}
                      />
                    </span>
                    <span className="text-[9px] text-text-dim">
                      {Math.max(0, Math.min(100, Math.round(job.progress)))}%
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-text-dim">
            Recent projects
          </p>
          <div className="space-y-1">
            {filteredJobs.map((item) => (
              <div
                key={item.id}
                className={`group relative rounded-xl transition-colors ${(selectedJobId ?? composerJobId) === item.id ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                <a
                  href={`/dashboard?job=${encodeURIComponent(item.id)}`}
                  onClick={(event) => {
                    // A real href makes right-click → "open in new tab",
                    // middle-click, and Cmd/Ctrl-click work like any normal
                    // link. Only a plain left-click is intercepted for
                    // in-app SPA navigation.
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    openProject(item.id);
                  }}
                  className="block w-full px-3 py-2.5 pr-9 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.status === "done" ? "bg-mint" : item.status === "failed" ? "bg-pink" : "bg-violet animate-pulse-soft"}`}
                    />
                    {item.pinned && (
                      <Pin
                        size={11}
                        className="shrink-0 fill-violet text-violet"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-text-dim">
                      {relativeTime(item.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-3.5">
                    <p className="min-w-0 flex-1 truncate text-[10px] capitalize text-text-dim">
                      {item.mode} · {statusLabel(item.status, item.progress)}
                    </p>
                    {ACTIVE_STATUSES.has(item.status) && (
                      <span className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full bg-signature transition-all"
                          style={{
                            width: `${Math.max(4, Math.min(100, item.progress))}%`,
                          }}
                        />
                      </span>
                    )}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setActionMenuId((value) =>
                      value === item.id ? null : item.id,
                    )
                  }
                  className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-text-dim opacity-100 hover:bg-white/10 hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  aria-label={`Production options for ${item.title}`}
                >
                  <MoreHorizontal size={15} />
                </button>
                {actionMenuId === item.id && (
                  <div className="absolute right-2 top-10 z-50 w-44 rounded-xl border border-border bg-panel p-1.5 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => void togglePin(item)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-text-muted hover:bg-white/5 hover:text-text-primary"
                    >
                      <Pin size={14} />
                      {item.pinned ? "Unpin production" : "Pin production"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeChat(item)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-pink hover:bg-pink/10"
                    >
                      <Trash2 size={14} />
                      Delete production
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!filteredJobs.length && (
              <p className="px-3 py-6 text-center text-xs text-text-dim">
                {query
                  ? "No matching projects."
                  : "Your first project will appear here."}
              </p>
            )}
          </div>
        </div>
        {me && (
          <div className="mt-3 space-y-2">
            {me.isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-xl border border-violet/25 bg-violet/10 px-3 py-2.5 text-xs font-semibold text-violet transition hover:bg-violet/15"
              >
                <ShieldCheck size={15} />
                Admin control center
              </Link>
            )}
            <Link
              href="/profile"
              className="flex items-center gap-2.5 rounded-xl border border-border bg-panel/60 p-2.5 transition hover:bg-panel sm:gap-3 sm:p-3"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-panel-alt text-text-primary sm:h-9 sm:w-9">
                <CircleUserRound
                  size={19}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-text-primary">
                  {me.email}
                </span>
                <span className="block text-[10px] capitalize text-text-muted">
                  {me.plan} · {formatCredits(me.creditsBalance)} credits
                </span>
              </span>
              <span className="text-text-dim">›</span>
            </Link>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/95 px-2.5 backdrop-blur-xl sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setSidebarCollapsed(false);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-panel/60 text-text-muted shadow-[0_8px_22px_-18px_rgba(0,0,0,.9)] transition hover:text-text-primary active:scale-95 sm:h-10 sm:w-10 ${sidebarCollapsed ? "" : "lg:hidden"}`}
              aria-label="Open projects menu"
              aria-expanded={sidebarOpen}
              aria-controls="workspace-project-menu"
            >
              <PanelLeftOpen size={16} />
            </button>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {selectedJobId || composerJobId ? "Creative chat" : "New creation"}
              </p>
              <p className="hidden text-[10px] text-text-dim sm:block">
                AI video, product media and website campaigns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me?.isAdmin && (
              <Link
                href="/admin"
                className="hidden items-center gap-2 rounded-xl border border-violet/25 bg-violet/10 px-3 py-2 text-xs font-semibold text-violet transition hover:bg-violet/15 md:flex"
              >
                <ShieldCheck size={14} />
                Admin
              </Link>
            )}
            <Link
              href={
                me && me.creditsBalance <= 0
                  ? "/pricing#buy-credits"
                  : "/pricing"
              }
              className={`hidden rounded-full border px-3 py-1.5 text-xs sm:block ${me && me.creditsBalance <= 0 ? "border-violet/40 bg-violet/10 font-semibold text-violet hover:bg-violet/15" : "border-border bg-panel text-text-muted hover:text-text-primary"}`}
            >
              {me && me.creditsBalance <= 0
                ? "Recharge credits"
                : `${formatCredits(me?.creditsBalance)} credits`}
            </Link>
            {me && (
              <UserMenu
                email={me.email}
                plan={me.plan}
                creditsBalance={me.creditsBalance}
                isAdmin={me.isAdmin}
              />
            )}
          </div>
        </header>

        <main
          className={`flex h-[calc(100dvh-3.5rem)] flex-col p-2.5 sm:h-[calc(100dvh-4rem)] sm:p-5 lg:p-6 ${selectedJobId || composerJobId ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {error && (
            <div className="mx-auto mb-4 w-full max-w-4xl shrink-0 rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-xs text-text-muted">
              {error}
            </div>
          )}
          {me && me.creditsBalance <= 0 && (
            <div className="mx-auto mb-4 w-full max-w-4xl shrink-0">
              <CreditUpgradeNotice
                plan={me.plan}
                creditsBalance={me.creditsBalance}
              />
            </div>
          )}
          {selectedJobId ? (
            <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col">
              <ChatWidget
                key={selectedJobId}
                resumeJobId={selectedJobId}
                className="h-full"
                onJobCreated={() =>
                  window.setTimeout(() => void refresh(), 1200)
                }
              />
            </div>
          ) : (
            <div className={`mx-auto w-full ${composerJobId ? "flex h-full max-w-5xl min-h-0 flex-col" : "max-w-6xl pb-5 sm:pb-8"}`}>
              {!composerJobId && (
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="font-display text-base font-semibold text-white sm:text-xl">Create</p>
                    <p className="mt-0.5 hidden text-[11px] text-text-dim sm:block">Start with the website URL or choose another creation mode below.</p>
                  </div>
                </div>
              )}

              <div id="workspace-creator" className={`scroll-mt-24 ${composerJobId ? "min-h-0 flex-1" : ""}`}>
                <ChatWidget
                  key={newProjectKey}
                  initialJobId={reuseJobId}
                  initialMode={reuseMode}
                  expandInitialPanel
                  initialCreationIntent={initialCreationIntent}
                  className={composerJobId ? "h-full min-h-0 w-full" : "w-full"}
                  onJobCreated={registerComposerJob}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
