import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Link } from 'wouter';
import { Activity, AlertTriangle, CheckCircle2, Clock3, CreditCard, Database, DollarSign, FileVideo, KeyRound, LayoutDashboard, MailCheck, ReceiptText, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, UserRoundCog, Users, Upload, Save, GalleryVerticalEnd, Plus, Trash2, X, type LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import { Switch } from '@/components/ui/switch';
import { Wordmark } from '@/components/ui/Wordmark';
import {
  fetchAdminAudit, fetchAdminJobs, fetchAdminOverview, fetchAdminUsers, fetchAdminUserDetails, fetchMe,
  saveAdminSettings, updateAdminJob, updateAdminUser, saveMarketingSettings, uploadMarketingAsset,
  type AdminSettings, type MarketingSettings,
} from '@/lib/api-client';
import { watchAuthState } from '@/lib/firebase/client';
import { useSeo } from '@/lib/useSeo';

type Tab = 'overview' | 'landing' | 'users' | 'jobs' | 'providers' | 'audit';
type Row = Record<string, unknown>;
type MetricCard = [label: string, value: string, icon: ComponentType<LucideProps>, hint: string];
const LANDING_VIDEO_LIMIT = 30;
const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'landing', label: 'Landing videos', icon: GalleryVerticalEnd },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'jobs', label: 'Productions', icon: FileVideo },
  { id: 'providers', label: 'AI & controls', icon: SlidersHorizontal },
  { id: 'audit', label: 'Audit log', icon: ShieldCheck },
];
function number(value: unknown) { return Number(value ?? 0); }
function text(value: unknown) { return String(value ?? '—'); }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleString() : '—'; }
function statusClass(value: unknown) {
  const status = String(value);
  if (['done', 'active'].includes(status)) return 'bg-mint/10 text-mint';
  if (['failed', 'suspended', 'cancelled'].includes(status)) return 'bg-pink/10 text-pink';
  return 'bg-violet/10 text-violet';
}

function VideoCostMatrix({ rows }: { rows: Row[] }) {
  return <section className="rounded-3xl border border-border bg-panel p-5">
    <div><h2 className="font-semibold text-text-primary">Every customer video length · provider cost and exact credits</h2><p className="text-xs text-text-dim">Every whole-second duration from 8 seconds to 2 minutes 24 seconds. Customer credits are fixed product pricing and stay consistent with Smart Settings and the server quote.</p></div>
    <div className="mt-4 max-h-[520px] overflow-auto rounded-2xl border border-border">
      <table className="w-full min-w-[1060px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-panel-alt text-text-dim"><tr><th className="p-3">Length</th><th>Continuous ops</th><th>Fast 1080p</th><th>Fast 4K</th><th>Standard 1080p</th><th>Standard 4K</th><th>Customer 1080p</th><th>Customer 4K</th><th className="pr-3">Extras</th></tr></thead>
        <tbody className="divide-y divide-border">{rows.map((row) => <tr key={number(row.seconds)}><td className="p-3 font-semibold text-text-primary">{number(row.seconds) >= 60 ? `${Math.floor(number(row.seconds) / 60)}m ${number(row.seconds) % 60}s` : `${number(row.seconds)}s`}</td><td className="text-text-muted">{number(row.continuousOperations)}</td><td className="text-mint">${number(row.geminiFast1080Usd).toFixed(2)}</td><td className="text-mint">${number(row.geminiFast4kUsd).toFixed(2)}</td><td className="text-text-muted">${number(row.geminiStandard1080Usd).toFixed(2)}</td><td className="text-text-muted">${number(row.geminiStandard4kUsd).toFixed(2)}</td><td className="font-utility text-text-primary">{number(row.userCredits1080)} credits</td><td className="font-utility text-text-primary">{number(row.userCredits4k)} credits</td><td className="pr-3 text-text-dim">Voice +{number(row.narrationCredits)} · Video+photos +{number(row.videoAndPhotosExtraCredits)}</td></tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function authLabel(value: unknown) {
  const provider = String(value ?? 'unknown').toLowerCase();
  if (provider === 'email') return 'Email / password';
  if (provider === 'google') return 'Google';
  if (provider === 'github') return 'GitHub';
  if (provider === 'facebook') return 'Facebook';
  if (provider === 'firebase') return 'Firebase social';
  return 'Unknown / legacy';
}

function UserRow({
  user, isSelf, isOnlyAdmin, busy, creditDraft, onCreditDraftChange, onSaveCredits,
  onChangePlan, onToggleStatus, onToggleAdmin, onViewJobs, onViewDetails,
}: {
  user: Row;
  isSelf: boolean;
  isOnlyAdmin: boolean;
  busy: boolean;
  creditDraft: string;
  onCreditDraftChange: (value: string) => void;
  onSaveCredits: () => void;
  onChangePlan: (plan: string) => void;
  onToggleStatus: () => void;
  onToggleAdmin: (next: boolean) => void;
  onViewJobs: () => void;
  onViewDetails: () => void;
}) {
  const currentBalance = number(user.credits_balance);
  const creditsDirty = creditDraft !== '' && Number(creditDraft) !== currentBalance && !Number.isNaN(Number(creditDraft));
  const isAdmin = Boolean(user.is_admin);
  const isActive = text(user.account_status) === 'active';
  const verified = Boolean(user.email_verified);
  const adminDisabled = busy || (isSelf && isAdmin) || (isOnlyAdmin && isAdmin);
  const adminDisabledReason = isSelf && isAdmin ? 'You cannot remove your own administrator access.' : isOnlyAdmin && isAdmin ? 'This is the last administrator — promote another user first.' : undefined;
  const statusDisabled = busy || (isSelf && isActive);
  const statusDisabledReason = isSelf && isActive ? 'You cannot suspend your own account.' : undefined;
  const subscriptionStatus = user.subscription_status ? text(user.subscription_status) : null;
  const subscriptionProvider = user.subscription_provider ? text(user.subscription_provider) : null;

  return (
    <tr className="align-top hover:bg-white/[.02]">
      <td className="p-4">
        <div className="min-w-60">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onViewDetails} className="max-w-72 truncate text-left font-semibold text-text-primary hover:text-violet hover:underline">
              {text(user.email)}
            </button>
            {isSelf && <span className="rounded-full bg-violet/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet">You</span>}
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${verified ? 'bg-mint/10 text-mint' : 'bg-amber-300/10 text-amber-200'}`}>
              {verified ? 'Verified' : 'Unverified'}
            </span>
          </div>
          <p className="mt-1 font-utility text-[8px] text-text-dim">{text(user.id)}</p>
          <button type="button" onClick={onViewDetails} className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-violet hover:underline">
            <UserRoundCog size={11} /> Full account details
          </button>
        </div>
      </td>
      <td className="py-4 pr-4">
        <div className="min-w-32 space-y-1.5">
          <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-semibold ${isAdmin ? 'bg-violet/15 text-violet' : 'bg-white/[.05] text-text-muted'}`}>{isAdmin ? 'Administrator' : 'Customer'}</span>
          <p className="text-[10px] font-semibold text-text-primary">{authLabel(user.auth_provider)}</p>
          <p className="text-[9px] text-text-dim">Last sign-in: {date(user.last_sign_in_at)}</p>
        </div>
      </td>
      <td className="py-4 pr-4">
        <div className="min-w-40">
          <select value={text(user.plan)} disabled={busy} onChange={(event) => onChangePlan(event.target.value)} className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 capitalize text-text-muted">
            <option>free</option><option>creator</option><option>pro</option><option>agency</option>
          </select>
          {subscriptionStatus ? (
            <div className="mt-2 text-[9px] leading-4 text-text-dim">
              <p><span className="font-semibold text-text-primary">{subscriptionProvider ?? 'billing'}</span> · {subscriptionStatus}</p>
              <p>{user.subscription_plan ? `${text(user.subscription_plan)} subscription` : 'Subscription'}</p>
              {Boolean(user.subscription_period_end) && <p>Renews/ends {date(user.subscription_period_end)}</p>}
            </div>
          ) : <p className="mt-2 text-[9px] text-text-dim">No subscription</p>}
          <p className="mt-1 text-[9px] font-semibold text-mint">${number(user.lifetime_paid_usd).toFixed(2)} lifetime paid</p>
        </div>
      </td>
      <td className="py-4 pr-4">
        <div className="min-w-44">
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0" value={creditDraft === '' ? currentBalance : creditDraft}
              disabled={busy}
              onChange={(event) => onCreditDraftChange(event.target.value)}
              className="w-24 rounded-lg border border-border bg-bg px-2 py-1.5 text-text-primary"
            />
            {creditsDirty && (
              <button type="button" disabled={busy} onClick={onSaveCredits} title="Save credit balance" className="rounded-lg border border-mint/30 bg-mint/10 px-2 py-1.5 text-[9px] font-semibold text-mint hover:bg-mint/20 disabled:opacity-50">
                Save
              </button>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-text-dim">
            <span>Purchased <b className="text-text-muted">{number(user.credits_purchased)}</b></span>
            <span>Spent <b className="text-text-muted">{number(user.credits_used)}</b></span>
            <span>Refunded <b className="text-text-muted">{number(user.credits_refunded)}</b></span>
            <span>Added <b className="text-text-muted">{number(user.credits_added)}</b></span>
          </div>
        </div>
      </td>
      <td className="py-4 pr-4">
        <button type="button" onClick={onViewJobs} className="min-w-40 rounded-xl border border-border bg-bg/40 p-2.5 text-left hover:border-violet/30">
          <p className="font-semibold text-text-primary">{number(user.job_count)} total</p>
          <p className="mt-1 text-[9px] text-text-dim">{number(user.completed_jobs)} done · {number(user.running_jobs)} running · {number(user.failed_jobs)} failed</p>
        </button>
      </td>
      <td className="py-4 pr-4">
        <button
          type="button" disabled={statusDisabled} title={statusDisabledReason}
          onClick={onToggleStatus}
          className={`min-w-24 rounded-full px-2.5 py-1 text-[9px] font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${statusClass(user.account_status)} ${statusDisabled ? '' : 'hover:brightness-110'}`}
        >
          {isActive ? 'Active' : 'Suspended'}
        </button>
      </td>
      <td className="py-4 pr-4">
        <div className="flex min-w-24 items-center gap-2" title={adminDisabledReason}>
          <Switch checked={isAdmin} disabled={adminDisabled} onCheckedChange={onToggleAdmin} />
          <span className="text-[10px] font-semibold text-text-muted">{isAdmin ? 'Admin' : 'User'}</span>
        </div>
      </td>
      <td className="py-4 pr-4 text-text-dim"><div className="min-w-32"><p>{date(user.created_at)}</p><p className="mt-1 text-[9px]">Updated {date(user.updated_at)}</p></div></td>
    </tr>
  );
}

function UserDetailsModal({ details, loading, onClose }: { details: { user: Row; subscriptions: Row[]; payments: Row[]; credits: Row[]; productions: Row[] } | null; loading: boolean; onClose: () => void }) {
  const user = details?.user ?? {};
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="my-6 w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#120d23] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-[#120d23]/95 px-5 py-4 backdrop-blur-xl">
          <div><p className="font-utility text-[9px] uppercase tracking-[.16em] text-violet">User management</p><h2 className="mt-1 font-display text-xl font-bold text-text-primary">{loading ? 'Loading account…' : text(user.email)}</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-muted hover:bg-white/5 hover:text-white"><X size={17} /></button>
        </div>
        {loading ? <div className="flex min-h-72 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div> : details && (
          <div className="space-y-5 p-5">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['Role', Boolean(user.is_admin) ? 'Administrator' : 'Customer', UserRoundCog],
                ['Authentication', authLabel(user.auth_provider), KeyRound],
                ['Plan', text(user.plan), CreditCard],
                ['Credits', `${number(user.credits_balance)} balance`, DollarSign],
              ] as Array<[string, string, ComponentType<LucideProps>]>).map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-border bg-panel p-4"><Icon size={16} className="text-violet" /><p className="mt-3 text-[9px] uppercase tracking-wider text-text-dim">{label}</p><p className="mt-1 text-sm font-semibold capitalize text-text-primary">{value}</p></div>)}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-panel p-4">
                <div className="flex items-center gap-2"><MailCheck size={16} className="text-mint" /><h3 className="font-semibold text-text-primary">Account</h3></div>
                <dl className="mt-4 grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-xs"><dt className="text-text-dim">Email</dt><dd className="break-all text-text-primary">{text(user.email)}</dd><dt className="text-text-dim">Email verified</dt><dd className={Boolean(user.email_verified) ? 'text-mint' : 'text-amber-200'}>{Boolean(user.email_verified) ? 'Yes' : 'No'}</dd><dt className="text-text-dim">Account status</dt><dd className="capitalize text-text-primary">{text(user.account_status)}</dd><dt className="text-text-dim">Last sign-in</dt><dd className="text-text-primary">{date(user.last_sign_in_at)}</dd><dt className="text-text-dim">Joined</dt><dd className="text-text-primary">{date(user.created_at)}</dd><dt className="text-text-dim">User ID</dt><dd className="break-all font-utility text-[10px] text-text-muted">{text(user.id)}</dd></dl>
              </div>
              <div className="rounded-2xl border border-border bg-panel p-4">
                <div className="flex items-center gap-2"><CreditCard size={16} className="text-violet" /><h3 className="font-semibold text-text-primary">Subscriptions</h3></div>
                <div className="mt-4 space-y-2">{details.subscriptions.map((sub) => <div key={text(sub.id)} className="rounded-xl border border-border bg-bg/40 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold capitalize text-text-primary">{text(sub.plan)} · {text(sub.provider)}</p><span className={`rounded-full px-2 py-1 text-[9px] ${statusClass(sub.status)}`}>{text(sub.status)}</span></div><p className="mt-2 text-[10px] text-text-dim">Auto renew: {Boolean(sub.auto_renew) ? 'Yes' : 'No'} · Period end: {date(sub.current_period_end)}</p></div>)}{!details.subscriptions.length && <p className="py-6 text-center text-xs text-text-dim">No subscriptions.</p>}</div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                <div className="flex items-center gap-2 border-b border-border p-4"><ReceiptText size={16} className="text-mint" /><h3 className="font-semibold text-text-primary">Payments</h3></div>
                <div className="max-h-72 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-panel-alt text-text-dim"><tr><th className="p-3">Date</th><th>Provider</th><th>Type</th><th>Amount</th><th>Credits</th><th>Status</th></tr></thead><tbody className="divide-y divide-border">{details.payments.map((payment) => <tr key={text(payment.id)}><td className="p-3 text-text-dim">{date(payment.created_at)}</td><td className="capitalize text-text-muted">{text(payment.provider)}</td><td className="text-text-muted">{text(payment.kind).replaceAll('_',' ')}</td><td className="font-semibold text-text-primary">${number(payment.amount_usd).toFixed(2)}</td><td className="text-text-muted">{number(payment.credits_granted)}</td><td className="capitalize text-text-muted">{text(payment.status)}</td></tr>)}</tbody></table>{!details.payments.length && <p className="p-6 text-center text-xs text-text-dim">No payments.</p>}</div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                <div className="flex items-center gap-2 border-b border-border p-4"><DollarSign size={16} className="text-violet" /><h3 className="font-semibold text-text-primary">Credit history</h3></div>
                <div className="max-h-72 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="sticky top-0 bg-panel-alt text-text-dim"><tr><th className="p-3">Date</th><th>Change</th><th>Reason</th><th>Job</th></tr></thead><tbody className="divide-y divide-border">{details.credits.map((credit) => <tr key={text(credit.id)}><td className="p-3 text-text-dim">{date(credit.created_at)}</td><td className={`font-utility font-semibold ${number(credit.delta) >= 0 ? 'text-mint' : 'text-pink'}`}>{number(credit.delta) >= 0 ? '+' : ''}{number(credit.delta)}</td><td className="max-w-64 truncate text-text-muted" title={text(credit.reason)}>{text(credit.reason)}</td><td className="font-utility text-[9px] text-text-dim">{credit.job_id ? text(credit.job_id).slice(0,8) : '—'}</td></tr>)}</tbody></table>{!details.credits.length && <p className="p-6 text-center text-xs text-text-dim">No credit transactions.</p>}</div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-panel">
              <div className="flex items-center gap-2 border-b border-border p-4"><Clock3 size={16} className="text-gold" /><h3 className="font-semibold text-text-primary">Recent productions</h3></div>
              <div className="max-h-80 overflow-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="sticky top-0 bg-panel-alt text-text-dim"><tr><th className="p-3">Created</th><th>Production</th><th>Mode</th><th>Status</th><th>Credits</th><th>Provider cost</th></tr></thead><tbody className="divide-y divide-border">{details.productions.map((job) => <tr key={text(job.id)}><td className="p-3 text-text-dim">{date(job.created_at)}</td><td className="max-w-72 truncate font-semibold text-text-primary">{text(job.title || job.source_url)}</td><td className="capitalize text-text-muted">{text(job.mode)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] ${statusClass(job.status)}`}>{text(job.status)}</span></td><td className="text-text-muted">{number(job.credits_spent)}</td><td className="text-text-muted">${number(job.generation_cost_usd).toFixed(3)}</td></tr>)}</tbody></table>{!details.productions.length && <p className="p-6 text-center text-xs text-text-dim">No productions.</p>}</div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPage() {
  useSeo({ title: 'Admin', description: 'AiWebVideo admin console.', path: '/admin', noindex: true });
  const [tab, setTab] = useState<Tab>('overview');
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Row | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(25);
  const [adminCount, setAdminCount] = useState(0);
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'creator' | 'pro' | 'agency'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [authFilter, setAuthFilter] = useState<'all' | 'email' | 'google' | 'github' | 'facebook' | 'firebase' | 'unknown'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [userSummary, setUserSummary] = useState<Row>({});
  const [pendingSignups, setPendingSignups] = useState<Row[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const usersRequestId = useRef(0);
  const [userDetails, setUserDetails] = useState<{ user: Row; subscriptions: Row[]; payments: Row[]; credits: Row[]; productions: Row[] } | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [creditDrafts, setCreditDrafts] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [marketing, setMarketing] = useState<MarketingSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatus, setJobStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const data = await fetchAdminOverview();
    setOverview(data);
    setSettings({ operations: data.operations });
    setMarketing(data.marketing as MarketingSettings);
    setDirty(false);
  }, []);
  const loadUsers = useCallback(async () => {
    const requestId = ++usersRequestId.current;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await fetchAdminUsers({ search: userSearch, page: usersPage, plan: planFilter, role: roleFilter, status: statusFilter, auth: authFilter, verified: verifiedFilter });
      if (requestId !== usersRequestId.current) return;
      if (!Array.isArray(result.users)) throw new Error('The server returned an invalid users response.');
      const pageSize = Math.max(1, Number(result.pageSize) || 25);
      const total = Math.max(0, Number(result.total) || 0);
      const lastPage = Math.max(1, Math.ceil(total / pageSize));
      if (usersPage > lastPage) {
        setUsersPage(lastPage);
        return;
      }
      setUsers(result.users);
      setUsersTotal(total);
      setUsersPageSize(pageSize);
      setAdminCount(Number(result.adminCount) || 0);
      setUserSummary(result.summary ?? {});
      setPendingSignups(Array.isArray(result.pendingSignups) ? result.pendingSignups : []);
    } catch (error) {
      if (requestId !== usersRequestId.current) return;
      const detail = error instanceof Error ? error.message : 'Unknown server error.';
      setUsersError(`Users could not be loaded. ${detail}`);
      throw error;
    } finally {
      if (requestId === usersRequestId.current) setUsersLoading(false);
    }
  }, [userSearch, usersPage, planFilter, roleFilter, statusFilter, authFilter, verifiedFilter]);
  const loadJobs = useCallback(async () => setJobs((await fetchAdminJobs(jobStatus, jobSearch)).jobs), [jobStatus, jobSearch]);
  const loadAudit = useCallback(async () => setAudit((await fetchAdminAudit()).events), []);

  useEffect(() => watchAuthState((user) => {
    if (!user) { setChecked(true); setAllowed(false); return; }
    void fetchMe().then((me) => {
      setAllowed(me.isAdmin);
      setMeId(me.id);
      setChecked(true);
      if (me.isAdmin) void loadOverview().catch((error) => setMessage(error instanceof Error ? error.message : 'The overview could not be loaded.'));
    }).catch(() => { setAllowed(false); setChecked(true); });
  }), [loadOverview]);

  // Any filter or search change should reset back to page 1 — otherwise a
  // narrower filter can land the admin on a now-empty page.
  useEffect(() => { setUsersPage(1); }, [userSearch, planFilter, roleFilter, statusFilter, authFilter, verifiedFilter]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => {
      if (tab === 'users') void loadUsers().catch(() => undefined);
      if (tab === 'jobs') void loadJobs();
      if (tab === 'audit') void loadAudit();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [allowed, tab, loadUsers, loadJobs, loadAudit]);

  const providerStatus = (overview?.providerStatus ?? {}) as {
    geminiApiKey?: boolean;
    cloudinary?: boolean;
    checkout?: { configured?: boolean; environment?: 'sandbox' | 'live'; connection?: 'not_checked' | 'ready' | 'credentials_rejected' | 'unavailable' };
    queues?: Array<{ key: string; kind: string; model: string; rpm: number; concurrency: number; waiting: number; active: number; blockedForMs: number }>;
  };
  const userStats = (overview?.users ?? {}) as Row;
  const jobStats = (overview?.jobs ?? {}) as Row;
  const usage = (overview?.usage ?? {}) as Row;
  const recentJobs = (overview?.recentJobs ?? []) as Row[];
  const costBreakdown = (overview?.costBreakdown ?? []) as Row[];
  const videoCostMatrix = (overview?.videoCostMatrix ?? []) as Row[];
  const userFiltersActive = Boolean(userSearch || planFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all' || authFilter !== 'all' || verifiedFilter !== 'all');
  const costCatalog = (overview?.costCatalog ?? {}) as {
    text?: { inputToken?: number; outputToken?: number };
    video?: Record<string, number>;
    image?: Record<string, number>;
    ttsAudioSecond?: number;
  };

  async function refresh() {
    setBusy(true); setMessage(null);
    try {
      if (tab === 'users') await loadUsers();
      else if (tab === 'jobs') await loadJobs();
      else if (tab === 'audit') await loadAudit();
      else await loadOverview();
    } catch { setMessage('The control center could not refresh. Check the server connection.'); }
    finally { setBusy(false); }
  }

  async function saveSettings() {
    if (!settings) return;
    setBusy(true); setMessage(null);
    try { await saveAdminSettings(settings); await loadOverview(); setMessage('Runtime controls saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Settings could not be saved.'); }
    finally { setBusy(false); }
  }

  async function saveLanding() {
    if (!marketing) return;
    setBusy(true); setMessage(null);
    try { const saved = await saveMarketingSettings(marketing); setMarketing(saved); setDirty(false); setMessage('Landing videos and text are live.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Landing content could not be saved.'); }
    finally { setBusy(false); }
  }

  async function uploadLandingFile(index: number, file: File, target: 'url' | 'posterUrl') {
    if (!marketing) return;
    setBusy(true); setMessage(`Uploading ${target === 'url' ? 'video' : 'poster'}…`);
    try {
      const uploaded = await uploadMarketingAsset(file);
      const next: MarketingSettings = {
        ...marketing,
        videos: {
          showcase: marketing.videos.showcase.map((video, i) => i === index ? { ...video, [target]: uploaded.url } : video),
        },
      };
      // Publish the upload immediately. This avoids the confusing state where
      // the file exists on disk but is missing from the landing page because
      // the administrator forgot a second Save click.
      const saved = await saveMarketingSettings(next);
      setMarketing(saved);
      setDirty(false);
      setMessage('Landing video uploaded and published.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }

  async function uploadLandingFiles(files: File[]) {
    if (!marketing || files.length === 0) return;
    const room = Math.max(0, LANDING_VIDEO_LIMIT - marketing.videos.showcase.filter((video) => video.url).length);
    const accepted = files.slice(0, room);
    if (!accepted.length) {
      setMessage(`The landing gallery already contains the maximum of ${LANDING_VIDEO_LIMIT} videos.`);
      return;
    }
    setBusy(true);
    setMessage(`Uploading 1 of ${accepted.length} videos…`);
    try {
      const urls: string[] = [];
      for (let index = 0; index < accepted.length; index += 1) {
        setMessage(`Uploading ${index + 1} of ${accepted.length} videos…`);
        const uploaded = await uploadMarketingAsset(accepted[index]);
        if (uploaded.kind !== 'video') throw new Error(`${accepted[index].name} is not a supported video.`);
        urls.push(uploaded.url);
      }

      const showcase = marketing.videos.showcase.map((video) => ({ ...video }));
      for (const url of urls) {
        const emptyIndex = showcase.findIndex((video) => !video.url);
        if (emptyIndex >= 0) {
          showcase[emptyIndex] = { ...showcase[emptyIndex], url };
        } else {
          showcase.push({
            id: `upload-${Date.now()}-${showcase.length + 1}`,
            url,
            posterUrl: null,
            caption: null,
            overlayText: null,
            eyebrow: null,
          });
        }
      }

      const next: MarketingSettings = { ...marketing, videos: { showcase: showcase.slice(0, LANDING_VIDEO_LIMIT) } };
      const saved = await saveMarketingSettings(next);
      setMarketing(saved);
      setDirty(false);
      const skipped = files.length - accepted.length;
      setMessage(`${accepted.length} landing video${accepted.length === 1 ? '' : 's'} uploaded and published${skipped ? ` · ${skipped} skipped because the gallery reached ${LANDING_VIDEO_LIMIT}` : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The videos could not be uploaded.');
    } finally {
      setBusy(false);
    }
  }

  async function editUser(user: Row, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }) {
    setBusy(true); setMessage(null);
    try {
      await updateAdminUser(text(user.id), patch);
      await Promise.all([loadUsers(), loadOverview()]);
      if (userDetailsOpen && text(userDetails?.user.id) === text(user.id)) {
        const details = await fetchAdminUserDetails(text(user.id));
        setUserDetails(details);
      }
      if (patch.creditsBalance !== undefined) setCreditDrafts((current) => { const next = { ...current }; delete next[text(user.id)]; return next; });
      setMessage('User account updated.');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'User could not be updated.'); }
    finally { setBusy(false); }
  }

  function viewUserJobs(user: Row) {
    setJobSearch(text(user.email));
    setTab('jobs');
  }

  function clearUserFilters() {
    setUserSearch('');
    setPlanFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setAuthFilter('all');
    setVerifiedFilter('all');
    setUsersPage(1);
  }

  async function openUserDetails(user: Row) {
    setUserDetailsOpen(true);
    setUserDetailsLoading(true);
    setUserDetails(null);
    try {
      const details = await fetchAdminUserDetails(text(user.id));
      setUserDetails(details);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'User details could not be loaded.');
      setUserDetailsOpen(false);
    } finally {
      setUserDetailsLoading(false);
    }
  }

  if (!checked) return <div className="flex min-h-screen items-center justify-center bg-bg"><div className="h-9 w-9 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div>;
  if (!allowed) return <main className="flex min-h-screen items-center justify-center bg-bg px-5"><div className="max-w-md rounded-3xl border border-border bg-panel p-8 text-center"><ShieldCheck size={38} className="mx-auto text-violet" /><h1 className="mt-4 font-display text-2xl font-bold text-text-primary">Administrator access only</h1><p className="mt-2 text-sm text-text-muted">This protected control center is available only to approved administrator accounts.</p><Button className="mt-6" asChild><Link href="/dashboard">Return to workspace</Link></Button></div></main>;

  return <div className="min-h-screen bg-bg lg:flex">
    <aside className="border-b border-border bg-[#100c20] p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between"><Link href="/"><Wordmark /></Link><span className="rounded-full bg-violet/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-violet">Admin</span></div>
      <nav className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${tab === item.id ? 'bg-violet/15 text-text-primary' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}><item.icon size={16} />{item.label}</button>)}</nav>
      <Link href="/dashboard" className="mt-4 block rounded-xl border border-border px-3 py-2.5 text-center text-xs text-text-muted hover:text-text-primary lg:hidden">← User workspace</Link>
      <div className="mt-6 hidden rounded-2xl border border-border bg-panel/60 p-4 lg:block"><p className="text-xs font-semibold text-text-primary">Protected controls</p><p className="mt-1 text-[10px] leading-relaxed text-text-dim">Gemini credentials stay server-side. This page shows readiness only, never secret values.</p></div>
      <Link href="/dashboard" className="mt-4 hidden rounded-xl border border-border px-3 py-2.5 text-center text-xs text-text-muted hover:text-text-primary lg:block">← User workspace</Link>
    </aside>

    <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
      <header className="sticky top-3 z-30 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-bg/90 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">Operations</p><h1 className="mt-1 font-display text-2xl font-bold text-text-primary sm:text-3xl">Admin control center</h1><p className="mt-1 text-sm text-text-muted">Users, productions, Gemini costs, availability, and safety controls.</p></div><div className="flex gap-2">{tab === 'landing' && <Button disabled={busy || !dirty} onClick={() => void saveLanding()}><Save size={15} /> {dirty ? 'Save landing page' : 'Saved'}</Button>}{tab === 'providers' && <Button disabled={busy} onClick={() => void saveSettings()}><Save size={15} /> Save controls</Button>}<Button variant="secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Refresh</Button></div></header>
      {message && <div className="mt-5 rounded-xl border border-violet/25 bg-violet/10 px-4 py-3 text-sm text-text-muted">{message}</div>}

      {tab === 'overview' && <div className="mt-7 space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
          ['Total users', number(userStats.total), Users, 'All registered accounts'],
          ['Running jobs', number(jobStats.running), Activity, 'Live productions'],
          ['Completed', number(jobStats.done), CheckCircle2, 'Successful deliveries'],
          ['Month cost', `$${number(usage.cost).toFixed(2)}`, DollarSign, `${number(usage.credits).toFixed(0)} customer credits used`],
        ] as MetricCard[]).map(([label, value, Icon, hint]) => <div key={label} className="rounded-2xl border border-border bg-panel p-5"><div className="flex items-center justify-between"><p className="text-xs text-text-muted">{label}</p><Icon size={17} className="text-violet" /></div><p className="mt-3 font-utility text-2xl font-bold text-text-primary">{value}</p><p className="mt-1 text-[10px] text-text-dim">{hint}</p></div>)}</section>
        <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-3xl border border-border bg-panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-text-primary">Recent productions</h2><p className="text-xs text-text-dim">Latest activity across all users</p></div><button onClick={() => setTab('jobs')} className="text-xs font-semibold text-violet">View all</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-text-dim"><tr><th className="pb-3">Project</th><th>User</th><th>Status</th><th>Provider</th><th>Cost</th></tr></thead><tbody className="divide-y divide-border">{recentJobs.map((job) => <tr key={text(job.id)}><td className="max-w-52 truncate py-3 font-semibold text-text-primary">{text(job.title || job.source_url)}</td><td className="text-text-muted">{text(job.email)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span></td><td className="text-text-muted">{text(job.generation_provider)}</td><td className="text-text-muted">${number(job.generation_cost_usd).toFixed(3)}</td></tr>)}</tbody></table></div></div>
        <div className="space-y-3 rounded-3xl border border-border bg-panel p-5"><h2 className="font-semibold text-text-primary">System readiness</h2>{[['Gemini API', providerStatus.geminiApiKey], ['Cloud storage', providerStatus.cloudinary], ['Checkout credentials', providerStatus.checkout?.configured]].map(([label, ready]) => <div key={String(label)} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-xs text-text-muted">{String(label)}</span><span className={`flex items-center gap-1.5 text-[10px] font-semibold ${ready ? 'text-mint' : 'text-pink'}`}>{ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{ready ? 'Ready' : 'Missing'}</span></div>)}{providerStatus.checkout?.configured && <div className="rounded-xl bg-panel-alt px-3 py-2.5 text-[10px] text-text-dim"><div className="flex items-center justify-between gap-3"><span>Checkout connection</span><span className={`font-semibold ${providerStatus.checkout.connection === 'ready' ? 'text-mint' : providerStatus.checkout.connection === 'credentials_rejected' ? 'text-pink' : 'text-amber-200'}`}>{providerStatus.checkout.connection === 'ready' ? 'Verified' : providerStatus.checkout.connection === 'credentials_rejected' ? 'Credentials rejected' : providerStatus.checkout.connection === 'unavailable' ? 'Unavailable' : 'Not checked yet'}</span></div><p className="mt-1">Mode: {providerStatus.checkout.environment === 'live' ? 'Live' : 'Sandbox'}</p></div>}</div></section>
        <section className="rounded-3xl border border-border bg-panel p-5"><div><h2 className="font-semibold text-text-primary">Gemini cost by process · this month</h2><p className="text-xs text-text-dim">Recorded from each completed Gemini generation step.</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="text-text-dim"><tr><th className="pb-3">Model</th><th>Process</th><th>Usage</th><th>Events</th><th>Cost</th></tr></thead><tbody className="divide-y divide-border">{costBreakdown.map((row, index) => <tr key={`${text(row.provider)}-${text(row.operation)}-${index}`}><td className="py-3 text-text-primary">{text(row.model)}</td><td className="text-text-muted">{text(row.operation).replaceAll('_', ' ')}</td><td className="text-text-muted">{number(row.quantity).toFixed(2)} {text(row.unit)}</td><td className="text-text-muted">{number(row.events)}</td><td className="font-semibold text-mint">${number(row.cost).toFixed(4)}</td></tr>)}</tbody></table>{!costBreakdown.length && <p className="py-8 text-center text-sm text-text-dim">Costs will appear after the next generation.</p>}</div></section>
        <section className="rounded-3xl border border-border bg-panel p-5"><div><h2 className="font-semibold text-text-primary">Configured Gemini unit prices</h2><p className="text-xs text-text-dim">Reference rates used to calculate each process event. Text rates can be overridden with server environment variables.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          ['Text input', `$${(number(costCatalog.text?.inputToken) * 1_000_000).toFixed(2)} / 1M tokens`],
          ['Text output', `$${(number(costCatalog.text?.outputToken) * 1_000_000).toFixed(2)} / 1M tokens`],
          ['Fast video 1080p', `$${number(costCatalog.video?.fast1080).toFixed(2)} / second`],
          ['Standard video 1080p', `$${number(costCatalog.video?.standard1080).toFixed(2)} / second`],
          ['Image 2K', `$${number(costCatalog.image?.twoK).toFixed(3)} / image`],
          ['Image 4K', `$${number(costCatalog.image?.fourK).toFixed(3)} / image`],
          ['Voice audio', `$${number(costCatalog.ttsAudioSecond).toFixed(4)} / second`],
          ['Local assembly', '$0.00 provider fee'],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-border bg-panel-alt p-4"><p className="text-[10px] uppercase tracking-wider text-text-dim">{label}</p><p className="mt-2 font-utility text-sm font-semibold text-text-primary">{value}</p></div>)}</div></section>
        <VideoCostMatrix rows={videoCostMatrix} />
      </div>}

      {tab === 'landing' && marketing && <section className="mt-7 space-y-5">
        <div className="rounded-3xl border border-violet/25 bg-gradient-to-br from-violet/10 to-gold/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">Live preview controls</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-text-primary">Show visitors what customers create</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-muted">Upload several videos at once or paste YouTube, Vimeo, or direct video URLs. The first video is featured and every additional saved video appears in the landing-page gallery.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`premium-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-4 text-sm font-semibold text-violet transition hover:bg-violet/15 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                <Upload size={14} /> Upload multiple
                <input
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    const selected = Array.from(event.target.files ?? []);
                    if (selected.length) void uploadLandingFiles(selected);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || marketing.videos.showcase.length >= LANDING_VIDEO_LIMIT}
                onClick={() => {
                  const nextIndex = marketing.videos.showcase.length + 1;
                  setMarketing({
                    ...marketing,
                    videos: {
                      showcase: [
                        ...marketing.videos.showcase,
                        { id: `example-${Date.now()}-${nextIndex}`, url: null, posterUrl: null, caption: null, overlayText: null, eyebrow: null },
                      ],
                    },
                  });
                  setDirty(true);
                }}
              >
                <Plus size={14} /> Add URL slot
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-primary">Section heading<input value={marketing.heading} onChange={(event) => { setMarketing({ ...marketing, heading: event.target.value }); setDirty(true); }} className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm" /></label>
            <label className="text-xs font-semibold text-text-primary">Section description<textarea rows={2} value={marketing.description} onChange={(event) => { setMarketing({ ...marketing, description: event.target.value }); setDirty(true); }} className="mt-2 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm" /></label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-muted"><span className="font-semibold text-text-primary">{marketing.videos.showcase.length}</span> landing video slot{marketing.videos.showcase.length === 1 ? '' : 's'} · all saved videos are returned by the public landing API.</p>
          <span className="rounded-full border border-violet/20 bg-violet/10 px-2.5 py-1 text-[10px] font-semibold text-violet">Up to {LANDING_VIDEO_LIMIT} · multi-upload supported</span>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {marketing.videos.showcase.map((video, index) => <article key={video.id} className="rounded-3xl border border-border bg-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-text-primary">{index === 0 ? 'Featured video' : `Gallery video ${index + 1}`}</p>
                <p className="text-[10px] text-text-dim">{index === 0 ? 'Large hero film on the landing page' : 'Shown in the scrollable campaign gallery'}</p>
              </div>
              <button
                type="button"
                disabled={busy || marketing.videos.showcase.length <= 1}
                onClick={() => {
                  setMarketing({ ...marketing, videos: { showcase: marketing.videos.showcase.filter((_, i) => i !== index) } });
                  setDirty(true);
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-pink/20 bg-pink/5 px-2.5 text-[10px] font-semibold text-pink transition hover:bg-pink/10 disabled:opacity-35"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>

            {video.url ? <video src={video.url} poster={video.posterUrl ?? undefined} controls preload="metadata" className="mx-auto mt-4 aspect-[9/16] max-h-60 rounded-2xl bg-black object-cover" /> : <div className="mt-4 flex aspect-[9/16] max-h-60 items-center justify-center rounded-2xl border border-dashed border-violet/30 bg-bg/50 text-xs text-text-dim">No video yet</div>}

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-text-muted">Video URL<input value={video.url ?? ''} placeholder="YouTube, Vimeo, or direct MP4 URL" onChange={(event) => { setMarketing({ ...marketing, videos: { showcase: marketing.videos.showcase.map((item, i) => i === index ? { ...item, url: event.target.value || null } : item) } }); setDirty(true); }} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-xs" /></label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2.5 text-xs font-semibold text-violet"><Upload size={14} /> Upload video<input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLandingFile(index, file, 'url'); event.currentTarget.value = ''; }} /></label>
              <label className="block text-xs text-text-muted">Small label<input value={video.eyebrow ?? ''} placeholder="Made by a customer" onChange={(event) => { setMarketing({ ...marketing, videos: { showcase: marketing.videos.showcase.map((item, i) => i === index ? { ...item, eyebrow: event.target.value || null } : item) } }); setDirty(true); }} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-xs" /></label>
              <label className="block text-xs text-text-muted">Caption<input value={video.caption ?? ''} placeholder="Fashion store launch video" onChange={(event) => { setMarketing({ ...marketing, videos: { showcase: marketing.videos.showcase.map((item, i) => i === index ? { ...item, caption: event.target.value || null } : item) } }); setDirty(true); }} className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-xs" /></label>
              <label className="block text-xs text-text-muted">Text over the video<textarea rows={2} value={video.overlayText ?? ''} placeholder="Created from a real website in minutes" onChange={(event) => { setMarketing({ ...marketing, videos: { showcase: marketing.videos.showcase.map((item, i) => i === index ? { ...item, overlayText: event.target.value || null } : item) } }); setDirty(true); }} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-xs" /></label>
            </div>
          </article>)}
        </div>
      </section>}

      {tab === 'users' && <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          ['Accounts', number(userSummary.total), 'All registered users'],
          ['Active', number(userSummary.active), 'Can sign in and generate'],
          ['Admins', number(userSummary.admins), 'Administrator accounts'],
          ['Paid plans', number(userSummary.paid_plans), 'Creator / Pro / Agency'],
          ['Suspended', number(userSummary.suspended), 'Access blocked'],
          ['Verified', number(userSummary.verified), 'Verified emails'],
          ['Social auth', number(userSummary.social_auth), 'Google / GitHub / Facebook'],
          ['Pending', number(userSummary.pending), 'Waiting for email code'],
        ].map(([label, value, hint]) => <div key={String(label)} className="rounded-2xl border border-border bg-panel p-3.5"><p className="text-[9px] uppercase tracking-wider text-text-dim">{String(label)}</p><p className="mt-2 font-utility text-xl font-bold text-text-primary">{String(value)}</p><p className="mt-1 text-[9px] leading-4 text-text-dim">{String(hint)}</p></div>)}
      </section>}

      {(tab === 'users' || tab === 'jobs') && <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"><div className="relative flex-1 sm:min-w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" /><input value={tab === 'users' ? userSearch : jobSearch} onChange={(event) => tab === 'users' ? setUserSearch(event.target.value) : setJobSearch(event.target.value)} placeholder={tab === 'users' ? 'Search by email or user ID' : 'Search projects, URLs, or users'} className="w-full rounded-xl border border-border bg-panel py-3 pl-9 pr-3 text-base text-text-primary outline-none focus:border-violet/50 sm:text-xs" /></div>
        {tab === 'users' && <>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="rounded-xl border border-border bg-panel px-3 py-3 text-xs text-text-primary"><option value="all">All roles</option><option value="admin">Administrators</option><option value="user">Customers</option></select>
          <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value as typeof planFilter)} className="rounded-xl border border-border bg-panel px-3 py-3 text-xs text-text-primary"><option value="all">All plans</option><option value="free">Free</option><option value="creator">Creator</option><option value="pro">Pro</option><option value="agency">Agency</option></select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-xl border border-border bg-panel px-3 py-3 text-xs text-text-primary"><option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
          <select value={authFilter} onChange={(event) => setAuthFilter(event.target.value as typeof authFilter)} className="rounded-xl border border-border bg-panel px-3 py-3 text-xs text-text-primary"><option value="all">All sign-in types</option><option value="email">Email / password</option><option value="google">Google</option><option value="github">GitHub</option><option value="facebook">Facebook</option><option value="firebase">Firebase legacy</option><option value="unknown">Unknown legacy</option></select>
          <select value={verifiedFilter} onChange={(event) => setVerifiedFilter(event.target.value as typeof verifiedFilter)} className="rounded-xl border border-border bg-panel px-3 py-3 text-xs text-text-primary"><option value="all">Verified + unverified</option><option value="verified">Verified only</option><option value="unverified">Unverified only</option></select>
          {userFiltersActive && <button type="button" onClick={clearUserFilters} className="rounded-xl border border-violet/25 bg-violet/10 px-3 py-3 text-xs font-semibold text-violet hover:bg-violet/15">Clear filters</button>}
        </>}
        {tab === 'jobs' && <select value={jobStatus} onChange={(event) => setJobStatus(event.target.value)} className="rounded-xl border border-border bg-panel px-4 py-3 text-xs text-text-primary"><option value="all">All statuses</option><option value="queued">Queued</option><option value="capturing">Capturing</option><option value="captured">Captured</option><option value="storyboarding">Direction</option><option value="rendering">Rendering</option><option value="done">Completed</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select>}
      </div>}

      {tab === 'users' && <div className="mt-4 space-y-4">
        {usersError && <div className="flex flex-col justify-between gap-3 rounded-2xl border border-pink/25 bg-pink/5 px-4 py-3 sm:flex-row sm:items-center" role="alert"><p className="text-xs leading-5 text-pink">{usersError}</p><Button variant="secondary" disabled={usersLoading} onClick={() => void loadUsers().catch(() => undefined)}><RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''} /> Retry</Button></div>}
        <section className="overflow-hidden rounded-3xl border border-border bg-panel">
          <div className="border-b border-border px-4 py-3"><h2 className="font-semibold text-text-primary">Registered accounts</h2><p className="mt-1 text-[10px] text-text-dim">Every registered account type, login method, plan, billing state, credit usage, production activity and access role.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1580px] text-left text-xs"><thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">Account</th><th>Type / login</th><th>Plan / billing</th><th>Credits</th><th>Productions</th><th>Status</th><th>Admin access</th><th className="pr-4">Dates</th></tr></thead><tbody className="divide-y divide-border">{users.map((user) => <UserRow
            key={text(user.id)}
            user={user}
            isSelf={text(user.id) === meId}
            isOnlyAdmin={adminCount <= 1}
            busy={busy}
            creditDraft={creditDrafts[text(user.id)] ?? ''}
            onCreditDraftChange={(value) => setCreditDrafts((current) => ({ ...current, [text(user.id)]: value }))}
            onSaveCredits={() => { const draft = creditDrafts[text(user.id)]; if (draft === undefined || draft === '') return; void editUser(user, { creditsBalance: Number(draft) }); }}
            onChangePlan={(plan) => void editUser(user, { plan })}
            onToggleStatus={() => void editUser(user, { accountStatus: text(user.account_status) === 'active' ? 'suspended' : 'active' })}
            onToggleAdmin={(next) => void editUser(user, { isAdmin: next })}
            onViewJobs={() => viewUserJobs(user)}
            onViewDetails={() => void openUserDetails(user)}
          />)}</tbody></table></div>
          {usersLoading && !users.length && <div className="flex items-center justify-center gap-3 p-10 text-sm text-text-dim" role="status"><div className="h-5 w-5 animate-spin rounded-full border-2 border-violet border-t-transparent" /> Loading registered users…</div>}
          {!usersLoading && !usersError && !users.length && <div className="p-10 text-center"><p className="text-sm text-text-dim">No registered users match these filters.</p>{userFiltersActive && <button type="button" onClick={clearUserFilters} className="mt-3 text-xs font-semibold text-violet hover:underline">Clear every filter and show all users</button>}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs text-text-muted"><span>Showing {users.length} of {usersTotal} matching account{usersTotal === 1 ? '' : 's'} · Page {usersPage} of {Math.max(1, Math.ceil(usersTotal / usersPageSize))}</span><div className="flex gap-2"><button type="button" disabled={busy || usersPage <= 1} onClick={() => setUsersPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-border px-3 py-1.5 text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">← Previous</button><button type="button" disabled={busy || usersPage >= Math.ceil(usersTotal / usersPageSize)} onClick={() => setUsersPage((page) => page + 1)} className="rounded-lg border border-border px-3 py-1.5 text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40">Next →</button></div></div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-panel">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4"><div><h2 className="font-semibold text-text-primary">Pending email sign-ups</h2><p className="mt-1 text-[10px] text-text-dim">These are not registered users yet. They become accounts only after entering the email verification code.</p></div><span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-semibold text-amber-200">{number(userSummary.pending)} pending</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-panel-alt text-text-dim"><tr><th className="p-3">Email</th><th>Requested</th><th>Expires</th><th>Incorrect attempts</th><th>Status</th></tr></thead><tbody className="divide-y divide-border">{pendingSignups.map((pending) => { const expired = pending.expires_at ? new Date(String(pending.expires_at)).getTime() < Date.now() : false; return <tr key={text(pending.email)}><td className="p-3 font-semibold text-text-primary">{text(pending.email)}</td><td className="text-text-dim">{date(pending.created_at)}</td><td className="text-text-dim">{date(pending.expires_at)}</td><td className="text-text-muted">{number(pending.attempts)} / 5</td><td><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${expired ? 'bg-pink/10 text-pink' : 'bg-amber-300/10 text-amber-200'}`}>{expired ? 'Expired' : 'Waiting for code'}</span></td></tr>; })}</tbody></table></div>
          {!pendingSignups.length && <p className="p-8 text-center text-xs text-text-dim">No pending email verifications.</p>}
        </section>
      </div>}

      {tab === 'jobs' && <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel"><div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-xs"><thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">Production</th><th>User</th><th>Status</th><th>Progress</th><th>Provider</th><th>Cost</th><th>Credits</th><th className="pr-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{jobs.map((job) => <tr key={text(job.id)}><td className="max-w-64 p-4"><p className="truncate font-semibold text-text-primary">{text(job.title || job.source_url)}</p><p className="mt-1 truncate text-[9px] text-text-dim">{text(job.source_url)}</p>{Boolean(job.error_message) && <p className="mt-1 max-w-64 truncate text-[9px] text-pink" title={text(job.error_message)}>{text(job.error_message)}</p>}</td><td className="text-text-muted">{text(job.email)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span></td><td><div className="w-24"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-signature" style={{ width: `${Math.min(100, number(job.progress))}%` }} /></div><span className="text-[9px] text-text-dim">{number(job.progress)}%</span></div></td><td className="max-w-36 truncate text-text-muted">{text(job.generation_provider)}</td><td className="text-text-muted">${number(job.generation_cost_usd).toFixed(3)}</td><td><div className="min-w-24"><p className="font-utility font-semibold text-text-primary">{number(job.credits_charged)} credits</p><p className="mt-0.5 text-[9px] text-text-dim">Quote {number(job.credits_quoted)} · {number(job.duration_seconds)}s · {text(job.output_quality)}</p>{text(job.audio_mode) === 'voice_music' && <p className="mt-0.5 text-[9px] text-violet">Includes narration</p>}</div></td><td className="pr-4"><div className="flex gap-2">{['queued','capturing','storyboarding','rendering'].includes(text(job.status)) && <button disabled={busy} onClick={() => void updateAdminJob(text(job.id), 'cancel').then(loadJobs)} className="rounded-lg border border-pink/25 px-2 py-1.5 text-[9px] font-semibold text-pink">Cancel</button>}<button disabled={busy} onClick={() => { if (window.confirm('Hide this production from the user history?')) void updateAdminJob(text(job.id), 'hide').then(loadJobs); }} className="rounded-lg border border-border px-2 py-1.5 text-[9px] text-text-muted">Hide</button></div></td></tr>)}</tbody></table></div>{!jobs.length && <p className="p-10 text-center text-sm text-text-dim">No productions match these filters.</p>}</section>}

      {tab === 'providers' && settings && <div className="mt-7 grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-violet/25 bg-violet/10 p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-semibold text-text-primary">Gemini generation</p><p className="mt-1 text-xs leading-relaxed text-text-muted">Images, storyboards, narration, and Veo scenes use your server-side Gemini API configuration.</p></div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${providerStatus.geminiApiKey ? 'bg-mint/10 text-mint' : 'bg-pink/10 text-pink'}`}>{providerStatus.geminiApiKey ? 'Ready' : 'Missing key'}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-mint/20 bg-mint/5 p-4 text-xs leading-relaxed text-text-muted"><KeyRound size={17} className="mb-2 text-mint" />The Gemini API key remains in <code>.env.local</code> and is never returned to the browser.</div>
          <div className="rounded-2xl border border-border bg-panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Provider queues</h2>
                <p className="mt-1 text-[10px] leading-4 text-text-dim">Excess requests wait here instead of bursting past configured model quotas.</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[.03] px-2 py-1 font-utility text-[9px] text-text-muted">
                {(providerStatus.queues ?? []).reduce((sum, item) => sum + item.waiting, 0)} waiting
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {(providerStatus.queues ?? []).map((queue) => (
                <div key={queue.key} className="rounded-xl border border-border bg-bg/30 p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold capitalize text-text-primary">{queue.kind} · {queue.model}</p>
                      <p className="mt-1 text-[9px] text-text-dim">{queue.rpm} starts/min · {queue.concurrency} concurrent</p>
                    </div>
                    <div className="shrink-0 text-right font-utility text-[9px] text-text-muted">
                      <p>{queue.active} active</p>
                      <p>{queue.waiting} queued</p>
                    </div>
                  </div>
                  {queue.blockedForMs > 0 && <p className="mt-2 text-[9px] text-amber-200">Provider backoff · {Math.ceil(queue.blockedForMs / 1000)}s</p>}
                </div>
              ))}
              {!providerStatus.queues?.length && <p className="rounded-xl border border-dashed border-border p-3 text-[10px] text-text-dim">Queues appear after the first provider request.</p>}
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-panel p-5"><h2 className="font-semibold text-text-primary">Website controls</h2><div className="mt-4 space-y-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-text-primary">Maintenance mode</p><p className="text-[10px] text-text-dim">Pause new captures and renders for users.</p></div><Switch checked={settings.operations.maintenanceMode} onCheckedChange={(maintenanceMode) => setSettings({ ...settings, operations: { ...settings.operations, maintenanceMode } })} /></div><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-text-primary">Allow registrations</p><p className="text-[10px] text-text-dim">Permit new accounts to sign up.</p></div><Switch checked={settings.operations.registrationsEnabled} onCheckedChange={(registrationsEnabled) => setSettings({ ...settings, operations: { ...settings.operations, registrationsEnabled } })} /></div><label className="block"><span className="text-xs font-semibold text-text-primary">Maximum concurrent jobs</span><input type="number" min="1" max="20" value={settings.operations.maxConcurrentJobs} onChange={(event) => setSettings({ ...settings, operations: { ...settings.operations, maxConcurrentJobs: Number(event.target.value) } })} className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-primary" /></label></div></div>
          <Button className="w-full" disabled={busy} onClick={() => void saveSettings()}><Settings2 size={15} /> Save runtime controls</Button>
        </section>
      </div>}

      {tab === 'audit' && <section className="mt-7 rounded-3xl border border-border bg-panel p-5"><div className="flex items-center gap-3"><Database size={18} className="text-violet" /><div><h2 className="font-semibold text-text-primary">Administrator audit log</h2><p className="text-xs text-text-dim">Permanent record of sensitive control changes.</p></div></div><div className="mt-5 divide-y divide-border">{audit.map((event) => <div key={text(event.id)} className="grid gap-2 py-3 text-xs sm:grid-cols-[1fr_1fr_1fr_auto]"><span className="font-semibold text-text-primary">{text(event.action)}</span><span className="text-text-muted">{text(event.admin_email)}</span><span className="text-text-dim">{text(event.target_type)} · {text(event.target_id)}</span><span className="text-text-dim">{date(event.created_at)}</span></div>)}{!audit.length && <p className="py-10 text-center text-text-dim">No administrator actions recorded yet.</p>}</div></section>}
      {userDetailsOpen && <UserDetailsModal details={userDetails} loading={userDetailsLoading} onClose={() => { setUserDetailsOpen(false); setUserDetails(null); }} />}
    </main>
  </div>;
}
