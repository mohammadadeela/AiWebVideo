import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, BarChart3, CheckCircle2, Clock3, CreditCard, Database, DollarSign, FileVideo, GalleryVerticalEnd, KeyRound, LayoutDashboard, MailCheck, ReceiptText, RefreshCw, Save, ShieldCheck, SlidersHorizontal, Trash2, Upload, UserRoundCog, Users, X, Plus, type LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import { Switch } from '@/components/ui/switch';
import { Wordmark } from '@/components/ui/Wordmark';
import { AdminReports } from '@/components/admin/AdminReports';
import { Empty, FilterBar, FilterSelect, StatCard } from '@/components/admin/adminUi';
import { RoleControl } from '@/components/admin/RoleControl';
import {
  fetchAdminAudit, fetchAdminJobs, fetchAdminOverview, fetchAdminReports, fetchAdminUsers, fetchAdminUserDetails, fetchMe,
  saveAdminSettings, updateAdminJob, updateAdminUser, saveMarketingSettings, uploadMarketingAsset, optimizeMarketingVideo,
  SHOWCASE_FEATURES, SHOWCASE_FEATURE_LABELS,
  type AdminReportRange, type AdminSettings, type MarketingSettings, type ShowcaseFeature,
} from '@/lib/api-client';
import { watchAuthState } from '@/lib/firebase/client';
import { useSeo } from '@/lib/useSeo';

type Tab = 'overview' | 'reports' | 'landing' | 'users' | 'jobs' | 'providers' | 'audit';
type Row = Record<string, unknown>;
type MetricCard = [label: string, value: string, icon: ComponentType<LucideProps>, hint: string];
const LANDING_VIDEO_LIMIT = 280;
const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'landing', label: 'Homepage', icon: GalleryVerticalEnd },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'jobs', label: 'Productions', icon: FileVideo },
  { id: 'providers', label: 'System', icon: SlidersHorizontal },
  { id: 'audit', label: 'Activity log', icon: ShieldCheck },
];
const adminPathByTab: Record<Tab, string> = {
  overview: '/admin',
  reports: '/admin/reports',
  landing: '/admin/landing',
  users: '/admin/users',
  jobs: '/admin/productions',
  providers: '/admin/controls',
  audit: '/admin/audit',
};
function adminTabFromPath(pathname: string): Tab {
  return (Object.entries(adminPathByTab).find(([, path]) => path === pathname)?.[0] as Tab | undefined) ?? 'overview';
}
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
  onChangePlan, onToggleStatus, onToggleAdmin, onViewJobs, onViewDetails, roleChanged,
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
  roleChanged: boolean;
}) {
  const currentBalance = number(user.credits_balance);
  const creditsDirty = creditDraft !== '' && Number(creditDraft) !== currentBalance && !Number.isNaN(Number(creditDraft));
  const isAdmin = Boolean(user.is_admin);
  const isActive = text(user.account_status) === 'active';
  const verified = Boolean(user.email_verified);
  const adminDisabled = busy || (isSelf && isAdmin) || (isOnlyAdmin && isAdmin);
  const adminDisabledReason = isSelf && isAdmin ? 'You cannot remove your own administrator access.' : isOnlyAdmin && isAdmin ? 'This is the last administrator.' : undefined;
  const statusDisabled = busy || (isSelf && isActive);
  const paid = Boolean(user.has_paid_purchase) || Boolean(user.has_subscription);
  const failed = number(user.failed_jobs);

  return (
    <tr className="align-middle hover:bg-white/[.02]">
      <td className="p-4">
        <div className="min-w-56">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onViewDetails} className="max-w-64 truncate text-left text-sm font-semibold text-text-primary hover:text-violet">{text(user.email)}</button>
            {isSelf && <span className="rounded-full bg-violet/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet">You</span>}
            {paid && <span className="h-2 w-2 rounded-full bg-mint" title={`Paid · $${number(user.lifetime_paid_usd).toFixed(2)} lifetime`} />}
            {!verified && <span className="h-2 w-2 rounded-full bg-amber-300" title="Email not verified" />}
          </div>
          <p className="mt-0.5 text-[11px] text-text-dim">{authLabel(user.auth_provider)}</p>
        </div>
      </td>
      <td className="pr-3">
        <select value={text(user.plan)} disabled={busy} onChange={(event) => onChangePlan(event.target.value)} aria-label="Plan" className="h-9 rounded-lg border border-border bg-bg px-2 text-xs capitalize text-text-muted">
          <option>free</option><option>creator</option><option>pro</option><option>agency</option>
        </select>
      </td>
      <td className="pr-3">
        <div className="flex items-center gap-1.5">
          <input type="number" min="0" aria-label="Credits" value={creditDraft === '' ? currentBalance : creditDraft} disabled={busy} onChange={(event) => onCreditDraftChange(event.target.value)} className="h-9 w-24 rounded-lg border border-border bg-bg px-2 text-xs text-text-primary" />
          {creditsDirty && <button type="button" disabled={busy} onClick={onSaveCredits} className="h-9 rounded-lg bg-mint/15 px-2.5 text-xs font-semibold text-mint hover:bg-mint/25 disabled:opacity-50">Save</button>}
        </div>
      </td>
      <td className="pr-3">
        <button type="button" onClick={onViewJobs} className="text-left text-xs text-text-muted hover:text-violet">
          <span className="font-semibold text-text-primary">{number(user.job_count)}</span>
          {failed > 0 && <span className="ml-1.5 text-pink">{failed} failed</span>}
        </button>
      </td>
      <td className="pr-3">
        <button type="button" disabled={statusDisabled} onClick={onToggleStatus} title={isSelf && isActive ? 'You cannot suspend your own account.' : undefined} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${statusClass(user.account_status)}`}>
          {isActive ? 'Active' : 'Suspended'}
        </button>
      </td>
      <td className="pr-3"><RoleControl email={text(user.email)} isAdmin={isAdmin} isSelf={isSelf} isOnlyAdmin={isOnlyAdmin} busy={busy} justChanged={roleChanged} onChange={onToggleAdmin} /></td>
      <td className="pr-4 text-xs text-text-dim">{user.created_at ? new Date(String(user.created_at)).toLocaleDateString() : '—'}</td>
    </tr>
  );
}

function UserDetailsModal({ details, loading, onClose }: { details: { user: Row; subscriptions: Row[]; payments: Row[]; credits: Row[]; productions: Row[] } | null; loading: boolean; onClose: () => void }) {
  const user = details?.user ?? {};
  return (
    <div role="dialog" aria-modal="true" aria-label="User details" className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
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
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>(() => adminTabFromPath(window.location.pathname));
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const [overview, setOverview] = useState<Row | null>(null);
  const [reports, setReports] = useState<Row | null>(null);
  const [reportRange, setReportRange] = useState<AdminReportRange>('month');
  const [reportsLoading, setReportsLoading] = useState(false);
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
  const [billingFilter, setBillingFilter] = useState<'all' | 'paying' | 'purchased' | 'subscribed' | 'active_subscription' | 'never_paid'>('all');
  const [userSearchBy, setUserSearchBy] = useState<'all' | 'email' | 'id' | 'payment' | 'subscription'>('all');
  const [joinedFilter, setJoinedFilter] = useState<'all' | 'today' | '7d' | '30d' | 'year'>('all');
  const [userSort, setUserSort] = useState<'newest' | 'oldest' | 'recent_signin' | 'highest_spend' | 'highest_credits' | 'most_productions'>('newest');
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
  const [roleFlash, setRoleFlash] = useState<string | null>(null);
  const [gallerySelected, setGallerySelected] = useState<string[]>([]);
  const [galleryFeature, setGalleryFeature] = useState<'all' | 'unassigned' | ShowcaseFeature>('all');
  const [galleryKind, setGalleryKind] = useState<'all' | 'image' | 'video'>('all');
  const [linkDraft, setLinkDraft] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [jobSearchBy, setJobSearchBy] = useState<'all' | 'title' | 'id' | 'url' | 'user' | 'provider' | 'error'>('all');
  const [jobStatus, setJobStatus] = useState('all');
  const [jobFeature, setJobFeature] = useState('all');
  const [jobProvider, setJobProvider] = useState<'all' | 'gemini' | 'other' | 'unassigned'>('all');
  const [jobCreated, setJobCreated] = useState<'all' | 'today' | '7d' | '30d' | 'year'>('all');
  const [jobBilling, setJobBilling] = useState<'all' | 'charged' | 'no_charge'>('all');
  const [jobQuality, setJobQuality] = useState<'all' | '1080p' | '4k'>('all');
  const [jobSort, setJobSort] = useState<'newest' | 'oldest' | 'highest_cost' | 'highest_credits' | 'most_progress'>('newest');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSearchBy, setAuditSearchBy] = useState<'all' | 'action' | 'admin' | 'target' | 'details'>('all');
  const [auditCategory, setAuditCategory] = useState<'all' | 'user' | 'job' | 'settings' | 'marketing'>('all');
  const [auditCreated, setAuditCreated] = useState<'all' | 'today' | '7d' | '30d' | 'year'>('all');
  const [auditSort, setAuditSort] = useState<'newest' | 'oldest'>('newest');
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
      const result = await fetchAdminUsers({ search: userSearch, searchBy: userSearchBy, page: usersPage, plan: planFilter, role: roleFilter, status: statusFilter, auth: authFilter, verified: verifiedFilter, billing: billingFilter, joined: joinedFilter, sort: userSort });
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
  }, [userSearch, userSearchBy, usersPage, planFilter, roleFilter, statusFilter, authFilter, verifiedFilter, billingFilter, joinedFilter, userSort]);
  const loadJobs = useCallback(async () => setJobs((await fetchAdminJobs({ search: jobSearch, searchBy: jobSearchBy, status: jobStatus, feature: jobFeature, provider: jobProvider, created: jobCreated, billing: jobBilling, quality: jobQuality, sort: jobSort })).jobs), [jobSearch, jobSearchBy, jobStatus, jobFeature, jobProvider, jobCreated, jobBilling, jobQuality, jobSort]);
  const loadAudit = useCallback(async () => setAudit((await fetchAdminAudit({ search: auditSearch, searchBy: auditSearchBy, category: auditCategory, created: auditCreated, sort: auditSort })).events), [auditSearch, auditSearchBy, auditCategory, auditCreated, auditSort]);
  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      setReports(await fetchAdminReports(reportRange));
    } finally {
      setReportsLoading(false);
    }
  }, [reportRange]);

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
  useEffect(() => { setUsersPage(1); }, [userSearch, userSearchBy, planFilter, roleFilter, statusFilter, authFilter, verifiedFilter, billingFilter, joinedFilter, userSort]);

  useEffect(() => {
    setTab(adminTabFromPath(window.location.pathname));
  }, [location]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => {
      if (tab === 'users') void loadUsers().catch(() => undefined);
      if (tab === 'jobs') void loadJobs();
      if (tab === 'audit') void loadAudit();
      if (tab === 'reports') void loadReports().catch((error) => setMessage(error instanceof Error ? error.message : 'Reports could not be loaded.'));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [allowed, tab, loadUsers, loadJobs, loadAudit, loadReports]);

  const providerStatus = (overview?.providerStatus ?? {}) as {
    geminiApiKey?: boolean;
    r2Storage?: boolean;
    checkout?: { configured?: boolean; environment?: 'sandbox' | 'live'; connection?: 'not_checked' | 'ready' | 'credentials_rejected' | 'unavailable' };
    queues?: Array<{ key: string; kind: string; model: string; rpm: number; concurrency: number; waiting: number; active: number; blockedForMs: number }>;
  };
  const userStats = (overview?.users ?? {}) as Row;
  const jobStats = (overview?.jobs ?? {}) as Row;
  const usage = (overview?.usage ?? {}) as Row;
  const recentJobs = (overview?.recentJobs ?? []) as Row[];
  const costBreakdown = (overview?.costBreakdown ?? []) as Row[];
  const videoCostMatrix = (overview?.videoCostMatrix ?? []) as Row[];
  const userFiltersActive = Boolean(userSearch || userSearchBy !== 'all' || planFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'all' || authFilter !== 'all' || verifiedFilter !== 'all' || billingFilter !== 'all' || joinedFilter !== 'all' || userSort !== 'newest');
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
      else if (tab === 'reports') await loadReports();
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
    try { const saved = await saveMarketingSettings(marketing); setMarketing(saved); setDirty(false); setMessage('Homepage videos are live.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Homepage video settings could not be saved.'); }
    finally { setBusy(false); }
  }

  /** Upload many images and videos at once. Nothing goes live until every item has a feature and you save. */
  async function uploadGalleryFiles(files: File[]) {
    if (!marketing || files.length === 0) return;
    const used = marketing.videos.showcase.filter((item) => item.url).length;
    const room = Math.max(0, LANDING_VIDEO_LIMIT - used);
    const accepted = files.filter((file) => /^(image|video)\//.test(file.type)).slice(0, room);
    if (!accepted.length) {
      setMessage(room === 0 ? `The gallery already has the maximum of ${LANDING_VIDEO_LIMIT} items.` : 'Choose image or video files.');
      return;
    }
    setBusy(true);
    const added: MarketingSettings['videos']['showcase'] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        setMessage(`Uploading ${index + 1} of ${accepted.length}${accepted[index].type.startsWith('video/') ? ' (videos are optimized for phones, this can take a minute)' : ''}…`);
        const uploaded = await uploadMarketingAsset(accepted[index]);
        added.push({
          id: `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          url: uploaded.url,
          posterUrl: uploaded.posterUrl ?? null,
          kind: uploaded.kind,
          feature: null,
          caption: null,
          overlayText: null,
          eyebrow: null,
        });
      }
      const skipped = files.length - accepted.length;
      setMessage(`${added.length} uploaded. Choose a feature for each one, then save${skipped ? ` · ${skipped} skipped` : ''}.`);
    } catch (error) {
      setMessage(`${added.length} uploaded before an error: ${error instanceof Error ? error.message : 'Upload failed.'}`);
    } finally {
      if (added.length) {
        // Empty placeholder slots are dropped so they never hide real items.
        const kept = marketing.videos.showcase.filter((item) => item.url);
        setMarketing({ ...marketing, videos: { showcase: [...kept, ...added] } });
        setDirty(true);
      }
      setBusy(false);
    }
  }

  /** Re-encode the videos uploaded before phone optimization existed, one at a time. */
  async function optimizeOldVideos() {
    if (!marketing) return;
    const isLocalVideo = (item: MarketingSettings['videos']['showcase'][number]) =>
      Boolean(item.url) && (item.kind ?? 'video') === 'video' && /^\/api\/assets\/marketing\/.+\.(mp4|webm|mov)$/i.test(item.url ?? '');
    const targets = marketing.videos.showcase.filter(isLocalVideo);
    if (!targets.length) { setMessage('There are no uploaded videos to optimize.'); return; }
    setBusy(true);
    let converted = 0;
    let failed = 0;
    let current = marketing.videos.showcase;
    try {
      for (let index = 0; index < targets.length; index += 1) {
        setMessage(`Optimizing video ${index + 1} of ${targets.length} for phones… this can take a minute each.`);
        try {
          const result = await optimizeMarketingVideo(targets[index].url ?? '');
          if (result.optimized) {
            converted += 1;
            current = current.map((item) => item.id === targets[index].id ? { ...item, url: result.url, posterUrl: result.posterUrl ?? item.posterUrl } : item);
            setMarketing({ ...marketing, videos: { showcase: current } });
            setDirty(true);
          }
        } catch { failed += 1; }
      }
      setMessage(`${converted} video${converted === 1 ? '' : 's'} optimized, ${targets.length - converted - failed} already fine${failed ? `, ${failed} could not be converted` : ''}.${converted ? ' Press Save to publish them.' : ''}`);
    } finally { setBusy(false); }
  }

  async function editUser(user: Row, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }, successMessage = 'User account updated.') {
    setBusy(true); setMessage(null);
    try {
      await updateAdminUser(text(user.id), patch);
      await Promise.all([loadUsers(), loadOverview()]);
      if (userDetailsOpen && text(userDetails?.user.id) === text(user.id)) {
        const details = await fetchAdminUserDetails(text(user.id));
        setUserDetails(details);
      }
      if (patch.creditsBalance !== undefined) setCreditDrafts((current) => { const next = { ...current }; delete next[text(user.id)]; return next; });
      setMessage(successMessage);
      if (patch.isAdmin !== undefined) {
        setRoleFlash(text(user.id));
        window.setTimeout(() => setRoleFlash((current) => (current === text(user.id) ? null : current)), 4000);
      }
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'User could not be updated.'); }
    finally { setBusy(false); }
  }

  function viewUserJobs(user: Row) {
    setJobSearch(text(user.email));
    selectTab('jobs');
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    const nextPath = adminPathByTab[nextTab];
    if (window.location.pathname !== nextPath) navigate(nextPath);
  }

  function clearUserFilters() {
    setUserSearch('');
    setUserSearchBy('all');
    setPlanFilter('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setAuthFilter('all');
    setVerifiedFilter('all');
    setBillingFilter('all');
    setJoinedFilter('all');
    setUserSort('newest');
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

  const currentTab = tabs.find((item) => item.id === tab);
  const jobFiltersActive = Boolean(jobSearch || jobStatus !== 'all' || jobFeature !== 'all' || jobSearchBy !== 'all' || jobProvider !== 'all' || jobCreated !== 'all' || jobBilling !== 'all' || jobQuality !== 'all' || jobSort !== 'newest');
  const jobMoreActive = jobSearchBy !== 'all' || jobProvider !== 'all' || jobCreated !== 'all' || jobBilling !== 'all' || jobQuality !== 'all' || jobSort !== 'newest';
  const userMoreActive = userSearchBy !== 'all' || roleFilter !== 'all' || authFilter !== 'all' || verifiedFilter !== 'all' || joinedFilter !== 'all' || userSort !== 'newest';
  const auditFiltersActive = Boolean(auditSearch || auditSearchBy !== 'all' || auditCategory !== 'all' || auditCreated !== 'all' || auditSort !== 'newest');
  const dateOptions: Array<[string, string]> = [['all', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['year', 'This year']];
  const showcase = marketing?.videos.showcase ?? [];
  const setShowcase = (next: typeof showcase) => { if (!marketing) return; setMarketing({ ...marketing, videos: { showcase: next } }); setDirty(true); };
  const checkoutState = providerStatus.checkout;

  return <div className="min-h-screen bg-bg lg:flex">
    <aside className="border-b border-border bg-[#100c20] p-4 lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:border-b-0 lg:border-r">
      <Link href="/"><Wordmark /></Link>
      <nav className="chat-scroll mt-5 flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col lg:overflow-visible" aria-label="Admin sections">
        {tabs.map((item) => <button key={item.id} type="button" onClick={() => selectTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${tab === item.id ? 'bg-violet/15 text-text-primary' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}><item.icon size={15} />{item.label}</button>)}
      </nav>
      <Link href="/dashboard" className="mt-4 hidden rounded-xl px-3 py-2.5 text-xs text-text-dim transition hover:text-text-primary lg:block">← Workspace</Link>
    </aside>

    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-text-primary">{currentTab?.label}</h1>
        <div className="flex gap-2">
          {tab === 'landing' && <Button disabled={busy || !dirty || showcase.some((item) => item.url && !item.feature)} title={showcase.some((item) => item.url && !item.feature) ? 'Choose a feature for every item first' : undefined} onClick={() => void saveLanding()}><Save size={15} /> {dirty ? 'Save' : 'Saved'}</Button>}
          {tab === 'providers' && <Button disabled={busy} onClick={() => void saveSettings()}><Save size={15} /> Save</Button>}
          <Button variant="secondary" disabled={busy} onClick={() => void refresh()} aria-label="Refresh"><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /></Button>
        </div>
      </header>
      {message && <div className="mt-4 rounded-xl border border-violet/25 bg-violet/10 px-4 py-3 text-sm text-text-muted" role="status">{message}</div>}

      {tab === 'reports' && <AdminReports report={reports} range={reportRange} loading={reportsLoading} onRangeChange={(nextRange) => { setMessage(null); setReportRange(nextRange); }} />}

      {tab === 'overview' && <div className="mt-6 space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Users" value={number(userStats.total)} />
          <StatCard label="Running now" value={number(jobStats.running)} tone="gold" />
          <StatCard label="Completed" value={number(jobStats.done)} tone="mint" />
          <StatCard label="AI cost this month" value={`$${number(usage.cost).toFixed(2)}`} hint={`${number(usage.credits).toFixed(0)} credits used by customers`} tone="pink" />
        </section>
        <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
          <div className="rounded-3xl border border-border bg-panel p-5">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-text-primary">Recent productions</h2><button type="button" onClick={() => selectTab('jobs')} className="text-xs font-semibold text-violet hover:underline">View all</button></div>
            <div className="mt-3 divide-y divide-border">
              {recentJobs.slice(0, 8).map((job) => <div key={text(job.id)} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <div className="min-w-0"><p className="truncate font-semibold text-text-primary">{text(job.title || job.source_url)}</p><p className="truncate text-[11px] text-text-dim">{text(job.email)}</p></div>
                <div className="flex shrink-0 items-center gap-3"><span className="text-text-dim">${number(job.generation_cost_usd).toFixed(3)}</span><span className={`rounded-full px-2 py-1 text-[10px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span></div>
              </div>)}
              {!recentJobs.length && <Empty>No productions yet.</Empty>}
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-panel p-5">
            <h2 className="font-semibold text-text-primary">System</h2>
            <div className="mt-3 space-y-2">
              {([['Gemini API', providerStatus.geminiApiKey], ['Storage', providerStatus.r2Storage], ['Checkout', checkoutState?.configured]] as Array<[string, boolean | undefined]>).map(([label, ready]) => <div key={label} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5 text-xs"><span className="text-text-muted">{label}</span><span className={`flex items-center gap-1.5 font-semibold ${ready ? 'text-mint' : 'text-pink'}`}>{ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{ready ? 'Ready' : 'Missing'}</span></div>)}
              {checkoutState?.configured && <p className="px-1 text-[11px] text-text-dim">{checkoutState.environment === 'live' ? 'Live' : 'Sandbox'} · {checkoutState.connection === 'ready' ? 'connection verified' : checkoutState.connection === 'credentials_rejected' ? 'credentials rejected' : checkoutState.connection === 'unavailable' ? 'unavailable' : 'not checked yet'}</p>}
            </div>
          </div>
        </section>
      </div>}

      {tab === 'landing' && marketing && (() => {
        const items = showcase.filter((item) => item.url);
        const unassigned = items.filter((item) => !item.feature);
        const kindOf = (item: (typeof items)[number]) => item.kind ?? 'video';
        const visible = items.filter((item) =>
          (galleryFeature === 'all' || (galleryFeature === 'unassigned' ? !item.feature : item.feature === galleryFeature))
          && (galleryKind === 'all' || kindOf(item) === galleryKind));
        const visibleIds = visible.map((item) => item.id);
        const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => gallerySelected.includes(id));
        const count = (feature: ShowcaseFeature) => items.filter((item) => item.feature === feature).length;
        const patchItems = (ids: string[], patch: Partial<(typeof items)[number]>) => setShowcase(showcase.map((item) => ids.includes(item.id) ? { ...item, ...patch } : item));
        const chip = (active: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-white text-[#1b1030]' : 'bg-white/[.06] text-text-muted hover:text-white'}`;
        return <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted"><span className="font-semibold text-text-primary">{items.length}</span> of {LANDING_VIDEO_LIMIT} items{unassigned.length > 0 && <span className="ml-2 font-semibold text-amber-200">· {unassigned.length} need a feature</span>}</p>
            <div className="flex flex-wrap gap-2">
              <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const link = linkDraft.trim(); if (!/^https?:\/\//i.test(link)) { setMessage('Paste a full video link that starts with https://'); return; } setShowcase([...showcase.filter((item) => item.url), { id: `link-${Date.now()}`, url: link, posterUrl: null, caption: null, overlayText: null, eyebrow: null, kind: 'video', feature: null }]); setLinkDraft(''); }}>
                <input value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} placeholder="YouTube, Vimeo or MP4 link" aria-label="Video link" className="h-11 w-52 rounded-xl border border-border bg-bg px-3 text-base sm:text-xs" />
                <Button type="submit" variant="secondary" disabled={busy || !linkDraft.trim() || items.length >= LANDING_VIDEO_LIMIT}><Plus size={14} /> Add</Button>
              </form>
              <Button type="button" variant="secondary" disabled={busy || !items.some((item) => (item.kind ?? 'video') === 'video')} onClick={() => void optimizeOldVideos()} title="Re-encodes older uploads so they start instantly on phones">Optimize videos for phones</Button>
              <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-signature px-4 text-sm font-semibold text-white transition hover:brightness-110 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                <Upload size={15} /> Upload images &amp; videos
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" disabled={busy} onChange={(event) => { const selected = Array.from(event.target.files ?? []); if (selected.length) void uploadGalleryFiles(selected); event.currentTarget.value = ''; }} />
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-panel p-3">
            <div className="chat-scroll flex gap-1.5 overflow-x-auto">
              <button type="button" onClick={() => setGalleryFeature('all')} className={chip(galleryFeature === 'all')}>All ({items.length})</button>
              <button type="button" onClick={() => setGalleryFeature('unassigned')} className={`${chip(galleryFeature === 'unassigned')} ${unassigned.length ? 'ring-1 ring-amber-300/50' : ''}`}>Needs a feature ({unassigned.length})</button>
              {SHOWCASE_FEATURES.map((feature) => <button key={feature} type="button" onClick={() => setGalleryFeature(feature)} className={chip(galleryFeature === feature)}>{SHOWCASE_FEATURE_LABELS[feature]} ({count(feature)})</button>)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl bg-white/[.04] p-1">
                {(['all', 'image', 'video'] as const).map((kind) => <button key={kind} type="button" onClick={() => setGalleryKind(kind)} className={`rounded-lg px-3 py-1 text-xs font-semibold ${galleryKind === kind ? 'bg-white text-[#1b1030]' : 'text-text-muted'}`}>{kind === 'all' ? 'All types' : kind === 'image' ? 'Images' : 'Videos'}</button>)}
              </div>
              <button type="button" onClick={() => setGallerySelected(allVisibleSelected ? gallerySelected.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...gallerySelected, ...visibleIds])))} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-violet hover:bg-violet/10" disabled={!visibleIds.length}>{allVisibleSelected ? 'Clear selection' : `Select ${visibleIds.length} shown`}</button>
            </div>
          </div>

          {gallerySelected.length > 0 && <div className="sticky top-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-violet/30 bg-[#1a1233]/95 p-3 shadow-xl backdrop-blur">
            <span className="text-sm font-semibold text-white">{gallerySelected.length} selected</span>
            <span className="text-xs text-text-muted">Move to:</span>
            <div className="chat-scroll flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {SHOWCASE_FEATURES.map((feature) => <button key={feature} type="button" onClick={() => { patchItems(gallerySelected, { feature }); setGallerySelected([]); }} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet">{SHOWCASE_FEATURE_LABELS[feature]}</button>)}
            </div>
            <button type="button" onClick={() => { if (window.confirm(`Delete ${gallerySelected.length} item${gallerySelected.length === 1 ? '' : 's'}?`)) { setShowcase(showcase.filter((item) => !gallerySelected.includes(item.id))); setGallerySelected([]); } }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-pink hover:bg-pink/10"><Trash2 size={13} /> Delete</button>
            <button type="button" onClick={() => setGallerySelected([])} aria-label="Clear selection" className="grid h-8 w-8 place-items-center rounded-full text-text-muted hover:bg-white/10"><X size={14} /></button>
          </div>}

          {visible.length === 0 ? <Empty>{items.length ? 'Nothing matches these filters.' : 'Upload images and videos to build the homepage gallery.'}</Empty> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {visible.map((item) => {
              const selected = gallerySelected.includes(item.id);
              return <article key={item.id} className={`overflow-hidden rounded-2xl border bg-panel transition ${selected ? 'border-violet ring-2 ring-violet/40' : item.feature ? 'border-border' : 'border-amber-300/40'}`}>
                <div className="relative aspect-[3/4] bg-black">
                  {kindOf(item) === 'image'
                    ? <img src={item.url ?? ''} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <video src={item.url ?? undefined} poster={item.posterUrl ?? undefined} muted playsInline preload="metadata" controls className="h-full w-full object-cover" />}
                  <button type="button" aria-pressed={selected} aria-label={selected ? 'Deselect' : 'Select'} onClick={() => setGallerySelected(selected ? gallerySelected.filter((id) => id !== item.id) : [...gallerySelected, item.id])} className={`absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 transition ${selected ? 'border-violet bg-violet text-white' : 'border-white/70 bg-black/40 text-transparent hover:text-white/70'}`}><CheckCircle2 size={14} /></button>
                  <button type="button" disabled={busy} aria-label="Delete" onClick={() => { setShowcase(showcase.filter((entry) => entry.id !== item.id)); setGallerySelected(gallerySelected.filter((id) => id !== item.id)); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white/80 transition hover:bg-pink/80 hover:text-white"><Trash2 size={12} /></button>
                </div>
                <div className="p-2">
                  <select aria-label="Feature" value={item.feature ?? ''} onChange={(event) => patchItems([item.id], { feature: (event.target.value || null) as ShowcaseFeature | null })} className={`h-9 w-full rounded-lg border bg-bg px-2 text-xs ${item.feature ? 'border-border text-text-primary' : 'border-amber-300/50 text-amber-200'}`}>
                    <option value="">Choose a feature…</option>
                    {SHOWCASE_FEATURES.map((feature) => <option key={feature} value={feature}>{SHOWCASE_FEATURE_LABELS[feature]}</option>)}
                  </select>
                </div>
              </article>;
            })}
          </div>}

          <details className="rounded-2xl border border-border bg-panel p-4 text-sm">
            <summary className="cursor-pointer select-none font-semibold text-text-primary">Section text</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-text-muted">Heading<input value={marketing.heading} onChange={(event) => { setMarketing({ ...marketing, heading: event.target.value }); setDirty(true); }} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal text-text-primary" /></label>
              <label className="text-xs font-semibold text-text-muted">Description<textarea rows={2} value={marketing.description} onChange={(event) => { setMarketing({ ...marketing, description: event.target.value }); setDirty(true); }} className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal text-text-primary" /></label>
            </div>
          </details>
        </section>;
      })()}

      {tab === 'users' && <div className="mt-6 space-y-4">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Accounts" value={number(userSummary.total)} hint={`${number(userSummary.admins)} admin${number(userSummary.admins) === 1 ? '' : 's'}`} />
          <StatCard label="Paying customers" value={number(userSummary.paying_users)} hint={`$${number(userSummary.lifetime_revenue).toFixed(2)} collected`} tone="mint" />
          <StatCard label="Subscribers" value={number(userSummary.subscribers)} hint={`${number(userSummary.active_subscribers)} active now`} />
          <StatCard label="Suspended" value={number(userSummary.suspended)} tone="pink" />
        </section>
        {usersError && <div className="flex flex-col justify-between gap-3 rounded-2xl border border-pink/25 bg-pink/5 px-4 py-3 sm:flex-row sm:items-center" role="alert"><p className="text-xs leading-5 text-pink">{usersError}</p><Button variant="secondary" disabled={usersLoading} onClick={() => void loadUsers().catch(() => undefined)}>Try again</Button></div>}
        <section className="overflow-hidden rounded-3xl border border-border bg-panel">
          <FilterBar
            search={userSearch} onSearch={setUserSearch} placeholder="Search email, ID or payment" active={userFiltersActive} onClear={clearUserFilters} moreActive={userMoreActive}
            more={<>
              <FilterSelect label="Search in" value={userSearchBy} onChange={(v) => setUserSearchBy(v as typeof userSearchBy)} options={[['all', 'Search everything'], ['email', 'Email only'], ['id', 'User ID'], ['payment', 'Payments'], ['subscription', 'Subscriptions']]} />
              <FilterSelect label="Role" value={roleFilter} onChange={(v) => setRoleFilter(v as typeof roleFilter)} options={[['all', 'All roles'], ['admin', 'Administrators'], ['user', 'Customers']]} />
              <FilterSelect label="Sign-in" value={authFilter} onChange={(v) => setAuthFilter(v as typeof authFilter)} options={[['all', 'Any sign-in'], ['email', 'Email'], ['google', 'Google'], ['github', 'GitHub'], ['facebook', 'Facebook'], ['firebase', 'Firebase legacy'], ['unknown', 'Unknown']]} />
              <FilterSelect label="Verification" value={verifiedFilter} onChange={(v) => setVerifiedFilter(v as typeof verifiedFilter)} options={[['all', 'Verified or not'], ['verified', 'Verified'], ['unverified', 'Unverified']]} />
              <FilterSelect label="Joined" value={joinedFilter} onChange={(v) => setJoinedFilter(v as typeof joinedFilter)} options={dateOptions.map(([id, label]) => [id, id === 'all' ? 'Joined any time' : `Joined ${label.toLowerCase()}`] as [string, string])} />
              <FilterSelect label="Sort" value={userSort} onChange={(v) => setUserSort(v as typeof userSort)} options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['recent_signin', 'Recent sign-in'], ['highest_spend', 'Highest spend'], ['highest_credits', 'Most credits'], ['most_productions', 'Most productions']]} />
            </>}
          >
            <FilterSelect label="Plan" value={planFilter} onChange={(v) => setPlanFilter(v as typeof planFilter)} options={[['all', 'All plans'], ['free', 'Free'], ['creator', 'Creator'], ['pro', 'Pro'], ['agency', 'Agency']]} />
            <FilterSelect label="Status" value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)} options={[['all', 'All statuses'], ['active', 'Active'], ['suspended', 'Suspended']]} />
            <FilterSelect label="Billing" value={billingFilter} onChange={(v) => setBillingFilter(v as typeof billingFilter)} options={[['all', 'All billing'], ['paying', 'Paid or subscribed'], ['active_subscription', 'Active subscription'], ['never_paid', 'Never paid']]} />
          </FilterBar>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">Account</th><th>Plan</th><th>Credits</th><th>Productions</th><th>Status</th><th>Role</th><th className="pr-4">Joined</th></tr></thead>
              <tbody className="divide-y divide-border">{users.map((user) => <UserRow
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
                onToggleAdmin={(next) => void editUser(user, { isAdmin: next }, next ? `${text(user.email)} is now an administrator.` : `Administrator access removed. ${text(user.email)} is now a customer.`)}
                roleChanged={roleFlash === text(user.id)}
                onViewJobs={() => viewUserJobs(user)}
                onViewDetails={() => void openUserDetails(user)}
              />)}</tbody>
            </table>
          </div>
          {usersLoading && !users.length && <div className="flex items-center justify-center gap-3 p-10 text-sm text-text-dim" role="status"><div className="h-5 w-5 animate-spin rounded-full border-2 border-violet border-t-transparent" /> Loading…</div>}
          {!usersLoading && !usersError && !users.length && <div className="p-10 text-center"><p className="text-sm text-text-dim">No users match.</p>{userFiltersActive && <button type="button" onClick={clearUserFilters} className="mt-3 text-xs font-semibold text-violet hover:underline">Clear filters</button>}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 text-xs text-text-muted"><span>{users.length} of {usersTotal} · page {usersPage} of {Math.max(1, Math.ceil(usersTotal / usersPageSize))}</span><div className="flex gap-2"><button type="button" disabled={busy || usersPage <= 1} onClick={() => setUsersPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-border px-3 py-1.5 hover:text-text-primary disabled:opacity-40">← Previous</button><button type="button" disabled={busy || usersPage >= Math.ceil(usersTotal / usersPageSize)} onClick={() => setUsersPage((page) => page + 1)} className="rounded-lg border border-border px-3 py-1.5 hover:text-text-primary disabled:opacity-40">Next →</button></div></div>
        </section>

        {pendingSignups.length > 0 && <details className="overflow-hidden rounded-2xl border border-border bg-panel">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-text-primary">Waiting for email verification <span className="ml-1 font-normal text-text-dim">({number(userSummary.pending)})</span></summary>
          <div className="divide-y divide-border border-t border-border">
            {pendingSignups.map((item, index) => <div key={`${text(item.email)}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"><span className="font-semibold text-text-primary">{text(item.email)}</span><span className="text-text-dim">expires {date(item.expires_at)}</span></div>)}
          </div>
        </details>}
      </div>}

      {tab === 'jobs' && <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-panel">
        <FilterBar
          search={jobSearch} onSearch={setJobSearch} placeholder="Search title, user, URL or error" moreActive={jobMoreActive} active={jobFiltersActive}
          onClear={() => { setJobSearch(''); setJobSearchBy('all'); setJobStatus('all'); setJobFeature('all'); setJobProvider('all'); setJobCreated('all'); setJobBilling('all'); setJobQuality('all'); setJobSort('newest'); }}
          more={<>
            <FilterSelect label="Search in" value={jobSearchBy} onChange={(v) => setJobSearchBy(v as typeof jobSearchBy)} options={[['all', 'Search everything'], ['title', 'Title'], ['id', 'Production ID'], ['url', 'URL'], ['user', 'User'], ['provider', 'Provider'], ['error', 'Error']]} />
            <FilterSelect label="Provider" value={jobProvider} onChange={(v) => setJobProvider(v as typeof jobProvider)} options={[['all', 'All providers'], ['gemini', 'Gemini'], ['other', 'Other'], ['unassigned', 'Unassigned']]} />
            <FilterSelect label="Created" value={jobCreated} onChange={(v) => setJobCreated(v as typeof jobCreated)} options={dateOptions.map(([id, label]) => [id, id === 'all' ? 'Created any time' : label] as [string, string])} />
            <FilterSelect label="Cost" value={jobBilling} onChange={(v) => setJobBilling(v as typeof jobBilling)} options={[['all', 'Any cost'], ['charged', 'Charged'], ['no_charge', 'No charge']]} />
            <FilterSelect label="Quality" value={jobQuality} onChange={(v) => setJobQuality(v as typeof jobQuality)} options={[['all', 'All quality'], ['1080p', '1080p'], ['4k', '4K']]} />
            <FilterSelect label="Sort" value={jobSort} onChange={(v) => setJobSort(v as typeof jobSort)} options={[['newest', 'Recently updated'], ['oldest', 'Oldest created'], ['highest_cost', 'Highest cost'], ['highest_credits', 'Most credits'], ['most_progress', 'Most progress']]} />
          </>}
        >
          <FilterSelect label="Feature" value={jobFeature} onChange={setJobFeature} options={[['all', 'All features'], ['website-video', 'Website Video'], ['ai-video', 'AI Video'], ['ai-images', 'AI Images'], ['product-photos', 'Product Photos'], ['product-video', 'Product Video'], ['talking-scene', 'Talking Scene'], ['interior-design', 'Interior Design'], ['architecture', 'Architecture']]} />
          <FilterSelect label="Status" value={jobStatus} onChange={setJobStatus} options={[['all', 'All statuses'], ['queued', 'Queued'], ['capturing', 'Capturing'], ['captured', 'Captured'], ['storyboarding', 'Direction'], ['rendering', 'Rendering'], ['done', 'Completed'], ['failed', 'Failed'], ['cancelled', 'Cancelled']]} />
        </FilterBar>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">Production</th><th>User</th><th>Status</th><th>Cost</th><th className="pr-4">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">{jobs.map((job) => <tr key={text(job.id)} className="align-middle">
              <td className="max-w-72 p-4"><p className="truncate font-semibold text-text-primary">{text(job.title || job.source_url)}</p><p className="mt-0.5 text-[11px] text-text-dim">{text(job.feature_label)} · {number(job.duration_seconds)}s · {text(job.output_quality)}</p>{Boolean(job.error_message) && <p className="mt-1 truncate text-[11px] text-pink" title={text(job.error_message)}>{text(job.error_message)}</p>}</td>
              <td className="max-w-48 truncate text-text-muted">{text(job.email)}</td>
              <td><span className={`rounded-full px-2 py-1 text-[10px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span><div className="mt-2 h-1 w-20 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-signature" style={{ width: `${Math.min(100, number(job.progress))}%` }} /></div></td>
              <td><p className="font-utility font-semibold text-text-primary">{number(job.credits_charged)} credits</p><p className="text-[11px] text-text-dim">${number(job.generation_cost_usd).toFixed(3)} AI cost</p></td>
              <td className="pr-4"><div className="flex gap-2">{['queued', 'capturing', 'storyboarding', 'rendering'].includes(text(job.status)) && <button disabled={busy} onClick={() => void updateAdminJob(text(job.id), 'cancel').then(loadJobs)} className="rounded-lg border border-pink/25 px-2.5 py-1.5 text-[11px] font-semibold text-pink">Cancel</button>}<button disabled={busy} onClick={() => { if (window.confirm('Hide this production from the user history?')) void updateAdminJob(text(job.id), 'hide').then(loadJobs); }} className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-text-muted hover:text-text-primary">Hide</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!jobs.length && <Empty>No productions match.</Empty>}
      </section>}

      {tab === 'providers' && settings && <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-panel p-5">
            <div className="flex items-center justify-between gap-4"><h2 className="font-semibold text-text-primary">Gemini</h2><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${providerStatus.geminiApiKey ? 'bg-mint/10 text-mint' : 'bg-pink/10 text-pink'}`}>{providerStatus.geminiApiKey ? 'Ready' : 'Missing key'}</span></div>
            <div className="mt-4 space-y-2">
              {(providerStatus.queues ?? []).map((queue) => <div key={queue.key} className="flex items-center justify-between gap-3 rounded-xl bg-panel-alt px-3 py-2.5 text-xs"><div className="min-w-0"><p className="truncate font-semibold capitalize text-text-primary">{queue.kind} · {queue.model}</p><p className="text-[11px] text-text-dim">{queue.rpm}/min · {queue.concurrency} at once</p></div><div className="shrink-0 text-right font-utility text-text-muted"><p>{queue.active} active</p><p>{queue.waiting} waiting</p>{queue.blockedForMs > 0 && <p className="text-amber-200">backoff {Math.ceil(queue.blockedForMs / 1000)}s</p>}</div></div>)}
              {!providerStatus.queues?.length && <p className="text-xs text-text-dim">Queues appear after the first request.</p>}
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-panel p-5">
            <h2 className="font-semibold text-text-primary">Website controls</h2>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-text-primary">Maintenance mode</p><p className="text-xs text-text-dim">Pause new captures and renders.</p></div><Switch checked={settings.operations.maintenanceMode} onCheckedChange={(maintenanceMode) => setSettings({ ...settings, operations: { ...settings.operations, maintenanceMode } })} /></div>
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-text-primary">Allow registrations</p><p className="text-xs text-text-dim">Let new people sign up.</p></div><Switch checked={settings.operations.registrationsEnabled} onCheckedChange={(registrationsEnabled) => setSettings({ ...settings, operations: { ...settings.operations, registrationsEnabled } })} /></div>
              <label className="block text-sm font-semibold text-text-primary">Max concurrent jobs<input type="number" min="1" max="20" value={settings.operations.maxConcurrentJobs} onChange={(event) => setSettings({ ...settings, operations: { ...settings.operations, maxConcurrentJobs: Number(event.target.value) } })} className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal text-text-primary" /></label>
            </div>
          </div>
        </section>
        <details className="rounded-2xl border border-border bg-panel p-5 xl:col-span-2">
          <summary className="cursor-pointer select-none font-semibold text-text-primary">Cost reference</summary>
          <div className="mt-4 space-y-5">
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-text-dim"><tr><th className="pb-3">Model</th><th>Process</th><th>Usage</th><th>Cost</th></tr></thead><tbody className="divide-y divide-border">{costBreakdown.map((row, index) => <tr key={`${text(row.provider)}-${text(row.operation)}-${index}`}><td className="py-2.5 text-text-primary">{text(row.model)}</td><td className="text-text-muted">{text(row.operation).replaceAll('_', ' ')}</td><td className="text-text-muted">{number(row.quantity).toFixed(2)} {text(row.unit)}</td><td className="font-semibold text-mint">${number(row.cost).toFixed(4)}</td></tr>)}</tbody></table>{!costBreakdown.length && <Empty>Costs appear after the next generation.</Empty>}</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
              ['Text input', `$${(number(costCatalog.text?.inputToken) * 1_000_000).toFixed(2)} / 1M`],
              ['Text output', `$${(number(costCatalog.text?.outputToken) * 1_000_000).toFixed(2)} / 1M`],
              ['Fast video 1080p', `$${number(costCatalog.video?.fast1080).toFixed(2)} / sec`],
              ['Standard video 1080p', `$${number(costCatalog.video?.standard1080).toFixed(2)} / sec`],
              ['Image 2K', `$${number(costCatalog.image?.twoK).toFixed(3)}`],
              ['Image 4K', `$${number(costCatalog.image?.fourK).toFixed(3)}`],
              ['Voice audio', `$${number(costCatalog.ttsAudioSecond).toFixed(4)} / sec`],
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-panel-alt px-3 py-2.5"><p className="text-[11px] text-text-dim">{label}</p><p className="mt-1 font-utility text-sm font-semibold text-text-primary">{value}</p></div>)}</div>
            <VideoCostMatrix rows={videoCostMatrix} />
          </div>
        </details>
      </div>}

      {tab === 'audit' && <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-panel">
        <FilterBar
          search={auditSearch} onSearch={setAuditSearch} placeholder="Search actions, admins or targets" active={auditFiltersActive} moreActive={auditSearchBy !== 'all' || auditCreated !== 'all' || auditSort !== 'newest'}
          onClear={() => { setAuditSearch(''); setAuditSearchBy('all'); setAuditCategory('all'); setAuditCreated('all'); setAuditSort('newest'); }}
          more={<>
            <FilterSelect label="Search in" value={auditSearchBy} onChange={(v) => setAuditSearchBy(v as typeof auditSearchBy)} options={[['all', 'Search everything'], ['action', 'Action'], ['admin', 'Admin'], ['target', 'Target'], ['details', 'Details']]} />
            <FilterSelect label="Time" value={auditCreated} onChange={(v) => setAuditCreated(v as typeof auditCreated)} options={dateOptions} />
            <FilterSelect label="Sort" value={auditSort} onChange={(v) => setAuditSort(v as typeof auditSort)} options={[['newest', 'Newest first'], ['oldest', 'Oldest first']]} />
          </>}
        >
          <FilterSelect label="Type" value={auditCategory} onChange={(v) => setAuditCategory(v as typeof auditCategory)} options={[['all', 'All actions'], ['user', 'Users'], ['job', 'Productions'], ['settings', 'Settings'], ['marketing', 'Homepage']]} />
        </FilterBar>
        <div className="divide-y divide-border">
          {audit.map((event) => <div key={text(event.id)} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:gap-3"><span className="font-semibold text-text-primary">{text(event.action)}</span><span className="truncate text-text-muted">{text(event.admin_email)}</span><span className="truncate text-text-dim">{text(event.target_type)} · {text(event.target_id)}</span><span className="text-text-dim">{date(event.created_at)}</span></div>)}
          {!audit.length && <Empty>No activity matches.</Empty>}
        </div>
      </section>}

      {userDetailsOpen && <UserDetailsModal details={userDetails} loading={userDetailsLoading} onClose={() => { setUserDetailsOpen(false); setUserDetails(null); }} />}
    </main>
  </div>;
}
