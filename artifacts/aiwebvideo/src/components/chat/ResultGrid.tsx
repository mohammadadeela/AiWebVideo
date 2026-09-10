import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/app-button";
import type { JobAsset } from "./types";
import { CheckCircle2, Clapperboard, Download, Images, X } from "lucide-react";

const ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

export function ResultGrid({ assets, onUnlock, sourceKind = "website" }: { assets: JobAsset[]; onUnlock: () => void; sourceKind?: "website" | "studio" | "upload" }) {
  const videos = assets.filter((asset) => asset.type === "video");
  const photos = assets.filter((asset) => asset.type === "photo");
  const screenshots = assets.filter((asset) => asset.type === "screenshot");
  const recordings = assets.filter((asset) => asset.type === "recording");
  const anyLocked = assets.some((asset) => !asset.downloadable);
  const [activeRatio, setActiveRatio] = useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [activePhoto, setActivePhoto] = useState<JobAsset | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const activeVideo = videos.find((video) => video.aspectRatio === activeRatio) ?? videos[videos.length - 1];

  useEffect(() => {
    for (const photo of photos) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = photo.url;
    }
  }, [photos.map((photo) => photo.url).join("|")]);

  useEffect(() => { setVideoReady(false); }, [activeVideo?.id]);

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
              <div><p className="text-xs font-semibold text-white">Final master is ready</p><p className="text-[9px] text-text-dim">Loaded with an instant preview placeholder</p></div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-text-muted"><Clapperboard size={10} className="text-violet" /> AiWebVideo</span>
          </div>
          <div className="relative min-h-56 overflow-hidden bg-black">
            {!videoReady && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(circle_at_45%_35%,rgba(139,92,246,.22),transparent_35%),linear-gradient(145deg,#151022,#08070d)]"><div className="generation-soft-flash absolute inset-0" /><span className="relative rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[10px] text-white/80 backdrop-blur">Preparing video preview…</span></div>}
            <video key={activeVideo.id} src={activeVideo.url} controls playsInline preload="auto" onLoadedData={() => setVideoReady(true)} onCanPlay={() => setVideoReady(true)} className={`max-h-[62vh] min-h-56 w-full bg-black object-contain transition-opacity duration-300 ${videoReady ? "opacity-100" : "opacity-0"}`} />
            <span className="pointer-events-none absolute bottom-14 right-3 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold tracking-wide text-white/90 backdrop-blur">AiWebVideo</span>
            {activeVideo.downloadable && <button type="button" onClick={() => downloadFile(activeVideo)} aria-label="Download video" className="absolute right-2.5 top-2.5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75"><Download size={16} /></button>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            {videos.length > 1 ? <div className="flex gap-1.5">{ASPECT_RATIOS.map((ratio) => videos.some((video) => video.aspectRatio === ratio) ? <button key={ratio} onClick={() => setActiveRatio(ratio)} data-active={activeRatio === ratio} className="min-h-10 rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-white data-[active=true]:border-violet data-[active=true]:text-white">{ratio}</button> : null)}</div> : <span className="text-[9px] uppercase tracking-wider text-text-dim">{activeVideo.aspectRatio || activeRatio} master</span>}
            {activeVideo.downloadable && <Button variant="secondary" size="sm" onClick={() => downloadFile(activeVideo)}><Download size={14} /> Export video</Button>}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="overflow-hidden rounded-[22px] border border-white/[.09] bg-[#0c0917] p-4 shadow-[0_28px_70px_-42px_rgba(139,92,246,.75)] sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-semibold text-white">{photos.length === 4 ? "Your 4 generated photos are ready" : "Your generated photos are ready"}</p><p className="mt-1 text-[10px] text-text-dim">Large previews · open any image full size or download it directly.</p></div>
            <span className="rounded-full border border-mint/15 bg-mint/[.07] px-2.5 py-1 text-[9px] font-semibold text-mint">{photos.length} photos</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photos.slice(0, 8).map((photo, index) => (
              <div key={photo.id} className={`group relative ${photo.aspectRatio === "9:16" ? "aspect-[9/16]" : photo.aspectRatio === "16:9" ? "aspect-video" : "aspect-square"} min-h-64 overflow-hidden rounded-[20px] border border-white/[.1] bg-[linear-gradient(145deg,#171229,#0b0912)]`}>
                <button type="button" onClick={() => photo.downloadable ? setActivePhoto(photo) : onUnlock()} className="absolute inset-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,.22),transparent_36%)]" />
                  <div className="generation-soft-flash pointer-events-none absolute inset-0" />
                  <img src={photo.url} alt={`Generated photo ${index + 1}`} loading="eager" decoding="async" fetchPriority={index < 2 ? "high" : "auto"} style={{ opacity: 0 }} onLoad={(event) => { event.currentTarget.style.opacity = "1"; }} className="relative h-full w-full object-cover transition-opacity duration-500" />
                  <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">Photo {index + 1}</span>
                  <span className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-center text-[10px] font-semibold text-white backdrop-blur transition group-hover:bg-black/70">View full size</span>
                </button>
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
            <div className="flex max-h-[76vh] min-h-52 items-center justify-center bg-black/75 p-3 sm:p-5"><div className="relative max-h-[70vh] overflow-hidden rounded-lg"><img src={activePhoto.url} alt="Image preview" className="max-h-[70vh] max-w-full object-contain" />{activePhoto.downloadable && <button type="button" onClick={() => downloadFile(activePhoto)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur"><Download size={16} /></button>}</div></div>
          </div>
        </div>, document.body)}
    </div>
  );
}
