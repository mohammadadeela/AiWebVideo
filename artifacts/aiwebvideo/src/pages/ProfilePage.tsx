import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ChevronRight, CircleUserRound } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
import { SavedCardsPanel } from "@/components/account/SavedCardsPanel";
import { PurchaseModal } from "@/components/billing/PurchaseModal";
import { formatCredits } from "@/components/account/UserMenu";
import { watchAuthState } from "@/lib/firebase/client";
import {
  fetchMe,
  fetchSubscriptions,
  fetchUserJobs,
  fetchUserUsage,
  fetchBillingHistory,
  cancelSubscription,
  changePassword,
  ApiError,
  type SubscriptionSummary,
  type UserJobSummary,
  type UserUsageSummary,
  type BillingPaymentSummary,
} from "@/lib/api-client";
import { useSeo } from "@/lib/useSeo";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

interface Me {
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
  authProvider: string;
  supportsPasswordChange: boolean;
}

const ACTIVE_STATUSES = new Set([
  "queued",
  "capturing",
  "storyboarding",
  "rendering",
]);

function formatAccountDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function billingKindLabel(kind: string) {
  if (kind === "subscription_initial") return "Plan started";
  if (kind === "subscription_renewal") return "Plan renewal";
  if (kind === "credit_topup" || kind === "one_time") return "Credit purchase";
  return kind.replaceAll("_", " ");
}

function modeCount(usage: UserUsageSummary | null, ...modes: string[]) {
  return (Array.isArray(usage?.byMode) ? usage.byMode : [])
    .filter((item) => modes.includes(item.mode))
    .reduce((total, item) => total + item.count, 0);
}

type ProfileTab = "usage" | "projects" | "billing" | "security";
const PROFILE_TABS: Array<[ProfileTab, string]> = [
  ["usage", "Usage"],
  ["projects", "Projects"],
  ["billing", "Billing"],
  ["security", "Security"],
];

function tabFromHash(): ProfileTab {
  if (typeof window === "undefined") return "usage";
  const hash = window.location.hash.replace("#", "");
  return PROFILE_TABS.some(([id]) => id === hash) ? (hash as ProfileTab) : "usage";
}

const INPUT_CLASS =
  "mt-1.5 w-full rounded-xl border border-white/[.09] bg-white/[.04] px-3.5 py-3 text-base font-normal text-text-primary outline-none transition focus:border-violet/60 focus:ring-4 focus:ring-violet/10";

export function ProfilePage() {
  useSeo({
    title: "Your account",
    description: "Manage your AiWebVideo account, plan, and credits.",
    path: "/profile",
    noindex: true,
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([]);
  const [usage, setUsage] = useState<UserUsageSummary | null>(null);
  const [payments, setPayments] = useState<BillingPaymentSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTopupCheckout, setShowTopupCheckout] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>(() => tabFromHash());

  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function selectTab(next: ProfileTab) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  useEffect(
    () =>
      watchAuthState((user) => {
        setSignedIn(!!user);
        setAuthChecked(true);
        if (!user) return;
        void Promise.all([fetchMe(), fetchUserJobs(), fetchSubscriptions(), fetchUserUsage(), fetchBillingHistory()])
          .then(([account, history, billing, accountUsage, billingHistory]) => {
            setMe(account);
            setJobs(Array.isArray(history.jobs) ? history.jobs : []);
            setSubscriptions(Array.isArray(billing.subscriptions) ? billing.subscriptions : []);
            setUsage(accountUsage);
            setPayments(Array.isArray(billingHistory.payments) ? billingHistory.payments : []);
          })
          .catch(() =>
            setError("We could not load your account details right now."),
          );
      }),
    [],
  );

  const stats = useMemo(
    () => ({
      total: jobs.length,
      completed: jobs.filter((job) => job.status === "done").length,
      active: jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length,
    }),
    [jobs],
  );

  const monthlyUsagePercent = useMemo(() => {
    const used = Math.max(0, usage?.thisMonth.creditsUsed ?? 0);
    const balance = Math.max(0, usage?.balance ?? me?.creditsBalance ?? 0);
    const total = used + balance;
    return total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  }, [usage, me?.creditsBalance]);

  function buyCredits() {
    setError(null);
    setShowTopupCheckout(true);
  }

  async function stopRenewal(subscriptionId: string) {
    setBusy(true);
    setError(null);
    try {
      await cancelSubscription(subscriptionId);
      setSubscriptions((current) => current.map((subscription) =>
        subscription.id === subscriptionId
          ? { ...subscription, autoRenew: false, status: "cancelled" }
          : subscription,
      ));
    } catch {
      setError("We could not cancel automatic renewal. No account details were changed; please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPasswordNotice(null);
    if (newPassword.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordNotice("Password updated. Other signed-in devices have been logged out.");
    } catch (changeError) {
      if (changeError instanceof ApiError && changeError.code === "INVALID_CURRENT_PASSWORD") {
        setError("Your current password is incorrect.");
      } else if (changeError instanceof ApiError && changeError.code === "PASSWORD_REUSED") {
        setError("Choose a password you have not used recently.");
      } else {
        setError(changeError instanceof ApiError ? changeError.message : "We could not update your password. Please try again.");
      }
    } finally {
      setPasswordBusy(false);
    }
  }

  const balance = usage?.balance ?? me?.creditsBalance;
  const used = usage?.thisMonth.creditsUsed;
  const nearLimit = monthlyUsagePercent >= 85;
  const modeChips = [
    ["Website video", modeCount(usage, "website", "website_video")],
    ["AI video", modeCount(usage, "ai_video")],
    ["Product", modeCount(usage, "product_photo", "product_photos", "product_video")],
    ["Talking scene", modeCount(usage, "talking_scene")],
  ].filter(([, count]) => Number(count) > 0);

  return (
    <>
      <Nav />
      <main className="cinematic-page min-h-[72vh] border-b border-white/[.06] bg-bg">
        {!authChecked ? (
          <div className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" role="status" aria-label="Loading account" />
        ) : !signedIn ? (
          <div className="mx-auto max-w-md px-5 py-24 text-center">
            <CircleUserRound size={36} className="mx-auto text-violet" aria-hidden="true" />
            <h1 className="mt-5 font-display text-2xl font-bold text-text-primary">Sign in to see your account</h1>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="primary" onClick={() => setShowAuthModal(true)}>Sign in</Button>
              <Button variant="secondary" asChild><Link href="/#generate">Back to AiWebVideo</Link></Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <header className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet to-pink font-display text-lg font-bold uppercase text-white">
                {me?.email?.[0] ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-lg font-bold text-text-primary sm:text-xl">{me?.email}</h1>
                <p className="mt-0.5 text-xs capitalize text-text-muted">{me?.plan} plan</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {me?.isAdmin && <Button variant="ghost" size="sm" asChild><Link href="/admin">Admin</Link></Button>}
                <Button variant="primary" size="sm" asChild><Link href="/dashboard">Workspace</Link></Button>
              </div>
            </header>

            {error && (
              <div className="mt-5 rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-sm text-text-muted" role="alert">{error}</div>
            )}

            <section className="mt-6 rounded-[28px] border border-white/[.08] bg-gradient-to-br from-violet/[.14] via-panel to-panel p-5 sm:p-6" aria-label="Credits">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-text-muted">Credits available</p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none tracking-tight text-text-primary sm:text-5xl">{formatCredits(balance)}</p>
                </div>
                <Button variant="primary" onClick={buyCredits} disabled={busy}>Add credits</Button>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-text-muted">{formatCredits(used)} used this month</span>
                  <span className={`font-utility font-semibold ${nearLimit ? "text-pink" : "text-violet"}`}>{monthlyUsagePercent}%</span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.08]"
                  role="progressbar"
                  aria-label="Monthly credit usage"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={monthlyUsagePercent}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${nearLimit ? "bg-gradient-to-r from-gold to-pink" : "bg-signature"}`}
                    style={{ width: `${monthlyUsagePercent}%` }}
                  />
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Projects", usage?.thisMonth.projects ?? stats.total],
                  ["Videos", usage?.thisMonth.videos ?? 0],
                  ["Photos", usage?.thisMonth.photos ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-black/20 py-3">
                    <dd className="font-utility text-lg font-semibold text-text-primary">{value}</dd>
                    <dt className="mt-0.5 text-[11px] text-text-dim">{label} this month</dt>
                  </div>
                ))}
              </dl>
            </section>

            <div role="tablist" aria-label="Account sections" className="mt-6 grid grid-cols-4 gap-1 rounded-2xl bg-white/[.04] p-1">
              {PROFILE_TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  onClick={() => selectTab(id)}
                  className={`min-h-10 rounded-xl px-2 text-xs font-semibold transition ${tab === id ? "bg-white text-[#1b1030] shadow" : "text-text-muted hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
              {tab === "usage" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["Used", formatCredits(usage?.thisMonth.creditsUsed)],
                      ["Added", formatCredits(usage?.thisMonth.creditsAdded)],
                      ["Paid", `$${(usage?.thisMonth.amountPaidUsd ?? 0).toFixed(2)}`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white/[.04] px-3 py-3.5">
                        <p className="font-utility text-lg font-semibold text-text-primary">{value}</p>
                        <p className="mt-0.5 text-[11px] text-text-dim">{label} this month</p>
                      </div>
                    ))}
                  </div>

                  {modeChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {modeChips.map(([label, count]) => (
                        <span key={label} className="rounded-full bg-white/[.05] px-3 py-1.5 text-xs text-text-muted">
                          {label} <span className="font-semibold text-text-primary">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-semibold text-text-muted">Recent activity</p>
                    <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl bg-white/[.03]">
                      {(usage?.recentCredits ?? []).slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-text-primary">{item.reason || "Credit activity"}</p>
                            <p className="text-[11px] text-text-dim">{formatAccountDate(item.createdAt)}</p>
                          </div>
                          <span className={`shrink-0 font-utility text-sm font-semibold ${item.delta >= 0 ? "text-mint" : "text-text-muted"}`}>
                            {item.delta >= 0 ? "+" : ""}{formatCredits(item.delta)}
                          </span>
                        </div>
                      ))}
                      {!usage?.recentCredits?.length && <p className="px-4 py-8 text-center text-sm text-text-dim">No activity yet.</p>}
                    </div>
                  </div>
                </div>
              )}

              {tab === "projects" && (
                <div>
                  <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl bg-white/[.03]">
                    {jobs.slice(0, 8).map((job) => (
                      <Link key={job.id} href={`/dashboard?job=${encodeURIComponent(job.id)}`} className="flex min-h-[64px] items-center gap-3.5 px-3.5 py-2.5 transition hover:bg-white/[.04]">
                        <div className="h-11 w-16 shrink-0 overflow-hidden rounded-xl bg-panel-alt">
                          {job.screenshotUrl && <img src={job.screenshotUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-text-primary">{job.title}</p>
                          <p className="mt-0.5 text-[11px] capitalize text-text-dim">{job.featureLabel || job.mode} · {job.status.replaceAll("_", " ")}</p>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-text-dim" aria-hidden="true" />
                      </Link>
                    ))}
                    {!jobs.length && (
                      <div className="px-4 py-10 text-center">
                        <p className="text-sm text-text-dim">No projects yet.</p>
                        <Button variant="primary" size="sm" className="mt-3" asChild><Link href="/dashboard">Create one</Link></Button>
                      </div>
                    )}
                  </div>
                  {jobs.length > 8 && (
                    <Link href="/dashboard" className="mt-3 block text-center text-xs font-semibold text-violet transition hover:text-mint">View all {jobs.length} projects</Link>
                  )}
                </div>
              )}

              {tab === "billing" && (
                <div className="space-y-5">
                  {subscriptions.length ? subscriptions.map((subscription) => (
                    <div key={subscription.id} className="rounded-2xl bg-white/[.04] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold capitalize text-text-primary">{subscription.plan} plan</p>
                          <p className="mt-0.5 text-xs text-text-muted">
                            {subscription.autoRenew ? "Renews" : "Ends"} {formatAccountDate(subscription.currentPeriodEnd)}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscription.autoRenew ? "bg-mint/10 text-mint" : "bg-white/[.06] text-text-muted"}`}>
                          {subscription.autoRenew ? "Active" : "Cancelled"}
                        </span>
                      </div>
                      {subscription.lastPaymentFailedAt && (
                        <p className="mt-3 rounded-xl bg-pink/[.08] px-3 py-2 text-xs text-pink">The last renewal payment failed. Check your PayPal payment method.</p>
                      )}
                      {subscription.autoRenew && (
                        <button type="button" disabled={busy} onClick={() => void stopRenewal(subscription.id)} className="mt-3 text-xs font-semibold text-text-muted underline-offset-4 transition hover:text-pink hover:underline disabled:opacity-50">
                          Cancel renewal
                        </button>
                      )}
                    </div>
                  )) : (
                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[.04] px-4 py-3.5">
                      <p className="text-sm text-text-muted">No monthly plan</p>
                      <Button variant="secondary" size="sm" asChild><Link href="/pricing">See plans</Link></Button>
                    </div>
                  )}

                  <SavedCardsPanel />

                  <div>
                    <p className="mb-1 text-xs font-semibold text-text-muted">History</p>
                    <div className="divide-y divide-white/[.06] overflow-hidden rounded-2xl bg-white/[.03]">
                      {payments.slice(0, 12).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-text-primary">{billingKindLabel(payment.kind)}</p>
                            <p className="text-[11px] text-text-dim">{formatAccountDate(payment.createdAt)} · {formatCredits(payment.creditsGranted)} credits</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-utility text-sm font-semibold text-text-primary">${payment.amountUsd.toFixed(2)}</p>
                            {payment.status !== "paid" && <p className="text-[11px] capitalize text-pink">{payment.status}</p>}
                          </div>
                        </div>
                      ))}
                      {!payments.length && <p className="px-4 py-8 text-center text-sm text-text-dim">No payments yet.</p>}
                    </div>
                  </div>
                </div>
              )}

              {tab === "security" && (
                me?.supportsPasswordChange ? (
                  <form onSubmit={updatePassword} className="space-y-3 rounded-2xl bg-white/[.04] p-4 sm:p-5">
                    <input name="username" type="email" autoComplete="username" readOnly value={me.email} className="sr-only" tabIndex={-1} aria-hidden="true" />
                    <label className="block text-xs font-semibold text-text-muted">
                      Current password
                      <input name="current-password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={INPUT_CLASS} />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-text-muted">
                        New password
                        <input name="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={INPUT_CLASS} />
                      </label>
                      <label className="block text-xs font-semibold text-text-muted">
                        Confirm
                        <input name="new-password-confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className={INPUT_CLASS} />
                      </label>
                    </div>
                    {passwordNotice && <p className="text-xs text-mint" role="status">{passwordNotice}</p>}
                    <Button type="submit" variant="primary" disabled={passwordBusy}>{passwordBusy ? "Updating…" : "Update password"}</Button>
                  </form>
                ) : (
                  <p className="rounded-2xl bg-white/[.04] px-4 py-4 text-sm text-text-muted">
                    You sign in with {me?.authProvider === "google" ? "Google" : me?.authProvider || "an external provider"}. Manage your password there.
                  </p>
                )
              )}
            </div>

            <p className="mt-10 text-center text-xs text-text-dim">
              Need help? <a href={SUPPORT_MAILTO} className="font-semibold text-violet transition hover:text-mint">{SUPPORT_EMAIL}</a>
            </p>
          </div>
        )}
      </main>
      <Footer />
      {showTopupCheckout && (
        <PurchaseModal
          title="Add credits"
          summary={`You have ${formatCredits(balance)} credits`}
          funded={Number(balance ?? 0)}
          required={0}
          videoTabLabel="One video"
          onClose={() => setShowTopupCheckout(false)}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignedIn={() => {
            setShowAuthModal(false);
            window.location.assign("/dashboard");
          }}
        />
      )}
    </>
  );
}
