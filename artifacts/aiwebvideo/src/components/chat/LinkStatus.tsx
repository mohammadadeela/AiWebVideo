import { useEffect, useState } from "react";
import { linkStatusMessage, type LinkMessages } from "@/lib/linkStatus";

/**
 * Shown while a pasted link is being read. It moves, it says what is happening, and it reassures when a page is slow,
 * so nobody has to wonder whether the app has frozen. With `skeleton`, grey photo slots shimmer where the photos
 * will appear.
 */
export function LinkStatus({ active, messages, skeleton = false }: { active: boolean; messages: LinkMessages; skeleton?: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - start) / 1000), 400);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div role="status" aria-live="polite" className="link-status mt-2.5 overflow-hidden rounded-xl border border-violet/30 bg-violet/[.08] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet border-t-transparent" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[12px] font-semibold leading-4 text-white">{linkStatusMessage(elapsed, messages)}</p>
        {elapsed >= 3 && <span className="shrink-0 text-[10px] tabular-nums text-white/45">{Math.floor(elapsed)}s</span>}
      </div>
      <div className="link-status-bar mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true" />
      {skeleton && (
        <div className="mt-2.5 flex gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((slot) => <span key={slot} className="link-status-shimmer h-16 w-16 shrink-0 rounded-xl bg-white/[.07]" style={{ animationDelay: `${slot * 120}ms` }} />)}
        </div>
      )}
    </div>
  );
}
