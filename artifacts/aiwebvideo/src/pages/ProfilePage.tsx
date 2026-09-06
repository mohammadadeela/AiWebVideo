import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  Activity,
  BarChart3,
  CalendarClock,
  CircleUserRound,
  CreditCard,
  FolderClock,
  Gauge,
  Image as ImageIcon,
  ReceiptText,
  ShieldCheck,
  Video,
  WalletCards,
} from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
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
  startTopup,
  ApiError,
  type SubscriptionSummary,
  type UserJobSummary,
  type UserUsageSummary,
  type BillingPaymentSummary,
} from "@/lib/api-client";
import { useSeo } from "@/lib/useSeo";

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
  return (usage?.byMode ?? [])
    .filter((item) => modes.includes(item.mode))
    .reduce((total, item) => total + item.count, 0);
}

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

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

  async function buyCredits() {
    setBusy(true);
    setError(null);
    try {
      window.location.href = (await startTopup()).checkoutUrl;
    } catch {
      setError(
        "Billing is temporarily unavailable. Your account and projects are unchanged; please try again shortly.",
      );
    } finally {
      setBusy(false);
    }
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

  return (
    <>
      <Nav />
      <main className="min-h-[72vh] border-b border-white/[.06] bg-bg">
        {!authChecked ? (
          <div
            className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent"
            role="status"
            aria-label="Loading account"
          />
        ) : !signedIn ? (
          <div className="mx-auto max-w-lg px-5 py-24 text-center">
            <div className="rounded-3xl border border-border bg-panel p-8">
              <CircleUserRound
                size={34}
                className="mx-auto text-violet"
                aria-hidden="true"
              />
              <h1 className="mt-5 font-display text-2xl font-bold text-text-primary">
                Sign in to view your account
              </h1>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Account, plan, billing, and production history are available
                after authentication.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button variant="primary" onClick={() => setShowAuthModal(true)}>Sign in</Button>
                <Button variant="secondary" className="w-full" asChild><Link href="/#generate">Return to AiWebVideo</Link></Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
            <header className="flex flex-col justify-between gap-5 border-b border-border pb-8 lg:flex-row lg:items-end">
              <div>
                <p className="font-utility text-[10px] font-semibold uppercase tracking-[.2em] text-mint">
                  Account center
                </p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-[-.035em] text-text-primary sm:text-4xl">
                  Account, plan and projects
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">
                  Review your production balance, recent work and billing from
                  one private account view.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {me?.isAdmin && (
                  <Button variant="secondary" asChild><Link href="/admin">Admin control center</Link></Button>
                )}
                <Button variant="primary" asChild><Link href="/dashboard">Open workspace</Link></Button>
              </div>
            </header>

            <nav
              aria-label="Account sections"
              className="chat-scroll -mx-1 flex gap-1 overflow-x-auto py-4"
            >
              {[
                ["Overview", "#overview"],
                ["Plan & credits", "#plan"],
                ["Usage", "#usage"],
                ["Billing", "#billing"],
                ["Recent projects", "#projects"],
                ["Security", "#security"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted transition hover:bg-white/5 hover:text-text-primary"
                >
                  {label}
                </a>
              ))}
            </nav>

            {error && (
              <div
                className="mb-5 rounded-xl border border-pink/20 bg-pink/5 px-4 py-3 text-sm text-text-muted"
                role="alert"
              >
                {error}
              </div>
            )}

            <div id="overview" className="grid scroll-mt-24 gap-5 lg:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-3xl border border-border bg-panel p-6 sm:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-violet/25 bg-violet/10 text-text-primary">
                    <CircleUserRound size={34} strokeWidth={1.6} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-dim">Signed in as</p>
                    <h2 className="mt-1 truncate font-display text-lg font-semibold text-text-primary sm:text-xl">
                      {me?.email}
                    </h2>
                    <p className="mt-1 text-xs capitalize text-text-muted">
                      {me?.plan} plan
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid grid-cols-3 divide-x divide-border border-y border-border py-5">
                  {[
                    ["Projects", stats.total],
                    ["Completed", stats.completed],
                    ["Active", stats.active],
                  ].map(([label, value]) => (
                    <div key={label} className="px-2 text-center">
                      <p className="font-utility text-xl font-semibold text-text-primary sm:text-2xl">
                        {value}
                      </p>
                      <p className="mt-1 text-[10px] text-text-dim">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard"
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-bg/25 p-4 transition hover:border-violet/30 hover:bg-white/[.035]"
                  >
                    <FolderClock size={18} className="text-violet" aria-hidden="true" />
                    <span>
                      <span className="block text-xs font-semibold text-text-primary">Production workspace</span>
                      <span className="mt-1 block text-[10px] text-text-dim">History, active jobs and results</span>
                    </span>
                  </Link>
                  <Link
                    href="/pricing"
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-bg/25 p-4 transition hover:border-mint/30 hover:bg-white/[.035]"
                  >
                    <Gauge size={18} className="text-mint" aria-hidden="true" />
                    <span>
                      <span className="block text-xs font-semibold text-text-primary">Usage & pricing</span>
                      <span className="mt-1 block text-[10px] text-text-dim">Track activity or compare production options</span>
                    </span>
                  </Link>
                </div>
              </section>

              <section id="plan" className="scroll-mt-24 rounded-3xl border border-border bg-panel p-6 sm:p-7">
                <div className="flex items-center gap-2 text-text-dim">
                  <WalletCards size={16} aria-hidden="true" />
                  <p className="text-xs font-semibold uppercase tracking-[.14em]">Plan & credits</p>
                </div>
                <div className="mt-5 border-b border-border pb-5">
                  <p className="text-sm capitalize text-text-muted">{me?.plan} plan</p>
                  <p className="mt-2 font-utility text-4xl font-bold text-text-primary">
                    {formatCredits(me?.creditsBalance)}
                  </p>
                  <p className="mt-1 text-xs text-text-dim">available production credits</p>
                </div>
                <p className="mt-5 text-xs leading-5 text-text-muted">
                  The workspace checks the required production balance before a paid generation starts. Failed paid renders use the existing credit-restoration flow.
                </p>
                <Button variant="secondary" className="mt-5 w-full" asChild><Link href="/pricing">Compare plans and credit use</Link></Button>
              </section>
            </div>

            <section id="usage" className="mt-5 scroll-mt-24 rounded-3xl border border-border bg-panel p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet/20 bg-violet/10 text-violet">
                    <BarChart3 size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-text-primary">Usage</h2>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      See what you used this month without exposing internal provider costs.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-mint/20 bg-mint/[.06] px-3 py-2 text-left sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-text-dim">Current balance</p>
                  <p className="mt-0.5 font-utility text-lg font-bold text-mint">{formatCredits(usage?.balance ?? me?.creditsBalance)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Credits used", value: formatCredits(usage?.thisMonth.creditsUsed), icon: Activity },
                  { label: "Credits added", value: formatCredits(usage?.thisMonth.creditsAdded), icon: WalletCards },
                  { label: "Projects", value: usage?.thisMonth.projects ?? 0, icon: FolderClock },
                  { label: "Completed", value: usage?.thisMonth.completed ?? 0, icon: ShieldCheck },
                  { label: "Videos", value: usage?.thisMonth.videos ?? 0, icon: Video },
                  { label: "Photos", value: usage?.thisMonth.photos ?? 0, icon: ImageIcon },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div key={metric.label} className="min-w-0 rounded-2xl border border-border bg-bg/25 p-3 sm:p-4">
                      <MetricIcon size={15} className="text-text-dim" aria-hidden="true" />
                      <p className="mt-3 truncate font-utility text-lg font-semibold text-text-primary">{metric.value}</p>
                      <p className="mt-1 text-[10px] leading-4 text-text-dim">{metric.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[.82fr_1.18fr]">
                <div className="rounded-2xl border border-border bg-bg/25 p-4">
                  <p className="text-xs font-semibold text-text-primary">This month</p>
                  <div className="mt-3 space-y-2 text-xs text-text-muted">
                    <div className="flex items-center justify-between gap-3">
                      <span>Amount paid</span>
                      <span className="font-utility font-semibold text-text-primary">${(usage?.thisMonth.amountPaidUsd ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Website video</span>
                      <span className="font-utility text-text-primary">{modeCount(usage, "website", "website_video")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>AI video</span>
                      <span className="font-utility text-text-primary">{modeCount(usage, "ai_video")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Product photos / video</span>
                      <span className="font-utility text-text-primary">{modeCount(usage, "product_photo", "product_photos", "product_video")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Talking scenes</span>
                      <span className="font-utility text-text-primary">{modeCount(usage, "talking_scene")}</span>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-border bg-bg/25 p-4">
                  <div className="flex items-center gap-2">
                    <ReceiptText size={15} className="text-text-dim" aria-hidden="true" />
                    <p className="text-xs font-semibold text-text-primary">Recent credit activity</p>
                  </div>
                  <div className="mt-3 divide-y divide-border">
                    {(usage?.recentCredits ?? []).slice(0, 6).map((item) => (
                      <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-text-primary">{item.reason || "Credit activity"}</p>
                          <p className="mt-0.5 text-[10px] text-text-dim">{formatAccountDate(item.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 font-utility text-xs font-semibold ${item.delta >= 0 ? "text-mint" : "text-text-muted"}`}>
                          {item.delta >= 0 ? "+" : ""}{formatCredits(item.delta)}
                        </span>
                      </div>
                    ))}
                    {!usage?.recentCredits?.length && (
                      <p className="py-6 text-center text-xs text-text-dim">No credit activity yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section id="billing" className="mt-5 scroll-mt-24 rounded-3xl border border-border bg-panel p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div className="flex max-w-2xl items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                    <CreditCard size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-text-primary">Billing & renewal</h2>
                    <p className="mt-1 text-xs leading-5 text-text-muted">
                      Monthly plans renew automatically until you cancel. PayPal securely handles the recurring payment method; AiWebVideo never stores your full card number.
                    </p>
                  </div>
                </div>
                <Button variant="secondary" disabled={busy} onClick={() => void buyCredits()}>
                  Buy credits
                </Button>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="rounded-2xl border border-border bg-bg/25 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold capitalize text-text-primary">{subscription.plan} plan</p>
                        <p className="mt-1 text-[10px] capitalize text-text-dim">{subscription.status.replaceAll("_", " ")}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        subscription.autoRenew
                          ? "border-mint/20 bg-mint/[.06] text-mint"
                          : "border-border bg-white/[.025] text-text-muted"
                      }`}>
                        {subscription.autoRenew ? "Auto-renew on" : "Auto-renew off"}
                      </span>
                    </div>

                    {subscription.lastPaymentFailedAt && (
                      <div className="mt-4 rounded-xl border border-pink/20 bg-pink/[.06] px-3 py-2.5 text-xs leading-5 text-text-muted">
                        A renewal payment needs attention. PayPal may retry it automatically; check your payment method if the issue continues.
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-border bg-panel/60 p-3">
                        <CalendarClock size={14} className="text-text-dim" aria-hidden="true" />
                        <p className="mt-2 text-[10px] text-text-dim">{subscription.autoRenew ? "Next billing" : "Access through"}</p>
                        <p className="mt-1 text-xs font-semibold text-text-primary">{formatAccountDate(subscription.currentPeriodEnd)}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-panel/60 p-3">
                        <ShieldCheck size={14} className="text-text-dim" aria-hidden="true" />
                        <p className="mt-2 text-[10px] text-text-dim">Payment</p>
                        <p className="mt-1 text-xs font-semibold text-text-primary">Managed by PayPal</p>
                      </div>
                    </div>

                    {subscription.autoRenew && (
                      <Button variant="ghost" className="mt-4 w-full sm:w-auto" disabled={busy} onClick={() => void stopRenewal(subscription.id)}>
                        Cancel automatic renewal
                      </Button>
                    )}
                  </div>
                ))}
                {!subscriptions.length && (
                  <div className="rounded-2xl border border-dashed border-border bg-bg/20 p-5 lg:col-span-2">
                    <p className="text-sm font-semibold text-text-primary">No active monthly plan</p>
                    <p className="mt-1 text-xs leading-5 text-text-muted">You can use credit packs or start a monthly plan from Pricing.</p>
                    <Button variant="ghost" className="mt-3" asChild><Link href="/pricing">View pricing</Link></Button>
                  </div>
                )}
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <ReceiptText size={16} className="text-text-dim" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-text-primary">Billing history</h3>
                </div>
                <p className="mt-1 text-xs text-text-muted">Receipts and renewal invoices are also sent to your account email.</p>
                <div className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                  {payments.slice(0, 12).map((payment) => (
                    <div key={payment.id} className="flex min-w-0 flex-col gap-2 bg-bg/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-text-primary">{billingKindLabel(payment.kind)}</p>
                        <p className="mt-1 truncate text-[10px] text-text-dim">
                          {formatAccountDate(payment.createdAt)} · {payment.reference}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold capitalize ${
                          payment.status === "paid" ? "border-mint/15 bg-mint/[.06] text-mint" : "border-pink/15 bg-pink/[.06] text-pink"
                        }`}>{payment.status}</span>
                        <span className="text-[10px] text-text-muted">{formatCredits(payment.creditsGranted)} credits</span>
                        <span className="font-utility text-xs font-semibold text-text-primary">${payment.amountUsd.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {!payments.length && <p className="bg-bg/20 px-4 py-7 text-center text-xs text-text-dim">No billing history yet.</p>}
                </div>
              </div>
            </section>

            <section id="projects" className="mt-5 scroll-mt-24 rounded-3xl border border-border bg-panel p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-text-primary">Recent projects</h2>
                  <p className="mt-1 text-xs text-text-muted">Your latest saved production history.</p>
                </div>
                <Link href="/dashboard" className="text-xs font-semibold text-violet transition hover:text-mint">
                  View all
                </Link>
              </div>
              <div className="mt-4 divide-y divide-border">
                {jobs.slice(0, 6).map((job) => (
                  <Link
                    key={job.id}
                    href={`/dashboard?job=${encodeURIComponent(job.id)}`}
                    className="flex min-h-16 items-center gap-4 py-3"
                  >
                    <div className="h-11 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-panel-alt">
                      {job.screenshotUrl && (
                        <img
                          src={job.screenshotUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">{job.title}</p>
                      <p className="mt-1 text-xs capitalize text-text-dim">{job.mode} · {job.status}</p>
                    </div>
                    <span className="text-text-dim" aria-hidden="true">›</span>
                  </Link>
                ))}
                {!jobs.length && (
                  <div className="py-10 text-center">
                    <p className="text-sm font-semibold text-text-primary">No projects yet</p>
                    <p className="mt-1 text-xs text-text-dim">Your first production will appear here.</p>
                    <Button variant="ghost" className="mt-3" asChild><Link href="/dashboard">Create your first project</Link></Button>
                  </div>
                )}
              </div>
            </section>

            <section id="security" className="mt-5 scroll-mt-24 rounded-3xl border border-border bg-panel p-6 sm:p-7">
              <div className="flex max-w-3xl items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-text-primary">Account access</h2>
                  <p className="mt-1 text-xs leading-5 text-text-muted">
                    Sessions use secure browser cookies. On a shared device, sign out from the account menu when you finish.
                  </p>
                </div>
              </div>
              {me?.supportsPasswordChange ? (
                <form onSubmit={updatePassword} className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-text-muted sm:col-span-2">
                    Account email
                    <input
                      name="username" type="email" autoComplete="username" readOnly value={me.email}
                      className="mt-1.5 w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base font-normal text-text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
                    />
                  </label>
                  <label className="text-xs font-semibold text-text-muted sm:col-span-2">
                    Current password
                    <input
                      name="current-password" type="password" autoComplete="current-password" required maxLength={128}
                      value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base font-normal text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
                    />
                  </label>
                  <label className="text-xs font-semibold text-text-muted">
                    New password
                    <input
                      name="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                      value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base font-normal text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
                    />
                  </label>
                  <label className="text-xs font-semibold text-text-muted">
                    Confirm new password
                    <input
                      name="new-password-confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                      value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-base font-normal text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <p className="text-xs leading-5 text-text-dim">Your browser or Google Password Manager can save the updated password. You cannot reuse your current or five most recent passwords.</p>
                    {passwordNotice && <p className="mt-2 text-xs text-mint" role="status">{passwordNotice}</p>}
                    <Button type="submit" variant="secondary" className="mt-4" disabled={passwordBusy}>
                      {passwordBusy ? "Updating…" : "Change password"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-5 max-w-3xl text-xs leading-5 text-text-muted">
                  This account signs in through {me?.authProvider === "google" ? "Google" : me?.authProvider || "an external provider"}. Manage its password with that provider.
                </p>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
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
