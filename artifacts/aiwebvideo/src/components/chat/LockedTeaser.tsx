interface LockedTeaserProps {
  siteUrl: string;
  screenshotUrl: string | null;
  sceneCount: number;
  durationSeconds: number;
  onUnlock: () => void;
}

/**
 * Honest free preview: real capture and storyboard are ready, while paid
 * Paid production has not started yet.
 */
export function LockedTeaser({ siteUrl, screenshotUrl, sceneCount, durationSeconds, onUnlock }: LockedTeaserProps) {
  let hostname = siteUrl;
  try { hostname = new URL(siteUrl).hostname; } catch { /* keep raw */ }

  return (
    <div className="w-full max-w-sm animate-fade-in-up">
      <div className="relative overflow-hidden rounded-xl border border-violet/40 bg-panel-alt">
        <div className="relative aspect-video overflow-hidden">
          {screenshotUrl ? (
            <img
              src={screenshotUrl}
              alt=""
              className="h-full w-full object-cover object-top brightness-[0.72]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet/30 to-pink/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

          {/* Play button + lock */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1 font-utility text-[10px] uppercase tracking-widest text-white">Production preview</span>
            <p className="px-6 text-center text-sm font-semibold text-white drop-shadow">
              Your {durationSeconds}s production plan for {hostname} is ready
            </p>
          </div>

          {/* Bottom info strip */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 text-[11px] text-white/90">
            <span className="font-utility rounded bg-black/60 px-2 py-0.5">{sceneCount} scenes planned ✓</span>
            <span className="font-utility rounded bg-black/60 px-2 py-0.5">Real site captured ✓</span>
          </div>
        </div>
      </div>
      <button
        onClick={onUnlock}
        className="mt-2 w-full rounded-lg bg-signature py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Choose a plan &amp; begin production
      </button>
      <p className="mt-1.5 text-center text-[11px] text-text-dim">
        Video generation starts after purchase. Failed generations are refunded automatically.
      </p>
    </div>
  );
}
