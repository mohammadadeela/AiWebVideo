import { useEffect, useRef, useState } from 'react';
import { fetchInspiration, type InspirationFeature, type InspirationMedia } from '@/lib/api-client';
import { trackStudioEvent } from '@/lib/studio-api';

const labels: Array<{ id: InspirationFeature; label: string }> = [
  { id: 'photo', label: 'Product Photos' }, { id: 'product-video', label: 'Product Video' },
  { id: 'website', label: 'Website Video' }, { id: 'video', label: 'AI Video' },
  { id: 'scenario', label: 'Talking Scene' }, { id: 'interior', label: 'Interior' },
  { id: 'architecture', label: 'Architecture' },
];

function InspirationTile({ item, feature, compact }: { item: InspirationMedia; feature?: InspirationFeature; compact: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (!entry.isIntersecting) video.pause(); }, { rootMargin: '120px' });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
  const target = feature && item.features.includes(feature) ? feature : item.features[0];
  const destination = `/dashboard?create=${encodeURIComponent(target)}&inspiration=${encodeURIComponent(item.id)}`;
  return <a href={destination} onClick={() => { void trackStudioEvent({ event: 'inspiration_selected', ideaId: item.id, feature: target, metadata: { mediaType: item.type } }); }} aria-label="Create with this inspiration" className={`group relative block overflow-hidden rounded-xl bg-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${compact ? 'w-36 shrink-0 sm:w-44' : 'mb-2 break-inside-avoid'}`}
    onMouseEnter={() => { if (visible) void videoRef.current?.play().catch(() => {}); }} onMouseLeave={() => videoRef.current?.pause()}
    onFocus={() => { if (visible) void videoRef.current?.play().catch(() => {}); }} onBlur={() => videoRef.current?.pause()}>
    {item.type === 'video'
      ? <video ref={videoRef} src={visible ? item.url : undefined} poster={item.thumbnailUrl} preload="none" muted loop playsInline aria-hidden="true" className={`w-full object-cover ${compact ? 'aspect-[4/3]' : ''}`} />
      : <img src={item.thumbnailUrl} loading="lazy" decoding="async" alt="" className={`w-full object-cover ${compact ? 'aspect-[4/3]' : ''}`} />}
    <span className="absolute inset-x-2 bottom-2 translate-y-1 rounded-lg bg-black/75 px-3 py-2 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">Create with yours</span>
  </a>;
}

export function InspirationGallery({ feature, compact = false }: { feature?: InspirationFeature; compact?: boolean }) {
  const [selectedFeature, setSelectedFeature] = useState<InspirationFeature | undefined>(feature);
  const [type, setType] = useState<'all' | 'image' | 'video'>('all');
  const [items, setItems] = useState<InspirationMedia[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { setSelectedFeature(feature); }, [feature]);
  useEffect(() => {
    let active = true;
    setItems([]); setLoading(true); setError(false);
    void fetchInspiration({ feature: selectedFeature, type: type === 'all' ? undefined : type, limit: compact ? 12 : 18 })
      .then((result) => { if (active) { setItems(result.items); setHasMore(result.hasMore); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedFeature, type, compact]);
  async function more() {
    setLoading(true);
    try {
      const result = await fetchInspiration({ feature: selectedFeature, type: type === 'all' ? undefined : type, offset: items.length, limit: 18 });
      setItems((current) => [...current, ...result.items]); setHasMore(result.hasMore);
    } catch { setError(true); } finally { setLoading(false); }
  }
  if (!items.length && !loading && (compact || (!selectedFeature && type === 'all'))) return null;
  return <section aria-label="Creative inspiration" className={compact ? 'mt-5 max-w-full' : 'mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16'}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h2 className={`font-display font-semibold text-white ${compact ? 'text-sm' : 'text-2xl sm:text-3xl'}`}>{compact ? 'Try a direction' : 'Create with yours'}</h2>
      {!compact && <div className="flex flex-wrap gap-1" aria-label="Media type">{(['all', 'image', 'video'] as const).map((value) => <button type="button" key={value} onClick={() => setType(value)} aria-pressed={type === value} className={`rounded-full px-3 py-1.5 text-xs ${type === value ? 'bg-white text-black' : 'text-text-muted hover:text-white'}`}>{value === 'all' ? 'All' : value === 'image' ? 'Images' : 'Videos'}</button>)}</div>}
    </div>
    {!compact && <div className="mb-5 flex gap-1 overflow-x-auto pb-1" aria-label="Feature filter"><button type="button" aria-pressed={!selectedFeature} onClick={() => setSelectedFeature(undefined)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${!selectedFeature ? 'bg-violet text-white' : 'text-text-muted hover:text-white'}`}>All</button>{labels.map((entry) => <button type="button" key={entry.id} aria-pressed={selectedFeature === entry.id} onClick={() => setSelectedFeature(entry.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${selectedFeature === entry.id ? 'bg-violet text-white' : 'text-text-muted hover:text-white'}`}>{entry.label}</button>)}</div>}
    <div className={compact ? 'flex gap-2 overflow-x-auto pb-2' : 'columns-2 gap-2 sm:columns-3 lg:columns-4'}>{items.map((item) => <InspirationTile key={item.id} item={item} feature={feature} compact={compact} />)}</div>
    {!compact && !loading && !items.length && !error && <p className="py-7 text-center text-xs text-text-muted">No examples in this filter yet.</p>}
    {error && <p role="status" className="mt-3 text-xs text-text-muted">Examples could not be loaded.</p>}
    {!compact && hasMore && <button type="button" disabled={loading} onClick={() => void more()} className="mt-6 rounded-xl border border-white/15 px-4 py-2 text-xs text-white disabled:opacity-50">{loading ? 'Loading…' : 'Show more'}</button>}
  </section>;
}
