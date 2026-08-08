import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link } from 'wouter';
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, DollarSign, FileVideo, KeyRound, LayoutDashboard, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Users, type LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/app-button';
import { Switch } from '@/components/ui/switch';
import { Wordmark } from '@/components/ui/Wordmark';
import { fetchAdminAudit, fetchAdminJobs, fetchAdminOverview, fetchAdminUsers, fetchMe, saveAdminSettings, updateAdminJob, updateAdminUser, type AdminSettings, type ProviderChoice } from '@/lib/api-client';
import { watchAuthState } from '@/lib/firebase/client';

type Tab = 'overview' | 'users' | 'jobs' | 'providers' | 'audit';
type Row = Record<string, unknown>;
type MetricCard = [label: string, value: string, icon: ComponentType<LucideProps>, hint: string];
const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'jobs', label: 'Productions', icon: FileVideo },
  { id: 'providers', label: 'Providers & controls', icon: SlidersHorizontal },
  { id: 'audit', label: 'Audit log', icon: ShieldCheck },
];

function number(value: unknown) { return Number(value ?? 0); }
function text(value: unknown) { return String(value ?? '—'); }
function date(value: unknown) { return value ? new Date(String(value)).toLocaleString() : '—'; }
function statusClass(value: unknown) {
  const status = String(value);
  if (['done', 'active'].includes(status)) return 'bg-mint/10 text-mint';
  if (['failed', 'suspended'].includes(status)) return 'bg-pink/10 text-pink';
  return 'bg-violet/10 text-violet';
}

function ProviderSelector({ label, description, value, onChange, availability }: { label: string; description: string; value: ProviderChoice; onChange: (value: ProviderChoice) => void; availability?: { gemini?: boolean; openSource?: boolean } }) {
  return <div className="rounded-2xl border border-border bg-panel-alt p-5">
    <div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-text-primary">{label}</p><p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p></div><Cpu className="text-violet" size={20} /></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {(['auto', 'gemini', 'open_source'] as ProviderChoice[]).map((choice) => <button key={choice} type="button" onClick={() => onChange(choice)} className={`rounded-xl border px-3 py-3 text-left transition ${value === choice ? 'border-violet bg-violet/15 text-text-primary' : 'border-border bg-bg/30 text-text-muted hover:border-violet/40'}`}><span className="block text-xs font-semibold capitalize">{choice.replace('_', ' ')}</span><span className="mt-1 block text-[9px] text-text-dim">{choice === 'auto' ? 'Best available with fallback' : choice === 'gemini' ? (availability?.gemini ? 'Configured' : 'Not configured') : (availability?.openSource ? 'Configured' : 'Not configured')}</span></button>)}
    </div>
  </div>;
}

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [overview, setOverview] = useState<Row | null>(null);
  const [users, setUsers] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [search, setSearch] = useState('');
  const [jobStatus, setJobStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const data = await fetchAdminOverview();
    setOverview(data);
    setSettings({ providers: data.providers, operations: data.operations });
  }, []);
  const loadUsers = useCallback(async () => setUsers((await fetchAdminUsers(search)).users), [search]);
  const loadJobs = useCallback(async () => setJobs((await fetchAdminJobs(jobStatus, search)).jobs), [jobStatus, search]);
  const loadAudit = useCallback(async () => setAudit((await fetchAdminAudit()).events), []);

  useEffect(() => watchAuthState((user) => {
    if (!user) { setChecked(true); setAllowed(false); return; }
    void fetchMe().then((me) => { setAllowed(me.isAdmin); setChecked(true); if (me.isAdmin) void loadOverview(); }).catch(() => { setAllowed(false); setChecked(true); });
  }), [loadOverview]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(() => {
      if (tab === 'users') void loadUsers();
      if (tab === 'jobs') void loadJobs();
      if (tab === 'audit') void loadAudit();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [allowed, tab, loadUsers, loadJobs, loadAudit]);

  const providerStatus = (overview?.providerStatus ?? {}) as { image?: { gemini?: boolean; openSource?: boolean }; video?: { gemini?: boolean; openSource?: boolean }; runpodApiKey?: boolean; cloudinary?: boolean };
  const userStats = (overview?.users ?? {}) as Row;
  const jobStats = (overview?.jobs ?? {}) as Row;
  const usage = (overview?.usage ?? {}) as Row;
  const recentJobs = (overview?.recentJobs ?? []) as Row[];

  async function refresh() {
    setBusy(true); setMessage(null);
    try {
      await loadOverview();
      if (tab === 'users') await loadUsers();
      if (tab === 'jobs') await loadJobs();
      if (tab === 'audit') await loadAudit();
    } catch { setMessage('The control center could not refresh. Check the server connection.'); }
    finally { setBusy(false); }
  }

  async function saveSettings() {
    if (!settings) return;
    setBusy(true); setMessage(null);
    try { await saveAdminSettings(settings); await loadOverview(); setMessage('Runtime controls saved. New generations will use this configuration.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Settings could not be saved.'); }
    finally { setBusy(false); }
  }

  async function editUser(user: Row, patch: { plan?: string; creditsBalance?: number; accountStatus?: string; isAdmin?: boolean }) {
    setBusy(true); setMessage(null);
    try { await updateAdminUser(text(user.id), patch); await loadUsers(); setMessage('User account updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'User could not be updated.'); }
    finally { setBusy(false); }
  }

  if (!checked) return <div className="flex min-h-screen items-center justify-center bg-bg"><div className="h-9 w-9 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div>;
  if (!allowed) return <main className="flex min-h-screen items-center justify-center bg-bg px-5"><div className="max-w-md rounded-3xl border border-border bg-panel p-8 text-center"><ShieldCheck size={38} className="mx-auto text-violet" /><h1 className="mt-4 font-display text-2xl font-bold text-text-primary">Administrator access only</h1><p className="mt-2 text-sm text-text-muted">This protected control center is available only to approved administrator accounts.</p><Link href="/dashboard"><Button className="mt-6">Return to workspace</Button></Link></div></main>;

  return <div className="min-h-screen bg-bg lg:flex">
    <aside className="border-b border-border bg-[#100c20] p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between"><Link href="/"><Wordmark /></Link><span className="rounded-full bg-violet/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-violet">Admin</span></div>
      <nav className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-1">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${tab === item.id ? 'bg-violet/15 text-text-primary' : 'text-text-muted hover:bg-white/5 hover:text-text-primary'}`}><item.icon size={16} />{item.label}</button>)}</nav>
      <div className="mt-6 hidden rounded-2xl border border-border bg-panel/60 p-4 lg:block"><p className="text-xs font-semibold text-text-primary">Protected controls</p><p className="mt-1 text-[10px] leading-relaxed text-text-dim">Provider credentials stay server-side. This page shows readiness only, never secret values.</p></div>
      <Link href="/dashboard" className="mt-4 hidden rounded-xl border border-border px-3 py-2.5 text-center text-xs text-text-muted hover:text-text-primary lg:block">← User workspace</Link>
    </aside>

    <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">Operations</p><h1 className="mt-1 font-display text-2xl font-bold text-text-primary sm:text-3xl">Admin control center</h1><p className="mt-1 text-sm text-text-muted">Users, productions, providers, costs, availability, and safety controls.</p></div><Button variant="secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={15} className={busy ? 'animate-spin' : ''} /> Refresh</Button></header>
      {message && <div className="mt-5 rounded-xl border border-violet/25 bg-violet/10 px-4 py-3 text-sm text-text-muted">{message}</div>}

      {tab === 'overview' && <div className="mt-7 space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([
          ['Total users', number(userStats.total), Users, 'All registered accounts'],
          ['Running jobs', number(jobStats.running), Activity, 'Live productions'],
          ['Completed', number(jobStats.done), CheckCircle2, 'Successful deliveries'],
          ['Month cost', `$${number(usage.cost).toFixed(2)}`, DollarSign, `${number(usage.gpu_seconds).toFixed(0)} GPU seconds`],
        ] as MetricCard[]).map(([label, value, Icon, hint]) => <div key={label} className="rounded-2xl border border-border bg-panel p-5"><div className="flex items-center justify-between"><p className="text-xs text-text-muted">{label}</p><Icon size={17} className="text-violet" /></div><p className="mt-3 font-utility text-2xl font-bold text-text-primary">{value}</p><p className="mt-1 text-[10px] text-text-dim">{hint}</p></div>)}</section>
        <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-3xl border border-border bg-panel p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-text-primary">Recent productions</h2><p className="text-xs text-text-dim">Latest activity across all users</p></div><button onClick={() => setTab('jobs')} className="text-xs font-semibold text-violet">View all</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-text-dim"><tr><th className="pb-3">Project</th><th>User</th><th>Status</th><th>Provider</th><th>Cost</th></tr></thead><tbody className="divide-y divide-border">{recentJobs.map((job) => <tr key={text(job.id)}><td className="max-w-52 truncate py-3 font-semibold text-text-primary">{text(job.title || job.source_url)}</td><td className="text-text-muted">{text(job.email)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span></td><td className="text-text-muted">{text(job.generation_provider)}</td><td className="text-text-muted">${number(job.generation_cost_usd).toFixed(3)}</td></tr>)}</tbody></table></div></div>
        <div className="space-y-3 rounded-3xl border border-border bg-panel p-5"><h2 className="font-semibold text-text-primary">System readiness</h2>{[['Gemini images', providerStatus.image?.gemini], ['Open-source images', providerStatus.image?.openSource], ['Gemini videos', providerStatus.video?.gemini], ['Open-source videos', providerStatus.video?.openSource], ['RunPod access', providerStatus.runpodApiKey], ['Cloud storage', providerStatus.cloudinary]].map(([label, ready]) => <div key={String(label)} className="flex items-center justify-between rounded-xl bg-panel-alt px-3 py-2.5"><span className="text-xs text-text-muted">{String(label)}</span><span className={`flex items-center gap-1.5 text-[10px] font-semibold ${ready ? 'text-mint' : 'text-pink'}`}>{ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{ready ? 'Ready' : 'Missing'}</span></div>)}</div></section>
      </div>}

      {(tab === 'users' || tab === 'jobs') && <div className="mt-7 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === 'users' ? 'Search users by email' : 'Search projects, URLs, or users'} className="w-full rounded-xl border border-border bg-panel py-3 pl-9 pr-3 text-xs text-text-primary outline-none focus:border-violet/50" /></div>{tab === 'jobs' && <select value={jobStatus} onChange={(event) => setJobStatus(event.target.value)} className="rounded-xl border border-border bg-panel px-4 py-3 text-xs text-text-primary"><option value="all">All statuses</option><option value="rendering">Rendering</option><option value="done">Completed</option><option value="failed">Failed</option><option value="capturing">Capturing</option></select>}</div>}

      {tab === 'users' && <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel"><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">User</th><th>Plan</th><th>Credits</th><th>Projects</th><th>Used</th><th>Status</th><th>Admin</th><th className="pr-4">Joined</th></tr></thead><tbody className="divide-y divide-border">{users.map((user) => <tr key={text(user.id)} className="hover:bg-white/[.02]"><td className="p-4 font-semibold text-text-primary">{text(user.email)}</td><td><select value={text(user.plan)} disabled={busy} onChange={(event) => void editUser(user, { plan: event.target.value })} className="rounded-lg border border-border bg-bg px-2 py-1.5 capitalize text-text-muted"><option>free</option><option>creator</option><option>pro</option><option>agency</option></select></td><td><input type="number" min="0" defaultValue={number(user.credits_balance)} onBlur={(event) => { const value = Number(event.target.value); if (value !== number(user.credits_balance)) void editUser(user, { creditsBalance: value }); }} className="w-24 rounded-lg border border-border bg-bg px-2 py-1.5 text-text-primary" /></td><td className="text-text-muted">{number(user.job_count)}</td><td className="text-text-muted">{number(user.credits_used)}</td><td><button disabled={busy} onClick={() => void editUser(user, { accountStatus: text(user.account_status) === 'active' ? 'suspended' : 'active' })} className={`rounded-full px-2.5 py-1 text-[9px] font-semibold capitalize ${statusClass(user.account_status)}`}>{text(user.account_status)}</button></td><td><Switch checked={Boolean(user.is_admin)} disabled={busy} onCheckedChange={(checked) => void editUser(user, { isAdmin: checked })} /></td><td className="pr-4 text-text-dim">{date(user.created_at)}</td></tr>)}</tbody></table></div>{!users.length && <p className="p-10 text-center text-sm text-text-dim">No users match this search.</p>}</section>}

      {tab === 'jobs' && <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-panel"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="border-b border-border bg-panel-alt text-text-dim"><tr><th className="p-4">Production</th><th>User</th><th>Status</th><th>Progress</th><th>Provider</th><th>GPU</th><th>Cost</th><th>Credits</th><th className="pr-4">Actions</th></tr></thead><tbody className="divide-y divide-border">{jobs.map((job) => <tr key={text(job.id)}><td className="max-w-64 p-4"><p className="truncate font-semibold text-text-primary">{text(job.title || job.source_url)}</p><p className="mt-1 truncate text-[9px] text-text-dim">{text(job.source_url)}</p>{Boolean(job.error_message) && <p className="mt-1 max-w-64 truncate text-[9px] text-pink" title={text(job.error_message)}>{text(job.error_message)}</p>}</td><td className="text-text-muted">{text(job.email)}</td><td><span className={`rounded-full px-2 py-1 text-[9px] capitalize ${statusClass(job.status)}`}>{text(job.status)}</span></td><td><div className="w-24"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-signature" style={{ width: `${Math.min(100, number(job.progress))}%` }} /></div><span className="text-[9px] text-text-dim">{number(job.progress)}%</span></div></td><td className="max-w-36 truncate text-text-muted">{text(job.generation_provider)}</td><td className="text-text-muted">{number(job.gpu_seconds).toFixed(0)}s</td><td className="text-text-muted">${number(job.generation_cost_usd).toFixed(3)}</td><td className="text-text-muted">{number(job.credits_spent)}</td><td className="pr-4"><div className="flex gap-2">{['queued','capturing','storyboarding','rendering'].includes(text(job.status)) && <button disabled={busy} onClick={() => void updateAdminJob(text(job.id), 'cancel').then(loadJobs)} className="rounded-lg border border-pink/25 px-2 py-1.5 text-[9px] font-semibold text-pink">Cancel</button>}<button disabled={busy} onClick={() => { if (window.confirm('Hide this production from the user history?')) void updateAdminJob(text(job.id), 'hide').then(loadJobs); }} className="rounded-lg border border-border px-2 py-1.5 text-[9px] text-text-muted">Hide</button></div></td></tr>)}</tbody></table></div>{!jobs.length && <p className="p-10 text-center text-sm text-text-dim">No productions match these filters.</p>}</section>}

      {tab === 'providers' && settings && <div className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><section className="space-y-4"><ProviderSelector label="Image generation" description="Choose the engine used for new campaign photos." value={settings.providers.image} availability={providerStatus.image} onChange={(image) => setSettings({ ...settings, providers: { ...settings.providers, image } })} /><ProviderSelector label="Video generation" description="Choose the engine used for every newly generated scene." value={settings.providers.video} availability={providerStatus.video} onChange={(video) => setSettings({ ...settings, providers: { ...settings.providers, video } })} /><div className="rounded-2xl border border-border bg-panel p-5"><div className="flex items-center justify-between"><div><p className="font-semibold text-text-primary">Automatic fallback</p><p className="mt-1 text-xs text-text-muted">If open source fails, use the configured commercial provider instead.</p></div><Switch checked={settings.providers.fallbackEnabled} onCheckedChange={(fallbackEnabled) => setSettings({ ...settings, providers: { ...settings.providers, fallbackEnabled } })} /></div></div></section><section className="space-y-4"><div className="rounded-2xl border border-border bg-panel p-5"><h2 className="font-semibold text-text-primary">Website controls</h2><div className="mt-4 space-y-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-text-primary">Maintenance mode</p><p className="text-[10px] text-text-dim">Pause new captures and renders for users.</p></div><Switch checked={settings.operations.maintenanceMode} onCheckedChange={(maintenanceMode) => setSettings({ ...settings, operations: { ...settings.operations, maintenanceMode } })} /></div><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-text-primary">Allow registrations</p><p className="text-[10px] text-text-dim">Permit new accounts to sign up.</p></div><Switch checked={settings.operations.registrationsEnabled} onCheckedChange={(registrationsEnabled) => setSettings({ ...settings, operations: { ...settings.operations, registrationsEnabled } })} /></div><label className="block"><span className="text-xs font-semibold text-text-primary">Maximum concurrent jobs</span><input type="number" min="1" max="20" value={settings.operations.maxConcurrentJobs} onChange={(event) => setSettings({ ...settings, operations: { ...settings.operations, maxConcurrentJobs: Number(event.target.value) } })} className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text-primary" /></label></div></div><div className="rounded-2xl border border-mint/20 bg-mint/5 p-4 text-xs leading-relaxed text-text-muted"><KeyRound size={17} className="mb-2 text-mint" />API keys remain in <code>.env.local</code>. Only provider choices and operational controls are stored in the database.</div><Button className="w-full" disabled={busy} onClick={() => void saveSettings()}><Settings2 size={15} /> Save runtime controls</Button></section></div>}

      {tab === 'audit' && <section className="mt-7 rounded-3xl border border-border bg-panel p-5"><div className="flex items-center gap-3"><Database size={18} className="text-violet" /><div><h2 className="font-semibold text-text-primary">Administrator audit log</h2><p className="text-xs text-text-dim">Permanent record of sensitive control changes.</p></div></div><div className="mt-5 divide-y divide-border">{audit.map((event) => <div key={text(event.id)} className="grid gap-2 py-3 text-xs sm:grid-cols-[1fr_1fr_1fr_auto]"><span className="font-semibold text-text-primary">{text(event.action)}</span><span className="text-text-muted">{text(event.admin_email)}</span><span className="text-text-dim">{text(event.target_type)} · {text(event.target_id)}</span><span className="text-text-dim">{date(event.created_at)}</span></div>)}{!audit.length && <p className="py-10 text-center text-text-dim">No administrator actions recorded yet.</p>}</div></section>}
    </main>
  </div>;
}
