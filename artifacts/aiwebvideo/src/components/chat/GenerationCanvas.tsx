import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Film, Globe2, Image, LoaderCircle, PackageOpen, X } from "lucide-react";
import { fetchJob } from "@/lib/api-client";
import { getActiveJobId } from "@/lib/guestSession";
import type { JobStatus } from "./types";
import type { CaptureMediaItem } from "./MediaPlanningPanel";

export type ProductionKind =
  | "website-video"
  | "ai-video"
  | "product-photos"
  | "campaign-photos"
  | "product-video"
  | "talking-scene";

type Settings = {
  quality: string | null;
  duration: number | null;
  audio: string | null;
  frameRate: number | null;
};

const KIND: Record<ProductionKind, { label: string; Icon: typeof Film }> = {
  "website-video": { label: "Website campaign", Icon: Globe2 },
  "ai-video": { label: "AI video", Icon: Film },
  "product-photos": { label: "Product photos", Icon: PackageOpen },
  "campaign-photos": { label: "Campaign photos", Icon: Image },
  "product-video": { label: "Product video", Icon: PackageOpen },
  "talking-scene": { label: "Talking scene", Icon: Film },
};

function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.max(5, Math.ceil(seconds / 5) * 5)} sec`;
  return `~${Math.max(1, Math.ceil(seconds / 60))} min`;
}

function phase(status: JobStatus) {
  if (status === "queued") return "Preparing";
  if (status === "capturing") return "Reading references";
  if (status === "captured" || status === "storyboarding") return "Directing";
  if (status === "rendering") return "Generating";
  if (status === "done") return "Complete";
  if (status === "cancelled") return "Stopped";
  return "Needs attention";
}

function cleanAudio(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function GenerationCanvas({
  jobId = null,
  status,
  progress,
  statusMessage,
  etaSeconds,
  onCancel,
  cancelling,
  aspectRatio = "9:16",
  productionKind = "website-video",
  referenceItems = [],
  sceneAssignments = {},
  brandMarkUrl = null,
  brandName = null,
}: {
  jobId?: string | null;
  status: JobStatus;
  progress: number;
  statusMessage?: string | null;
  etaSeconds?: number | null;
  onCancel?: () => void;
  cancelling?: boolean;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  productionKind?: ProductionKind;
  referenceItems?: CaptureMediaItem[];
  sceneAssignments?: Record<string, number>;
  brandMarkUrl?: string | null;
  brandName?: string | null;
}) {
  const [settings, setSettings] = useState<Settings>({ quality: null, duration: null, audio: null, frameRate: null });
  const panelRef = useRef<HTMLElement>(null);
  const lastActivityRef = useRef("");
  const copy = KIND[productionKind];
  const Icon = copy.Icon;
  const settled = ["done", "failed", "cancelled"].includes(status);
  const photoMode = productionKind === "product-photos" || productionKind === "campaign-photos";
  const safeProgress = status === "done" ? 100 : Math.max(2, Math.min(99, Math.round(progress || 2)));
  const eta = formatEta(etaSeconds);
  const visibleReferences = referenceItems.slice(0, 6);

  useEffect(() => {
    const id = jobId ?? getActiveJobId();
    if (!id) return;
    let active = true;
    void fetchJob(id)
      .then((job) => {
        if (!active) return;
        const workflow = job.workflowState as Record<string, unknown> | null;
        const requested = workflow?.requestedDurationSeconds;
        setSettings({
          quality: String(workflow?.outputQuality ?? job.storyboard?.outputQuality ?? "") || null,
          duration:
            typeof requested === "number"
              ? requested
              : typeof job.storyboard?.targetDurationSeconds === "number"
                ? job.storyboard.targetDurationSeconds
                : null,
          audio: typeof workflow?.audioMode === "string" ? workflow.audioMode : null,
          frameRate:
            typeof workflow?.frameRate === "number"
              ? workflow.frameRate
              : typeof job.storyboard?.frameRate === "number"
                ? job.storyboard.frameRate
                : null,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [jobId]);

  // Keep the live production panel softly in view while new chat updates are
  // inserted above it. This mirrors ChatGPT-style streaming: older updates move
  // upward, while the user remains anchored on the current generation state.
  useEffect(() => {
    if (settled) return;
    const activityKey = `${status}:${statusMessage ?? ""}:${Math.floor(safeProgress / 5)}`;
    if (lastActivityRef.current === activityKey) return;
    lastActivityRef.current = activityKey;

    const timer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const scroller = panel.closest(".chat-scroll") as HTMLElement | null;
      if (!scroller) return;

      const panelRect = panel.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const outsideComfortZone = panelRect.top < scrollerRect.top + 8 || panelRect.bottom > scrollerRect.bottom - 12;
      if (!outsideComfortZone) return;

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const targetTop = Math.max(0, scroller.scrollTop + panelRect.top - scrollerRect.top - 8);
      scroller.scrollTo({
        top: targetTop,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }, 70);

    return () => window.clearTimeout(timer);
  }, [safeProgress, settled, status, statusMessage]);

  const chips = useMemo(() => {
    const values: string[] = [copy.label, aspectRatio];
    if (photoMode) values.push("4 photos");
    if (settings.quality) values.push(settings.quality === "4k" ? "4K" : settings.quality);
    if (!photoMode && settings.duration) values.push(`${settings.duration}s`);
    if (!photoMode && settings.frameRate) values.push(`${settings.frameRate} fps`);
    if (!photoMode && settings.audio) values.push(cleanAudio(settings.audio));
    if (referenceItems.length) values.push(`${referenceItems.length} reference${referenceItems.length === 1 ? "" : "s"}`);
    return values;
  }, [aspectRatio, copy.label, photoMode, referenceItems.length, settings]);

  return (
    <section
      ref={panelRef}
      className="relative w-full overflow-hidden rounded-[18px] border border-white/[.08] bg-[#0d0a18]/95 shadow-[0_20px_56px_-42px_rgba(139,92,246,.72)]"
      aria-label={`${copy.label} generation progress`}
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(139,92,246,.14),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(52,217,196,.055),transparent_28%)]" />
      <div className="relative p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex h-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[.08] bg-white/[.04] text-mint ${brandMarkUrl && productionKind === "website-video" ? "min-w-8 max-w-[104px] px-1.5" : "w-8"}`}
            >
              {brandMarkUrl && productionKind === "website-video" ? (
                <img
                  src={brandMarkUrl}
                  alt={brandName ? `${brandName} logo` : "Website logo"}
                  className="max-h-5 max-w-[84px] object-contain"
                />
              ) : (
                <Icon size={14} />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[12px] font-semibold text-white">
                  {settled ? phase(status) : "Generating your result"}
                </p>
                {!settled && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-mint/15 bg-mint/[.06] px-1.5 py-0.5 font-utility text-[7px] uppercase tracking-[.12em] text-mint">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint shadow-[0_0_10px_rgba(52,217,196,.65)]" aria-hidden="true" />
                    Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[9px] text-text-dim">{statusMessage || phase(status)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {eta && !settled && (
              <span className="hidden items-center gap-1 text-[8px] text-text-dim sm:flex">
                <Clock3 size={10} /> {eta}
              </span>
            )}
            <span className="font-utility text-[9px] font-semibold text-white">{safeProgress}%</span>
          </div>
        </div>

        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.06]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={safeProgress}
        >
          <div className="h-full rounded-full bg-signature transition-[width] duration-700" style={{ width: `${safeProgress}%` }} />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/[.07] bg-white/[.025] px-2 py-1 text-[8px] capitalize text-white/75"
            >
              {chip}
            </span>
          ))}
        </div>

        {photoMode && (
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold text-white">You will receive 4 generated photos</p>
              <p className="text-[8px] text-text-dim">Four distinct creative directions</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/[.07] bg-[linear-gradient(145deg,#171229,#0a0813)]"
                >
                  <div className="generation-soft-flash pointer-events-none absolute inset-0" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(139,92,246,.16),transparent_36%)]" />
                  <div className="relative flex h-full flex-col items-center justify-center gap-1.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet/20 bg-violet/[.08] text-violet">
                      <LoaderCircle size={12} className={!settled ? "animate-spin" : ""} />
                    </span>
                    <span className="text-[8px] font-semibold text-white/75">Photo {index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!photoMode && visibleReferences.length > 0 && (
          <div className="chat-scroll mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {visibleReferences.map((item) => (
              <div
                key={item.id}
                className="relative w-20 shrink-0 overflow-hidden rounded-lg border border-white/[.07] bg-black/20"
              >
                <div className="aspect-video overflow-hidden">
                  <img
                    src={item.url}
                    alt={item.title}
                    loading="eager"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                {sceneAssignments[item.id] ? (
                  <span className="absolute right-1 top-1 rounded-full bg-violet px-1 py-0.5 text-[6px] font-bold text-white">
                    R{sceneAssignments[item.id]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2.5 border-t border-white/[.06] pt-2.5">
          <p className="min-w-0 flex-1 truncate text-[8px] text-text-dim">
            You can leave this chat and return without stopping generation.
          </p>
          {onCancel && !settled && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancelling}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/[.08] bg-white/[.02] px-2.5 text-[8px] font-semibold text-text-muted transition hover:border-pink/30 hover:text-pink disabled:opacity-50"
            >
              <X size={10} /> {cancelling ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
