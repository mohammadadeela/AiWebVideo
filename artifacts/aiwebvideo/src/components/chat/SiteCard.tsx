import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { CaptureMetadata } from './types';

export function SiteCard({ sourceUrl, metadata }: { sourceUrl: string; metadata: CaptureMetadata }) {
  const isUpload = sourceUrl.startsWith('upload://');
  let hostname = sourceUrl;
  try { hostname = new URL(sourceUrl).hostname; } catch {}
  const displayName = isUpload ? (metadata.title || 'Your uploaded photos') : hostname;
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    document.addEventListener('keydown', close);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previousOverflow; };
  }, [preview]);

  // Every screenshot we actually captured — desktop/mobile viewports, desktop
  // full page (covered by pages[0]), mobile full page, and every extra page —
  // shown in full, not truncated, so the user sees everything that was saved.
  const allShots = [
    ...(metadata.screenshotUrl ? [{ url: sourceUrl, title: 'Desktop', screenshotUrl: metadata.screenshotUrl }] : []),
    ...(metadata.mobileScreenshotUrl ? [{ url: sourceUrl, title: 'Mobile', screenshotUrl: metadata.mobileScreenshotUrl }] : []),
    ...(metadata.mobileFullPageScreenshotUrl ? [{ url: sourceUrl, title: 'Mobile — full page', screenshotUrl: metadata.mobileFullPageScreenshotUrl }] : []),
    ...(metadata.pages ?? []),
  ].filter((page, index, all) => all.findIndex((item) => item.screenshotUrl === page.screenshotUrl) === index);

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-4 animate-fade-in-up">
      {allShots.length > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-2 gap-2">
            {allShots.map((page, index) => (
              <button
                type="button"
                key={`${page.screenshotUrl}-${index}`}
                onClick={() => setPreview({ url: page.screenshotUrl, title: page.title || displayName })}
                className="overflow-hidden rounded-lg border border-border bg-panel-alt text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
              >
                <img src={page.screenshotUrl} alt={`Saved capture of ${page.title || displayName}`} className="aspect-video w-full object-cover object-top" />
                <p className="truncate border-t border-border px-2 py-1.5 text-[10px] text-text-dim">{page.title || `Page ${index + 1}`}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-text-dim">
            All {allShots.length} saved screenshot{allShots.length === 1 ? '' : 's'} · tap to view full size · reusable in this conversation
          </p>
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
              : `${metadata.pageCount} page${metadata.pageCount === 1 ? '' : 's'} fully loaded and captured`}
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
            <span className="rounded-full border border-border px-2 py-1">Desktop screenshot</span>
            {metadata.mobileScreenshotUrl && <span className="rounded-full border border-border px-2 py-1">Mobile screenshot</span>}
            <span className="rounded-full border border-border px-2 py-1">Full-page capture</span>
            {metadata.logoUrl && <span className="rounded-full border border-violet/30 px-2 py-1 text-violet">Website icon ready</span>}
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
        <div role="dialog" aria-modal="true" aria-label="Screenshot preview" onClick={() => setPreview(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-md sm:p-8">
          <button type="button" onClick={() => setPreview(null)} aria-label="Close preview" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/15"><X size={20} /></button>
          <div onClick={(event) => event.stopPropagation()} className="relative max-h-[88vh] max-w-[94vw] cursor-default overflow-hidden rounded-xl bg-black shadow-2xl">
            <img src={preview.url} alt={preview.title} className="max-h-[88vh] max-w-[94vw] object-contain" />
            <span className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-bold tracking-wide text-white/90 backdrop-blur">{preview.title}</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
