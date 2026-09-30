import { useEffect, useRef, useState } from 'react';
import { FolderClock } from 'lucide-react';
import { fetchSavedReferences, type SavedReference } from '@/lib/api-client';
import { CreatorPopover } from './CreatorPopover';

export function SavedReferencePicker({ onSelect, disabled }: {
  onSelect: (item: SavedReference) => void | Promise<void>; disabled?: boolean;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(false);
    void fetchSavedReferences().then((result) => { if (active) setItems(result.items); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);

  return <>
    <button type="button" ref={anchor} onClick={() => setOpen((value) => !value)} disabled={disabled}
      aria-label="Use a saved reference" aria-expanded={open} title="Use a saved reference"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-white/[.075] hover:text-white disabled:opacity-50">
      <FolderClock size={17} />
    </button>
    {open && <CreatorPopover anchor={anchor} onClose={() => setOpen(false)} label="Saved references" width={340}>
      <p className="px-2 py-1.5 text-xs font-semibold text-white">Your saved references</p>
      {loading && <p role="status" className="p-3 text-xs text-text-muted">Loading…</p>}
      {error && <p role="alert" className="p-3 text-xs text-amber-200">Could not load your files. Try again.</p>}
      {!loading && !error && !items.length && <p className="p-3 text-xs text-text-muted">Your earlier project files will appear here.</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => <button key={`${item.jobId}-${item.index}`} type="button" onClick={() => { setOpen(false); void onSelect(item); }}
          title={item.title} aria-label={`Use ${item.title}`} className="group min-w-0 overflow-hidden rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">
          <img src={item.thumbnailUrl} alt="" loading="lazy" className="aspect-square w-full object-cover transition group-hover:opacity-80" />
          <span className="block truncate px-1 py-1 text-[10px] text-text-muted">{item.title}</span>
        </button>)}
      </div>
    </CreatorPopover>}
  </>;
}
