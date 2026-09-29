import { useEffect, useMemo, useState } from 'react';
import { fetchAdminInspiration, updateInspirationBulk, uploadInspiration, type InspirationFeature, type InspirationMedia } from '@/lib/api-client';

export const INSPIRATION_FEATURES: Array<{ id: InspirationFeature; label: string }> = [
  { id: 'website', label: 'Website Video' }, { id: 'video', label: 'AI Video' },
  { id: 'photo', label: 'Product Photos' }, { id: 'product-video', label: 'Product Video' },
  { id: 'scenario', label: 'Talking Scene' }, { id: 'interior', label: 'Interior Design' },
  { id: 'architecture', label: 'Architecture' },
];

export function InspirationManager() {
  const [items, setItems] = useState<InspirationMedia[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [features, setFeatures] = useState<InspirationFeature[]>([]);
  const [type, setType] = useState<'all' | 'image' | 'video'>('all');
  const [featureFilter, setFeatureFilter] = useState<'all' | InspirationFeature>('all');
  const [status, setStatus] = useState<'all' | InspirationMedia['status'] | 'unassigned'>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [failures, setFailures] = useState<Array<{ name: string; error: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const reload = async () => setItems((await fetchAdminInspiration()).items);
  useEffect(() => { void reload().catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load media.')); }, []);
  const visible = useMemo(() => items.filter((item) =>
    (type === 'all' || item.type === type) &&
    (featureFilter === 'all' || item.features.includes(featureFilter)) &&
    (status === 'all' || (status === 'unassigned' ? !item.features.length : item.status === status)) &&
    `${item.adminTitle ?? ''} ${item.features.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  ), [items, type, featureFilter, status, search]);
  const chosen = items.filter((item) => selected.includes(item.id));
  const missing = chosen.filter((item) => !item.features.length);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setMessage(null); setFailures([]); setProgress(`Uploading 0 of ${files.length}`);
    try {
      const result = await uploadInspiration(Array.from(files), (done, total) => setProgress(`Processed ${done} of ${total}`));
      setSelected([...new Set(result.items.map((item) => item.id))]);
      await reload();
      setFailures(result.failures);
      setMessage(result.items.length ? `${result.items.length} ready as drafts. Assign features, then publish.` : 'No files were added.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); await reload().catch(() => {}); }
    finally { setBusy(false); setProgress(''); }
  }

  async function bulk(patch: Parameters<typeof updateInspirationBulk>[0]) {
    setBusy(true); setMessage(null);
    try { await updateInspirationBulk(patch); await reload(); if (patch.delete) setSelected([]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save changes.'); }
    finally { setBusy(false); }
  }
  async function move(index: number, direction: -1 | 1) {
    const current = visible[index], neighbor = visible[index + direction];
    if (!current || !neighbor) return;
    setBusy(true); setMessage(null);
    try {
      const a = current.sortOrder === neighbor.sortOrder ? index : current.sortOrder;
      const b = current.sortOrder === neighbor.sortOrder ? index + direction : neighbor.sortOrder;
      await updateInspirationBulk({ ids: [current.id], sortOrder: b });
      await updateInspirationBulk({ ids: [neighbor.id], sortOrder: a });
      await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not reorder media.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-7 space-y-4" aria-label="Inspiration media manager">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-semibold text-white">Inspiration media</h2><p className="mt-1 text-xs text-text-dim">Upload together, assign features, then publish.</p></div>
        <label className="cursor-pointer rounded-xl bg-violet px-4 py-2.5 text-xs font-semibold text-white focus-within:outline focus-within:outline-2 focus-within:outline-mint">
          {progress || (busy ? 'Working…' : 'Add images & videos')}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} />
        </label>
      </div>
      {message && <p role="status" className="rounded-xl bg-white/[.05] px-3 py-2 text-xs text-text-muted">{message}</p>}
      {!!failures.length && <div role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/[.06] p-3 text-xs text-amber-100">
        <p className="font-semibold">{failures.length} file{failures.length === 1 ? '' : 's'} could not be added</p>
        <ul className="mt-1 space-y-1">{failures.map((failure, index) => <li key={`${failure.name}-${index}`} className="break-words">{failure.name}: {failure.error}</li>)}</ul>
      </div>}
      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search media" aria-label="Search media" className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-panel px-3 text-xs text-white sm:max-w-60" />
        <select value={type} onChange={(event) => setType(event.target.value as typeof type)} aria-label="Media type" className="min-h-10 rounded-xl border border-border bg-panel px-3 text-xs text-white"><option value="all">Images & videos</option><option value="image">Images</option><option value="video">Videos</option></select>
        <select value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value as typeof featureFilter)} aria-label="Feature filter" className="min-h-10 rounded-xl border border-border bg-panel px-3 text-xs text-white"><option value="all">All features</option>{INSPIRATION_FEATURES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Media status" className="min-h-10 rounded-xl border border-border bg-panel px-3 text-xs text-white"><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="unassigned">Unassigned</option></select>
        <button type="button" onClick={() => setSelected(visible.map((item) => item.id))} className="min-h-10 rounded-xl px-3 text-xs text-text-muted hover:text-white">Select visible</button>
        <button type="button" onClick={() => setSelected([])} className="min-h-10 rounded-xl px-3 text-xs text-text-muted hover:text-white">Clear</button>
      </div>
      {!!selected.length && (
        <div className="rounded-2xl border border-violet/20 bg-violet/[.04] p-3">
          <p className="text-xs font-semibold text-white">{selected.length} selected{missing.length ? ` · ${missing.length} need a feature` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INSPIRATION_FEATURES.map((item) => <label key={item.id} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-[11px] text-text-muted"><input type="checkbox" checked={features.includes(item.id)} onChange={() => setFeatures((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />{item.label}</label>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy || !features.length} onClick={() => void bulk({ ids: selected, features, featuresMode: 'add' })} className="rounded-lg bg-violet px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add features</button>
            <button type="button" disabled={busy || !features.length} onClick={() => void bulk({ ids: selected, features, featuresMode: 'replace' })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50">Set selected features</button>
            <button type="button" disabled={busy || missing.length > 0} onClick={() => void bulk({ ids: selected, status: 'published' })} className="rounded-lg border border-mint/30 px-3 py-2 text-xs font-semibold text-mint disabled:opacity-40">Publish</button>
            <button type="button" disabled={busy} onClick={() => void bulk({ ids: selected, status: 'hidden' })} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white">Hide</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete ${selected.length} item(s)?`)) void bulk({ ids: selected, delete: true }); }} className="rounded-lg px-3 py-2 text-xs text-pink">Delete</button>
          </div>
          {!!missing.length && <p className="mt-2 text-[11px] text-amber-200">Assign features to: {missing.map((item) => item.adminTitle || item.id.slice(0, 8)).join(', ')}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((item, index) => <article key={item.id} className={`group overflow-hidden rounded-xl border bg-panel ${selected.includes(item.id) ? 'border-violet' : !item.features.length ? 'border-amber-400/40' : 'border-white/10'}`}>
          <button type="button" aria-label={`Select ${item.adminTitle || item.type}`} aria-pressed={selected.includes(item.id)} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="relative block w-full text-left">
            <img src={item.thumbnailUrl} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
            <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-1 text-[10px] text-white">{selected.includes(item.id) ? '✓' : item.type === 'video' ? '▶' : ''}</span>
          </button>
          <div className="space-y-1.5 p-2.5"><p className="truncate text-[11px] font-semibold text-white" title={item.adminTitle ?? ''}>{item.adminTitle || item.type}</p><p className="truncate text-[9px] text-text-dim">{item.features.length ? item.features.map((id) => INSPIRATION_FEATURES.find((feature) => feature.id === id)?.label || id).join(' · ') : 'Assign a feature'}</p>
            <div className="flex items-center justify-between gap-1 text-[9px] text-text-muted"><span>{item.status}</span><button type="button" aria-label={`Toggle featured for ${item.adminTitle}`} onClick={() => void bulk({ ids: [item.id], featured: !item.featured })} className="min-h-7 px-1 hover:text-white">{item.featured ? '★' : '☆'}</button><button type="button" disabled={busy || index === 0} aria-label="Move earlier" onClick={() => void move(index, -1)} className="min-h-7 px-1 hover:text-white disabled:opacity-30">↑</button><button type="button" disabled={busy || index === visible.length - 1} aria-label="Move later" onClick={() => void move(index, 1)} className="min-h-7 px-1 hover:text-white disabled:opacity-30">↓</button></div>
          </div>
        </article>)}
      </div>
      {!items.length && <p className="py-10 text-center text-xs text-text-dim">Upload examples to start the library.</p>}
    </section>
  );
}
