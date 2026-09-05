import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/app-button";
import type { JobAsset } from "./types";
import { CheckCircle2, Clapperboard, Download, Images, X } from "lucide-react";

const ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

export function ResultGrid({
  assets,
  onUnlock,
  sourceKind = "website",
}: {
  assets: JobAsset[];
  onUnlock: () => void;
  sourceKind?: "website" | "studio" | "upload";
}) {
  const videos = assets.filter((a) => a.type === "video");
  const photos = assets.filter((a) => a.type === "photo");
  const screenshots = assets.filter((a) => a.type === "screenshot");
  const recordings = assets.filter((a) => a.type === "recording");
  const anyLocked = assets.some((a) => !a.downloadable);
  const [activeRatio, setActiveRatio] =
    useState<(typeof ASPECT_RATIOS)[number]>("16:9");
  const [activePhoto, setActivePhoto] = useState<JobAsset | null>(null);

  // `assets` is returned oldest-first. If more than one video somehow exists
  // for this job, always prefer the most recently created one so a retry can
  // never appear to fall back to an older result.
  const activeVideo =
    videos.find((v) => v.aspectRatio === activeRatio) ??
    videos[videos.length - 1];
  const displayPhotos = photos;
  const photoAspectClass = (ratio: string | null) =>
    ratio === "9:16" ? "aspect-[9/16]" : ratio === "16:9" ? "aspect-video" : "aspect-square";

  useEffect(() => {
    if (!activePhoto) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
    };
    document.addEventListener("keydown", close);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previous;
    };
  }, [activePhoto]);

  function downloadFile(asset: JobAsset, index = 0) {
    // Do not fetch the entire video into a browser Blob before starting the
    // download. Large generated films made the button look broken while the
    // browser silently buffered tens/hundreds of MB. The signed asset URL is
    // already same-origin; append download=1 and let the browser/server stream
    // it immediately with Content-Disposition: attachment.
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
      // A little spacing prevents browsers from treating a legitimate batch
      // export as a burst of accidental clicks.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }

  if (assets.length === 0) {
    return (
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-panel-alt p-5 text-center animate-fade-in-up">
        <p className="text-sm text-text-muted">
          Generation finished, but no assets were returned.
        </p>
        <p className="mt-1 text-xs text-text-dim">
          Try again — this can happen when the AI service is busy.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl space-y-4 animate-fade-in-up">
      {activeVideo && (
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0917] shadow-[0_28px_70px_-38px_rgba(139,92,246,.7)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[.07] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint/10 text-mint">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <p className="text-xs font-semibold text-white">
                  Final master is ready
                </p>
                <p className="text-[9px] text-text-dim">
                  Fully AI-generated production
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[.07] bg-white/[.035] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-wider text-text-muted">
              <Clapperboard size={10} className="text-violet" />
              AiWebVideo
            </span>
          </div>
          <div className="relative overflow-hidden bg-black">
            <video
              key={activeVideo.id}
              src={activeVideo.url}
              controls
              playsInline
              className="max-h-[62vh] min-h-56 w-full bg-black object-contain"
            />
            <span className="pointer-events-none absolute bottom-14 right-3 rounded-md bg-black/55 px-2 py-1 text-[9px] font-bold tracking-wide text-white/90 backdrop-blur">
              AiWebVideo
            </span>
            {activeVideo.downloadable && (
              <button
                type="button"
                onClick={() => downloadFile(activeVideo)}
                aria-label="Download video"
                title="Download video"
                className="absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
              >
                <Download size={16} />
              </button>
            )}
            {!activeVideo.downloadable && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg/70 backdrop-blur-sm">
                <p className="text-xs text-text-muted">Watermarked preview</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            {videos.length > 1 ? (
              <div className="flex gap-1.5">
                {ASPECT_RATIOS.map((ratio) => {
                  const has = videos.some((v) => v.aspectRatio === ratio);
                  if (!has) return null;
                  return (
                    <button
                      key={ratio}
                      onClick={() => setActiveRatio(ratio)}
                      className="font-utility min-h-10 rounded-lg border border-border px-3 py-2 text-xs text-text-muted
                               hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet
                               data-[active=true]:border-violet data-[active=true]:text-text-primary"
                      data-active={activeRatio === ratio}
                    >
                      {ratio}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="font-utility text-[9px] uppercase tracking-wider text-text-dim">
                {activeVideo.aspectRatio || activeRatio} master
              </span>
            )}
            {activeVideo.downloadable && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadFile(activeVideo)}
              >
                <Download size={14} /> Export video
              </Button>
            )}
          </div>
        </div>
      )}

      {displayPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {displayPhotos.slice(0, 8).map((photo, index) => (
            <div
              key={photo.id}
              className={`group relative ${photoAspectClass(photo.aspectRatio)} overflow-hidden rounded-2xl border border-border bg-panel-alt`}
            >
              <button
                type="button"
                onClick={() =>
                  photo.downloadable ? setActivePhoto(photo) : onUnlock()
                }
                className="absolute inset-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
              >
                <img
                  src={photo.url}
                  alt={`Generated marketing photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[7px] font-bold tracking-wide text-white/90">
                  AiWebVideo
                </span>
                {!photo.downloadable && (
                  <div className="absolute inset-0 bg-bg/40 backdrop-blur-[2px]" />
                )}
                <span className="absolute inset-x-2 bottom-2 translate-y-8 rounded-lg bg-black/65 px-2 py-1 text-center text-[10px] text-white backdrop-blur transition-transform group-hover:translate-y-0">
                  View full size
                </span>
              </button>
              {photo.downloadable && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadFile(photo);
                  }}
                  aria-label="Download photo"
                  title="Download photo"
                  className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
                >
                  <Download size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {screenshots.length > 0 && (
        <details className="rounded-xl border border-border bg-panel-alt p-3">
          <summary className="cursor-pointer text-xs font-semibold text-text-primary">
            {sourceKind === "website" ? "Saved website references" : "Project references"} ({screenshots.length})
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {screenshots.slice(0, 6).map((shot) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setActivePhoto(shot)}
                className="overflow-hidden rounded-lg border border-border bg-black/30"
              >
                <img
                  src={shot.url}
                  alt={sourceKind === "website" ? "Saved website reference" : "Project reference"}
                  className="aspect-video w-full object-cover object-top"
                />
              </button>
            ))}
          </div>
        </details>
      )}

      {recordings.map((recording) => (
        <details
          key={recording.id}
          className="rounded-xl border border-border bg-panel-alt p-3"
        >
          <summary className="cursor-pointer text-xs font-semibold text-text-primary">
            {sourceKind === "website" ? "Original website capture" : "Original source preview"}
          </summary>
          <p className="mt-1 text-[10px] text-text-dim">
            Kept as a separate source file. It is not inserted into the
            generated marketing video.
          </p>
          <div className="relative mt-2 overflow-hidden rounded-lg">
            <video
              src={recording.url}
              controls
              muted
              playsInline
              className="w-full"
            />
            <span className="pointer-events-none absolute bottom-10 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white/90">
              AiWebVideo
            </span>
          </div>
        </details>
      ))}

      {anyLocked ? (
        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={onUnlock}
        >
          Sign in to unlock full quality
        </Button>
      ) : (
        assets.filter((asset) => asset.downloadable).length > 1 && (
          <Button
            variant="secondary"
            size="md"
            className="w-full"
            onClick={downloadAll}
          >
            <Images size={15} /> Download all files
          </Button>
        )
      )}

      {/* Portal to document.body — see the comment in AuthModal.tsx; this
          preview opens from inside animated chat cards, whose transform
          would otherwise break a plain `position: fixed` child. */}
      {activePhoto &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Photo preview"
            onClick={() => setActivePhoto(null)}
            className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl cursor-default overflow-hidden rounded-2xl border border-white/15 bg-panel shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Photo preview
                  </p>
                  <p className="text-[11px] text-text-dim">
                    Click outside or press Esc to close
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  aria-label="Close preview"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel-alt text-text-muted transition hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex max-h-[58vh] min-h-52 items-center justify-center bg-black/70 p-3 sm:p-5">
                <div className="relative max-h-[52vh] overflow-hidden rounded-lg">
                  <img
                    src={activePhoto.url}
                    alt="Image preview"
                    className="max-h-[52vh] max-w-full object-contain"
                  />
                  <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/55 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/90 backdrop-blur">
                    AiWebVideo
                  </span>
                  {activePhoto.downloadable && (
                    <button
                      type="button"
                      onClick={() => downloadFile(activePhoto)}
                      aria-label="Download photo"
                      title="Download photo"
                      className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
                    >
                      <Download size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
