import { useEffect, useMemo, useState } from "react";
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
  const copy = KIND[productionKind];
  const Icon = copy.Icon;
  const settled = ["done", "failed", "cancelled"].includes(status);
  const photoMode = productionKind === "product-photos" || productionKind === "campaign-photos";
  const safeProgress = status === "done" ? 100 : Math.max(2, Math.min(99, Math.round(progress || 2)));
  const eta = formatEta(etaSeconds);
  const visibleReferences = referenceItems.slice(0, 8);

  useEffect(() => {
    const id = getActiveJobId();
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
    return () => { active = false; };
  }, []);

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
    <section className="relative w-full overflow-hidden rounded-[24px] border border-white/[.09] bg-[#0d0a18] shadow-[0_28px_80px_-48px_rgba(139,92,246,.85)]" aria-label={`${copy.label} generation progress`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(139,92,246,.18),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(52,217,196,.07),transparent_30%)]" />
      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex h-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[.05] text-mint ${brandMarkUrl && productionKind === "website-video" ? "min-w-10 max-w-[120px] px-2" : "w-10"}`}>
              {brandMarkUrl && productionKind === "website-video" ? (
                <img src={brandMarkUrl} alt={brandName ? `${brandName} logo` : "Website logo"} className="max-h-6 max-w-[96px] object-contain" />
              ) : <Icon size={17} />}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{settled ? phase(status) : "Generating your result"}</p>
                {!settled && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint shadow-[0_0_12px_rgba(52,217,196,.8)]" />}
              </div>
              <p className="mt-0.5 truncate text-[10px] text-text-dim">{statusMessage || phase(status)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {eta && !settled && <span className="hidden items-center gap-1.5 text-[9px] text-text-dim sm:flex"><Clock3 size={11} /> {eta}</span>}
            <span className="font-utility text-[10px] font-semibold text-white">{safeProgress}%</span>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.07]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
          <div className="h-full rounded-full bg-signature transition-[width] duration-700" style={{ width: `${safeProgress}%` }} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full border border-white/[.08] bg-white/[.035] px-2.5 py-1.5 text-[9px] capitalize text-white/80">{chip}</span>
          ))}
        </div>

        {photoMode && (
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-white">You will receive 4 generated photos</p>
              <p className="text-[9px] text-text-dim">Four distinct creative directions</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/[.08] bg-[linear-gradient(145deg,#171229,#0a0813)]">
                  <div className="generation-soft-flash pointer-events-none absolute inset-0" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(139,92,246,.20),transparent_36%)]" />
                  <div className="relative flex h-full flex-col items-center justify-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet/20 bg-violet/[.1] text-violet"><LoaderCircle size={14} className={!settled ? "animate-spin" : ""} /></span>
                    <span className="text-[9px] font-semibold text-white/80">Photo {index + 1}</span>
                    <span className="text-[8px] text-text-dim">{status === "done" ? "Ready" : "Preparing"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!photoMode && visibleReferences.length > 0 && (
          <div className="chat-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
            {visibleReferences.map((item) => (
              <div key={item.id} className="relative w-24 shrink-0 overflow-hidden rounded-xl border border-white/[.08] bg-black/20">
                <div className="aspect-video overflow-hidden">
                  <img src={item.url} alt={item.title} loading="eager" decoding="async" className="h-full w-full object-cover object-top" />
                </div>
                {sceneAssignments[item.id] ? <span className="absolute right-1 top-1 rounded-full bg-violet px-1.5 py-0.5 text-[7px] font-bold text-white">R{sceneAssignments[item.id]}</span> : null}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[.07] pt-3">
          <p className="min-w-0 flex-1 truncate text-[9px] text-text-dim">You can leave this chat and return without stopping generation.</p>
          {onCancel && !settled && (
            <button type="button" onClick={onCancel} disabled={cancelling} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-white/[.09] bg-white/[.025] px-3 text-[9px] font-semibold text-text-muted transition hover:border-pink/30 hover:text-pink disabled:opacity-50">
              <X size={11} /> {cancelling ? "Stopping…" : "Stop"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
