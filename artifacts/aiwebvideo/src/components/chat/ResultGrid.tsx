import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/app-button';
import type { JobAsset } from './types';
import { Download, Images, X } from 'lucide-react';

const ASPECT_RATIOS = ['9:16', '1:1', '16:9'] as const;

export function ResultGrid({
  assets,
  onUnlock,
}: {
  assets: JobAsset[];
  onUnlock: () => void;
}) {
  const videos = assets.filter((a) => a.type === 'video');
  const photos = assets.filter((a) => a.type === 'photo');
  const screenshots = assets.filter((a) => a.type === 'screenshot');
  const recordings = assets.filter((a) => a.type === 'recording');
  const anyLocked = assets.some((a) => !a.downloadable);
  const [activeRatio, setActiveRatio] = useState<(typeof ASPECT_RATIOS)[number]>('16:9');
  const [activePhoto, setActivePhoto] = useState<JobAsset | null>(null);

  // `assets` is returned oldest-first. If more than one video somehow exists
  // for this job, always prefer the most recently created one so a retry can
  // never appear to fall back to an older result.
  const activeVideo = videos.find((v) => v.aspectRatio === activeRatio) ?? videos[videos.length - 1];
  const displayPhotos = photos;

  useEffect(() => {
    if (!activePhoto) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setActivePhoto(null); };
    document.addEventListener('keydown', close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', close); document.body.style.overflow = previous; };
  }, [activePhoto]);

  async function downloadFile(asset: JobAsset, index = 0) {
    const response = await fetch(asset.url, { credentials: 'include' });
    if (!response.ok) throw new Error('Download failed');
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `aiwebvideo-${asset.type}-${index + 1}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
  }

  async function downloadAll() {
    const downloads = assets.filter((asset) => asset.downloadable);
    for (const [index, asset] of downloads.entries()) {
      await downloadFile(asset, index).catch(() => {});
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
  }

  if (assets.length === 0) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-panel-alt p-4 text-center animate-fade-in-up">
        <p className="text-sm text-text-muted">Generation finished, but no assets were returned.</p>
        <p className="mt-1 text-xs text-text-dim">Try again — this can happen when the AI service is busy.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-3 animate-fade-in-up">
      {activeVideo && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black">
            <video
              key={activeVideo.id}
              src={activeVideo.url}
              controls
              playsInline
              className="max-h-80 w-full"
            />
            <span className="pointer-events-none absolute bottom-12 right-3 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold tracking-wide text-white/90 backdrop-blur">AiWebVideo</span>
            {!activeVideo.downloadable && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/70 backdrop-blur-sm">
                <p className="text-xs text-text-muted">Watermarked preview</p>
              </div>
            )}
          </div>
          {videos.length > 1 && (
            <div className="flex gap-1.5">
              {ASPECT_RATIOS.map((ratio) => {
                const has = videos.some((v) => v.aspectRatio === ratio);
                if (!has) return null;
                return (
                  <button
                    key={ratio}
                    onClick={() => setActiveRatio(ratio)}
                    className="font-utility rounded-lg border border-border px-2.5 py-1 text-xs text-text-muted
                               hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet
                               data-[active=true]:border-violet data-[active=true]:text-text-primary"
                    data-active={activeRatio === ratio}
                  >
                    {ratio}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {displayPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {displayPhotos.slice(0, 4).map((photo) => (
            <button type="button" key={photo.id} onClick={() => photo.downloadable ? setActivePhoto(photo) : onUnlock()} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-panel-alt text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[7px] font-bold tracking-wide text-white/90">AiWebVideo</span>
              {!photo.downloadable && <div className="absolute inset-0 bg-bg/40 backdrop-blur-[2px]" />}
              <span className="absolute inset-x-2 bottom-2 translate-y-8 rounded-lg bg-black/65 px-2 py-1 text-center text-[10px] text-white backdrop-blur transition-transform group-hover:translate-y-0">View full size</span>
            </button>
          ))}
        </div>
      )}

      {screenshots.length > 0 && (
        <details className="rounded-xl border border-border bg-panel-alt p-3">
          <summary className="cursor-pointer text-xs font-semibold text-text-primary">Saved website screenshots ({screenshots.length})</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {screenshots.slice(0, 6).map((shot) => (
              <button key={shot.id} type="button" onClick={() => setActivePhoto(shot)} className="overflow-hidden rounded-lg border border-border bg-black/30">
                <img src={shot.url} alt="Saved website screenshot" className="aspect-video w-full object-cover object-top" />
              </button>
            ))}
          </div>
        </details>
      )}

      {recordings.map((recording) => (
        <details key={recording.id} className="rounded-xl border border-border bg-panel-alt p-3">
          <summary className="cursor-pointer text-xs font-semibold text-text-primary">Original smooth-scroll capture · source preview only</summary>
          <p className="mt-1 text-[10px] text-text-dim">Kept as a separate source file. It is not inserted into the generated marketing video.</p>
          <div className="relative mt-2 overflow-hidden rounded-lg"><video src={recording.url} controls muted playsInline className="w-full" /><span className="pointer-events-none absolute bottom-10 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white/90">AiWebVideo</span></div>
        </details>
      ))}

      {anyLocked ? (
        <Button variant="primary" size="md" className="w-full" onClick={onUnlock}>
          Sign in to unlock full quality
        </Button>
      ) : (
        <div className="space-y-2">
          {assets.filter((asset) => asset.downloadable).length > 1 && <Button variant="secondary" size="md" className="w-full" onClick={downloadAll}><Images size={15} /> Download all files</Button>}
          <div className="flex flex-wrap gap-2">
          {assets
            .filter((a) => a.downloadable)
            .map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => void downloadFile(a)}
                className="group flex items-center gap-2 rounded-xl border border-border bg-panel-alt px-3.5 py-2.5 text-xs text-text-primary
                           transition-all hover:-translate-y-0.5 hover:border-mint/40 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mint/10 text-mint">↓</span>
                <span className="text-left">
                  <span className="block font-semibold">Download {a.type}</span>
                  <span className="block text-[10px] text-text-dim">{a.aspectRatio ?? 'original'} · full quality</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activePhoto && <div role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setActivePhoto(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
        <div onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl cursor-default overflow-hidden rounded-2xl border border-white/15 bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Photo preview</p>
              <p className="text-[11px] text-text-dim">Click outside or press Esc to close</p>
            </div>
            <button type="button" onClick={() => setActivePhoto(null)} aria-label="Close preview" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-panel-alt text-text-muted transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
          <div className="flex max-h-[58vh] min-h-52 items-center justify-center bg-black/70 p-3 sm:p-5">
            <div className="relative max-h-[52vh] overflow-hidden rounded-lg">
              <img src={activePhoto.url} alt="Image preview" className="max-h-[52vh] max-w-full object-contain" />
              <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/90 backdrop-blur">AiWebVideo</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button type="button" onClick={() => setActivePhoto(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-muted transition hover:bg-white/5 hover:text-text-primary">Close</button>
            <button type="button" onClick={() => void downloadFile(activePhoto)} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-white/90"><Download size={15} /> Download photo</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
