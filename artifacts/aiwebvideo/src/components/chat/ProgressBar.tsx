import { useEffect, useRef, useState } from 'react';
import type { JobStatus } from './types';

const FALLBACK_LABEL: Record<JobStatus, string> = {
  queued: 'Preparing your project',
  capturing: 'Reading your website',
  storyboarding: 'Designing your production',
  rendering: 'Creating your content',
  done: 'Ready',
  failed: 'Paused',
};

function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) {
    const rounded = Math.max(5, Math.ceil(seconds / 5) * 5);
    return `about ${rounded} sec left`;
  }
  const low = Math.max(1, Math.floor(seconds * 0.85 / 60));
  const high = Math.max(low + 1, Math.ceil(seconds * 1.15 / 60));
  return `${low}–${high} min left`;
}

export function ProgressBar({
  status,
  progress,
  statusMessage,
  etaSeconds,
}: {
  status: JobStatus;
  progress: number;
  statusMessage?: string | null;
  etaSeconds?: number | null;
}) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const [liveEtaSeconds, setLiveEtaSeconds] = useState(etaSeconds ?? 0);
  const lastServerEta = useRef(etaSeconds ?? 0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const next = etaSeconds ?? 0;
    // Accept meaningful server corrections immediately. Ignore tiny upward
    // polling jitter so the countdown does not look stuck or fake.
    if (next === 0 || Math.abs(next - lastServerEta.current) >= 3) {
      lastServerEta.current = next;
      setLiveEtaSeconds(next);
    }
  }, [etaSeconds]);

  useEffect(() => {
    if (status === 'done' || status === 'failed') return;
    const timer = window.setInterval(() => {
      setLiveEtaSeconds((value) => Math.max(0, value - 1));
      setElapsedSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const eta = formatEta(liveEtaSeconds);
  const label = statusMessage || FALLBACK_LABEL[status];

  return (
    <div className="w-full min-w-56 max-w-sm rounded-xl border border-white/5 bg-black/10 p-3">
      <div className="mb-2 flex items-start justify-between gap-3 text-xs">
        <div>
          <p className="font-medium text-text-primary">{label}</p>
          {eta && <p className="mt-0.5 text-[11px] text-text-dim">Live estimate · {eta}</p>}
        </div>
        <span className="font-utility rounded-md bg-black/20 px-2 py-1 text-mint">{safeProgress}%</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-bg/70 shadow-inner"
        role="progressbar"
        aria-valuenow={safeProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-signature shadow-[0_0_14px_rgba(236,72,153,.35)] transition-[width] duration-700 ease-out"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-text-dim">
        Measured from completed work{elapsedSeconds >= 10 ? ` · active for ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}` : ''}.
      </p>
    </div>
  );
}
