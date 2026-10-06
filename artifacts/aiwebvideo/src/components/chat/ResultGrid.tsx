import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/app-button";
import type { JobAsset } from "./types";
import { CheckCircle2, Clapperboard, Download, Images, Loader2, X } from "lucide-react";
import { ProgressiveImage } from "@/components/ui/ProgressiveImage";
import { imageVariant, videoPoster } from "@/lib/mediaVariants";

const ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

function videoPreviewUrl(url: string) {
  return `${url.split("#", 1)[0]}#t=0.001`;
}

/** The video shows its first frame at once (poster) and says so when it is buffering, instead of a black box. */
function FastVideo({ url, className }: { url: string; className: string }) {
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  useEffect(() => { setReady(false); setBuffering(false); }, [url]);
  const poster = videoPoster(url);
  return (
    <div className="relative">
      {poster && !ready && <img src={poster} alt="" aria-hidden="true" decoding="async" fetchPriority="high" className="pointer-events-none absolute inset-0 h-full w-full object-contain blur-sm" style={{ transform: "scale(1.02)" }} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
      <video
        src={videoPreviewUrl(url)}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="auto"
        onLoadedData={() => setReady(true)}
        onCanPlay={() => { setReady(true); setBuffering(false); }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        className={className}
      />
      {buffering && <span role="status" aria-label="Buffering" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 p-3 text-white backdrop-blur"><Loader2 size={20} className="animate-spin" /></span>}
    </div>
  );
}

export function ResultGrid({ assets, onUnlock, sourceKind = "website", onGeneratedPhotoSelectionChange, selectedGeneratedPhotoIds = [] }: { assets: JobAsset[]; onUnlock: () => void; sourceKind?: "website" | "studio" | "upload"; onGeneratedPhotoSelectionChange?: (assetIds: string[]) => void; selectedGeneratedPhotoIds?: string[] }) {
  const videos = assets.filter((asset) => asset.type === "video");
  const photos = assets.filter((asset) => asset.type === "photo");
  const screenshots = assets.filter((asset) => asset.type === "screenshot");
  const recordings = assets.filter((asset) => asset.type === "recording");
  const anyLocked = assets.some((asset) => !asset.downloadable);
  const [activeRatio, setActiveRatio] = useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [activePhoto, setActivePhoto] = useState<JobAsset | null>(null);
  // Choosing photos for a next video or edit happens on the photos shown below: each one appears once. Ids keep the
  // "generated-photo-N" form the chat already understands.
  const canSelect = Boolean(onGeneratedPhotoSelectionChange);
  const [chosen, setChosen] = useState<string[]>(selectedGeneratedPhotoIds);
  useEffect(() => { setChosen(selectedGeneratedPhotoIds); }, [selectedGeneratedPhotoIds.join("|")]);
  function toggleChosen(photoNumber: number) {
    const id = `generated-photo-${photoNumber}`;
    const next = chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id];
    setChosen(next);
    onGeneratedPhotoSelectionChange?.(next);
  }
  const activeVideo = videos.find((video) => video.aspectRatio === activeRatio) ?? videos[videos.length - 1];

  useEffect(() => {
    for (const photo of photos) {
      const image = new window.Image();
      image.decoding = "async";
      // The right-sized copy, not the 4K master: the full-size viewer loads that only when it is opened.
      image.src = imageVariant(photo.url, 960) ?? photo.url;
    }
  }, [photos.map((photo) => photo.url).join("|")]);

  useEffect(() => {
    if (!activePhoto) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setActivePhoto(null); };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previous;
    };
  }, [activePhoto]);

  function downloadFile(asset: JobAsset, index = 0) {
    const url = new URL(asset.url, window.location.origin);
    url.searchParams.set("download", "1");
    const link = document.createElement("a");
    link.href = url.toString();
    link.download = `aiwebvideo-${asset.type}-${index + 1}`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadAll() {
    const downloads = assets.filter((asset) => asset.downloadable);
    for (const [index, asset] of downloads.entries()) {
      downloadFile(asset, index);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }
  }

  if (!assets.length) return <div className="w-full max-w-4xl rounded-2xl border border-border bg-panel-alt p-5 text-center text-sm text-text-muted">Generation finished, but no assets were returned.</div>;

  return (
    <div className="w-full max-w-4xl space-y-4 animate-fade-in-up">
      {activeVideo && (
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0917] shadow-[0_28px_70px_-38px_rgba(139,92,246,.7)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/10 text-mint"><CheckCircle2 size={16} /></span>
              <div><p className="text-xs font-semibold text-white">Final master is ready</p><p className="text-[9px] text-text-dim">Preview or download</p></div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-text-muted"><Clapperboard size={10} className="text-violet" /> AiWebVideo</span>
          </div>
          <div className="relative min-h-56 overflow-hidden bg-black">
            <FastVideo key={activeVideo.id} url={activeVideo.url} className="max-h-[62vh] min-h-56 w-full bg-black object-contain" />
            <span className="pointer-events-none absolute bottom-14 right-3 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold tracking-wide text-white/90 backdrop-blur">AiWebVideo</span>
            {activeVideo.downloadable && <button type="button" onClick={() => downloadFile(activeVideo)} aria-label="Download video" className="absolute right-2.5 top-2.5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75"><Download size={16} /></button>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            {videos.length > 1 ? <div className="flex gap-1.5">{ASPECT_RATIOS.map((ratio) => videos.some((video) => video.aspectRatio === ratio) ? <button key={ratio} onClick={() => setActiveRatio(ratio)} data-active={activeRatio === ratio} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-white data-[active=true]:border-violet data-[active=true]:text-white">{ratio}</button> : null)}</div> : <span className="text-[9px] uppercase tracking-wider text-text-dim">{activeVideo.aspectRatio || activeRatio} master</span>}
            <div className="flex flex-wrap items-center gap-2">
              {activeVideo.downloadable && <Button variant="secondary" size="sm" onClick={() => downloadFile(activeVideo)}><Download size={14} /> Export video</Button>}
            </div>
          </div>
          <div className="border-t border-white/[.05] px-4 py-2 text-[8px] text-text-dim">Studio opens this exact result with timeline, layers, text, audio, transforms, AI Edit, undo/redo and export.</div>
        </div>
      )}


      {photos.length > 0 && (
        <div className="overflow-hidden rounded-[22px] border border-white/[.09] bg-[#0c0917] p-4 shadow-[0_28px_70px_-42px_rgba(139,92,246,.75)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-semibold text-white">{photos.length === 4 ? "Your 4 generated photos are ready" : "Your generated photos are ready"}</p><p className="mt-1 text-[10px] text-text-dim">{canSelect ? "Open any image full size, download it, or tick the ones to use for your next video or edit." : "Open any image full size, download directly."}</p></div>
            <div className="flex items-center gap-2">{canSelect && chosen.length > 0 && <span className="rounded-full border border-violet/30 bg-violet/10 px-2.5 py-1 text-[9px] font-semibold text-violet">{chosen.length} selected</span>}<span className="rounded-full border border-mint/15 bg-mint/[.07] px-2.5 py-1 text-[9px] font-semibold text-mint">{photos.length} photos</span></div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photos.slice(0, 8).map((photo, index) => (
              <div key={photo.id} className={`group relative min-w-0 ${photo.aspectRatio === "9:16" ? "aspect-[9/16]" : photo.aspectRatio === "16:9" ? "aspect-video" : "aspect-square"} overflow-hidden rounded-[20px] border border-white/[.1] bg-[linear-gradient(145deg,#171229,#0b0912)]`}>
                <button type="button" onClick={() => photo.downloadable ? setActivePhoto(photo) : onUnlock()} aria-label={`Open photo ${index + 1} full size`} className="absolute inset-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
                  <ProgressiveImage src={photo.url} alt={`Generated photo ${index + 1}`} priority={index < 2} className="h-full w-full" />
                  <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">Photo {index + 1}</span>
                  {/* Never covers the picture on a mouse: it appears on hover or focus. On a touchscreen it is a small pill in the corner. */}
                  <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 group-focus-within:opacity-100">View full size</span>
                </button>
                {canSelect && <button type="button" onClick={(event) => { event.stopPropagation(); toggleChosen(index + 1); }} aria-pressed={chosen.includes(`generated-photo-${index + 1}`)} aria-label={`Use photo ${index + 1} for the next video or edit`} className={`absolute bottom-2.5 left-2.5 z-20 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold backdrop-blur transition ${chosen.includes(`generated-photo-${index + 1}`) ? "border-violet bg-violet text-white" : "border-white/15 bg-black/55 text-white hover:bg-black/75"}`}>{chosen.includes(`generated-photo-${index + 1}`) ? "✓ Selected" : "Use for next step"}</button>}
                {photo.downloadable && <button type="button" onClick={(event) => { event.stopPropagation(); downloadFile(photo); }} aria-label="Download photo" className="absolute right-2.5 top-2.5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75"><Download size={13} /></button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {screenshots.length > 0 && <details className="rounded-xl border border-border bg-panel-alt p-3"><summary className="cursor-pointer text-xs font-semibold text-text-primary">{sourceKind === "website" ? "Saved website references" : "Project references"} ({screenshots.length})</summary><div className="mt-2 grid grid-cols-2 gap-2">{screenshots.slice(0, 6).map((shot) => <button key={shot.id} type="button" onClick={() => setActivePhoto(shot)} className="overflow-hidden rounded-lg border border-border bg-black/30"><img src={shot.url} alt="Saved reference" loading="lazy" className="aspect-video w-full object-cover object-top" /></button>)}</div></details>}
      {recordings.map((recording) => <details key={recording.id} className="rounded-xl border border-border bg-panel-alt p-3"><summary className="cursor-pointer text-xs font-semibold text-text-primary">Original source preview</summary><video src={recording.url} controls muted playsInline preload="metadata" className="mt-2 w-full rounded-lg" /></details>)}

      {anyLocked ? <Button variant="primary" size="md" className="w-full" onClick={onUnlock}>Sign in to unlock full quality</Button> : assets.filter((asset) => asset.downloadable).length > 1 && <Button variant="secondary" size="md" className="w-full" onClick={downloadAll}><Images size={15} /> Download all files</Button>}

      {activePhoto && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Photo preview" onClick={() => setActivePhoto(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/65 p-4 backdrop-blur-md">
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-4xl cursor-default overflow-hidden rounded-2xl border border-white/15 bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><p className="text-sm font-semibold text-text-primary">Full-size preview</p><p className="text-[11px] text-text-dim">Click outside or press Esc to close</p></div><button type="button" onClick={() => setActivePhoto(null)} aria-label="Close preview" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel-alt text-text-muted"><X size={18} /></button></div>
            <div className="flex max-h-[76vh] min-h-52 items-center justify-center bg-black/75 p-3 sm:p-5"><div className="relative max-h-[70vh] overflow-hidden rounded-lg">{activePhoto.type === "photo" ? <ProgressiveImage full src={activePhoto.url} alt="Image preview" imgClassName="object-contain" className={`max-h-[70vh] w-[min(100%,56rem)] ${activePhoto.aspectRatio === "9:16" ? "aspect-[9/16]" : activePhoto.aspectRatio === "1:1" ? "aspect-square" : "aspect-video"} bg-transparent`} /> : <img src={activePhoto.url} alt="Image preview" className="max-h-[70vh] max-w-full object-contain" />}{activePhoto.downloadable && <button type="button" onClick={() => downloadFile(activePhoto)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur"><Download size={16} /></button>}</div></div>
          </div>
        </div>, document.body)}
    </div>
  );
}
