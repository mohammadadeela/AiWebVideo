import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CaptureMetadata } from './types';

export function SiteCard({ sourceUrl, metadata }: { sourceUrl: string; metadata: CaptureMetadata }) {
  const isUpload = sourceUrl.startsWith('upload://');
  let hostname = sourceUrl;
  try { hostname = new URL(sourceUrl).hostname; } catch {}
  const displayName = isUpload ? (metadata.title || 'Your uploaded photos') : hostname;
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Keep the visible capture rail focused on the strongest reusable desktop
  // screenshots. Mobile captures may still exist in backend metadata, but we do
  // not prioritize them in the UI because they often duplicate the same page.
  const allShots = useMemo(() => {
    const pageShots = metadata.pages ?? [];
    const preferred = pageShots.length > 0
      ? pageShots
      : [
          ...(metadata.fullPageScreenshotUrl ? [{ url: sourceUrl, title: 'Homepage', screenshotUrl: metadata.fullPageScreenshotUrl }] : []),
          ...(metadata.screenshotUrl ? [{ url: sourceUrl, title: 'Homepage viewport', screenshotUrl: metadata.screenshotUrl }] : []),
        ];
    return preferred.filter((page, index, all) => all.findIndex((item) => item.screenshotUrl === page.screenshotUrl) === index);
  }, [metadata, sourceUrl]);

  const preview = previewIndex === null ? null : allShots[previewIndex] ?? null;

  useEffect(() => {
    if (previewIndex === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewIndex(null);
      if (event.key === 'ArrowRight') setPreviewIndex((current) => current === null ? null : Math.min(allShots.length - 1, current + 1));
      if (event.key === 'ArrowLeft') setPreviewIndex((current) => current === null ? null : Math.max(0, current - 1));
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previousOverflow; };
  }, [previewIndex, allShots.length]);

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-4 animate-fade-in-up">
      {allShots.length > 0 && (
        <div className="mb-3 rounded-xl border border-white/[.08] bg-white/[.025] p-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-text-primary">Best website references</p>
              <p className="mt-0.5 text-[10px] leading-5 text-text-dim">Only distinct, useful pages are kept. Scroll sideways to review them or tap any card for the full preview.</p>
            </div>
            <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint">{allShots.length} saved</span>
          </div>
          <div className="chat-scroll flex gap-3 overflow-x-auto pb-2">
            {allShots.map((page, index) => (
              <button
                type="button"
                key={`${page.screenshotUrl}-${index}`}
                onClick={() => setPreviewIndex(index)}
                className="group w-48 shrink-0 overflow-hidden rounded-xl border border-border bg-panel-alt text-left transition hover:border-violet/35 hover:bg-white/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet sm:w-56"
              >
                <div className="relative">
                  <img src={page.screenshotUrl} alt={`Saved capture of ${page.title || displayName}`} className="aspect-[16/10] w-full object-cover object-top" />
                  <span className="absolute left-2 top-2 rounded-full border border-black/10 bg-black/60 px-2 py-1 font-utility text-[8px] uppercase tracking-[.12em] text-white/85">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <p className="truncate border-t border-border px-3 py-2 text-[10px] text-text-dim">{page.title || `Page ${index + 1}`}</p>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-panel-alt border border-border overflow-hidden">
          {metadata.logoUrl ? (
            <img src={metadata.logoUrl} alt="" width={28} height={28} className="object-contain" />
          ) : (
            <span className="text-text-dim text-xs font-utility">{displayName.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
          <p className="font-utility text-xs text-text-dim">
            {isUpload
              ? `${metadata.pageCount} photo${metadata.pageCount === 1 ? '' : 's'} saved`
              : `${metadata.pageCount} distinct page${metadata.pageCount === 1 ? '' : 's'} selected`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-text-muted">Brand colors</span>
        <div className="flex gap-1.5">
          {metadata.brandColors.slice(0, 5).map((color) => (
            <span
              key={color}
              title={color}
              className="h-5 w-5 rounded-full border border-white/15"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-text-dim">
        {isUpload ? (
          <span className="rounded-full border border-border px-2 py-1">Uploaded photos</span>
        ) : (
          <>
            <span className="rounded-full border border-border px-2 py-1">Desktop reference</span>
            {metadata.mobileScreenshotUrl && <span className="rounded-full border border-border px-2 py-1">Mobile screenshot</span>}
            <span className="rounded-full border border-border px-2 py-1">Homepage detail</span>
            {metadata.logoUrl && <span className="rounded-full border border-violet/30 px-2 py-1 text-violet">Brand mark ready</span>}
          </>
        )}
        {metadata.recordingUrl && <span className="rounded-full border border-mint/30 px-2 py-1 text-mint">Scroll recording ready</span>}
      </div>
      {/* Shown directly (not collapsed) so the recording is never missed. */}
      {metadata.recordingUrl && (
        <div className="mt-3 rounded-lg border border-border bg-panel-alt p-2.5">
          <p className="mb-2 text-xs font-semibold text-text-primary">Smooth-scroll recording</p>
          <video src={metadata.recordingUrl} controls muted playsInline className="aspect-video w-full rounded-md bg-black" />
        </div>
      )}

      {/* Portal to document.body — see the comment in AuthModal.tsx; this
          preview opens from inside animated chat cards, whose transform
          would otherwise break a plain `position: fixed` child. */}
      {preview && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={() => setPreviewIndex(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-md sm:p-8">
          <button type="button" onClick={() => setPreviewIndex(null)} aria-label="Close preview" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/15"><X size={20} /></button>
          {previewIndex !== null && previewIndex > 0 && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); setPreviewIndex((current) => current === null ? null : Math.max(0, current - 1)); }}
              aria-label="Previous screenshot"
              className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/15"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {previewIndex !== null && previewIndex < allShots.length - 1 && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); setPreviewIndex((current) => current === null ? null : Math.min(allShots.length - 1, current + 1)); }}
              aria-label="Next screenshot"
              className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/15"
            >
              <ChevronRight size={22} />
            </button>
          )}
          <div onClick={(event) => event.stopPropagation()} className="relative max-h-[88vh] max-w-[94vw] cursor-default overflow-hidden rounded-xl bg-black shadow-2xl">
            <img src={preview.screenshotUrl} alt={preview.title || displayName} className="max-h-[88vh] max-w-[94vw] object-contain" />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 rounded-xl bg-black/50 px-3 py-2 backdrop-blur">
              <span className="truncate text-xs font-bold tracking-wide text-white/90">{preview.title || displayName}</span>
              <span className="shrink-0 text-[11px] text-white/70">{(previewIndex ?? 0) + 1} / {allShots.length}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
