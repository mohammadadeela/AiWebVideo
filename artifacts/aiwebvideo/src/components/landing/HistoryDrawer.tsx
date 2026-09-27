import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowUpRight, Clock3, Film, X } from 'lucide-react';
import { fetchUserJobs, type UserJobSummary } from '@/lib/api-client';

const tabs = [
  { id: 'website-video', label: 'Website Video' },
  { id: 'ai-video', label: 'AI Video' },
  { id: 'product-photos', label: 'Product Photos' },
  { id: 'product-video', label: 'Product Video' },
  { id: 'talking-scene', label: 'Talking Person' },
  { id: 'interior-design', label: 'Interior Design' },
] as const;

function currentTab() {
  const intent = new URLSearchParams(window.location.search).get('create');
  return ({ website: 'website-video', video: 'ai-video', photo: 'product-photos', 'product-video': 'product-video', scenario: 'talking-scene', interior: 'interior-design' } as Record<string, string>)[intent ?? ''] ?? 'website-video';
}

export function HistoryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState(currentTab);
  const [jobs, setJobs] = useState<UserJobSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setTab(currentTab());
    setLoading(true);
    let active = true;
    void fetchUserJobs().then(({ jobs: items }) => { if (active) setJobs(items); }).catch(() => { if (active) setError('Could not load your creations. Try reopening this panel.'); }).finally(() => { if (active) setLoading(false); });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { active = false; window.removeEventListener('keydown', escape); };
  }, [open, onClose]);
  if (!open) return null;
  const visible = tab === 'all' ? jobs : jobs.filter((job) => job.featureType === tab || (tab === 'product-photos' && job.featureType === 'ai-images'));
  return createPortal(<div className="fixed inset-0 z-[10001]" role="dialog" aria-modal="true" aria-label="My creations">
    <button type="button" onClick={onClose} aria-label="Close creations" className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
    <section className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#15121e] shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[460px] sm:rounded-none sm:border-l">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-5"><div><h2 className="text-lg font-semibold text-white">My creations</h2><p className="mt-0.5 text-xs text-white/45">Pick up where you left off.</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white/65 hover:bg-white/10"><X size={17} /></button></header>
      <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-5 py-3 [scrollbar-width:none]" role="tablist" aria-label="Creation type">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs transition ${tab === item.id ? 'border-white/40 bg-white text-[#15121e]' : 'border-white/10 text-white/55 hover:text-white'}`}>{item.label}</button>)}<button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')} className={`shrink-0 rounded-full border px-3 py-2 text-xs ${tab === 'all' ? 'border-white/40 bg-white text-[#15121e]' : 'border-white/10 text-white/55 hover:text-white'}`}>View all</button></div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">{loading ? <p className="py-16 text-center text-sm text-white/50">Loading creations…</p> : error ? <p className="py-16 text-center text-sm text-white/50">{error}</p> : visible.length ? visible.map((job) => <article key={job.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/5 text-white/30">{job.previewUrl || job.screenshotUrl ? <img src={job.previewUrl ?? job.screenshotUrl ?? ''} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Film size={24} />}</div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-5 text-white">{job.prompt || job.title}</p><div className="mt-1 flex items-center gap-1 text-[11px] text-white/40"><Clock3 size={11} />{new Date(job.createdAt).toLocaleDateString()} · {job.status}</div><div className="mt-2 flex items-center gap-3"><a href={`/?create=${({ 'website-video':'website', 'ai-video':'video', 'product-photos':'photo', 'product-video':'product-video', 'talking-scene':'scenario', 'interior-design':'interior' } as Record<string,string>)[job.featureType] ?? 'website'}&job=${encodeURIComponent(job.id)}#generate`} className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-[#b59aff]">Reopen <ArrowUpRight size={13} /></a>{job.downloadUrl && <a href={job.downloadUrl} download className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">Download <ArrowDownToLine size={13} /></a>}</div></div></article>) : <p className="py-16 text-center text-sm text-white/45">Your creations will appear here.</p>}</div>
    </section>
  </div>, document.body);
}
