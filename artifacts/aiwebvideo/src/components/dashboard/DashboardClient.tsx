import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CreativePresets } from "@/components/landing/CreativePresets";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/app-button";
import { Wordmark } from "@/components/ui/Wordmark";
import { UserMenu, formatCredits } from "@/components/account/UserMenu";
import { GenerationHistoryButton } from "@/components/account/GenerationHistoryButton";
import { CreditUpgradeNotice } from "@/components/account/CreditUpgradeNotice";
import { watchAuthState } from "@/lib/firebase/client";
import { deleteSavedChat, fetchMe, fetchUserJobs, updateSavedChat, type UserJobSummary } from "@/lib/api-client";
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
      const [account, history] = await Promise.all([fetchMe(), fetchUserJobs()]);
      setMe(account);
      setJobs(Array.isArray(history.jobs) ? history.jobs.filter((job) => job && typeof job.id === "string") : []);
      setError(null);
    } catch {
      setError("We could not refresh the creator. Please try again in a moment.");
    }
  }, []);

  useEffect(
    () =>
      watchAuthState((user) => {
        setIsSignedIn(!!user);
        setAuthChecked(true);
        if (user) void refresh();
        else { setMe(null); setJobs([]); setError(null); }
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

  const runningJobs = useMemo(() => jobs.filter((job) => ACTIVE_STATUSES.has(job.status)), [jobs]);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => `${job.title} ${job.sourceUrl} ${job.mode} ${job.featureLabel ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [jobs, query],
  );

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
    if (isSignedIn) window.setTimeout(() => void refresh(), 500);
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" />
      </div>
    );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-bg/95 px-2.5 backdrop-blur-xl sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link href="/" className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet" aria-label="AiWebVideo home">
              <Wordmark />
            </Link>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {selectedJobId || composerJobId ? "Creative chat" : "New creation"}
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
              href={me && me.creditsBalance <= 0 ? "/pricing#buy-credits" : "/pricing"}
              className={`hidden rounded-full border px-3 py-1.5 text-xs sm:block ${me && me.creditsBalance <= 0 ? "border-violet/40 bg-violet/10 font-semibold text-violet hover:bg-violet/15" : "border-border bg-panel text-text-muted hover:text-text-primary"}`}
            >
              {me && me.creditsBalance <= 0 ? "Recharge credits" : `${formatCredits(me?.creditsBalance)} credits`}
            </Link>
            {me && <GenerationHistoryButton />}
            {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} isAdmin={me.isAdmin} />}
            {!isSignedIn && <Button onClick={() => setShowAuthModal(true)}>Sign in</Button>}
          </div>
        </header>

        <main
          className={`flex h-[calc(100dvh-3.5rem)] flex-col sm:h-[calc(100dvh-4rem)] ${selectedJobId || composerJobId ? "overflow-hidden" : "overflow-y-auto bg-[radial-gradient(#ffffff12_1px,transparent_1px)] bg-[size:28px_28px] p-2.5 sm:p-5 lg:p-6"}`}
        >
          {error && (
            <div className="mx-auto mb-4 w-full max-w-4xl shrink-0 rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-xs text-text-muted">
              {error}
            </div>
          )}
          {me && me.creditsBalance <= 0 && (
            <div className="mx-auto mb-4 w-full max-w-4xl shrink-0">
              <CreditUpgradeNotice plan={me.plan} creditsBalance={me.creditsBalance} />
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
            <div
              className={`mx-auto w-full ${composerJobId ? "flex h-full min-h-0 flex-col" : "max-w-6xl pb-5 sm:pb-8"}`}
            >
              {!composerJobId && (
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="font-display text-base font-semibold text-white sm:text-xl">Create</p>
                  </div>
                </div>
              )}

              <div id="creator" className={`scroll-mt-24 ${composerJobId ? "min-h-0 flex-1" : ""}`}>
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
              {!composerJobId && <CreativePresets inWorkspace />}
            </div>
          )}
        </main>
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
    </div>
  );
}
