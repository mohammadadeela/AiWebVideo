import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Clock3, Film, Globe2, Image, LoaderCircle, PackageOpen, ShieldCheck, X } from "lucide-react";
import { fetchJob, request } from "@/lib/api-client";
import { getActiveJobId } from "@/lib/guestSession";
import type { JobAsset, JobStatus } from "./types";
import type { CaptureMediaItem } from "./MediaPlanningPanel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function cancellationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "We couldn't stop this production right now. Please try again.";
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
  const [liveAssets, setLiveAssets] = useState<JobAsset[]>([]);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [stopCreditsAtRisk, setStopCreditsAtRisk] = useState<number | null>(null);
  const [stopPreviewLoading, setStopPreviewLoading] = useState(false);
  const [stopSubmitting, setStopSubmitting] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const lastActivityRef = useRef("");
  const copy = KIND[productionKind];
  const Icon = copy.Icon;
  const settled = ["done", "failed", "cancelled"].includes(status);
  const photoMode = productionKind === "product-photos" || productionKind === "campaign-photos";
  const safeProgress = status === "done" ? 100 : Math.max(2, Math.min(99, Math.round(progress || 2)));
  const eta = formatEta(etaSeconds);
  const visibleReferences = referenceItems.slice(0, 6);
  const effectiveCancelling = Boolean(cancelling || stopSubmitting || stopRequested);
  const generatedPhotos = useMemo(() => liveAssets.filter((asset) => asset.type === "photo").slice(-4), [liveAssets]);
  const generatedVideo = useMemo(() => [...liveAssets].reverse().find((asset) => asset.type === "video") ?? null, [liveAssets]);
  const sourceRecording = useMemo(() => [...liveAssets].reverse().find((asset) => asset.type === "recording") ?? null, [liveAssets]);
  const sourcePreview = visibleReferences[0] ?? null;
  const progressIsEstimated = !settled && status === "rendering" && !generatedVideo;
  const liveStage = useMemo(() => {
    const message = (statusMessage ?? "").toLowerCase();
    if (message.includes("veo is generating") || message.includes("veo is starting")) return "Veo rendering";
    if (message.includes("premium scene") && message.includes("ready")) return "Scene completed";
    if (message.includes("assembling")) return "Assembling";
    if (message.includes("finishing")) return "Finalizing";
    if (message.includes("starting")) return "Starting";
    if (status === "storyboarding") return "Creative planning";
    if (status === "capturing") return "Reading references";
    return phase(status);
  }, [status, statusMessage]);
  const elapsedLabel = useMemo(() => {
    const match = statusMessage?.match(/(\d+)s elapsed/i);
    if (!match) return null;
    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds)) return null;
    if (seconds < 60) return `${seconds}s elapsed`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}m ${String(remainder).padStart(2, "0")}s elapsed`;
  }, [statusMessage]);

  useEffect(() => {
    const id = jobId ?? getActiveJobId();
    if (!id) return;
    let active = true;
    let timer = 0;

    const syncJob = async () => {
      try {
        const job = await fetchJob(id);
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
        setLiveAssets(Array.isArray(job.assets) ? job.assets : []);
        if (!settled && !["done", "failed", "cancelled"].includes(job.status)) {
          timer = window.setTimeout(syncJob, 1600);
        }
      } catch {
        if (active && !settled) timer = window.setTimeout(syncJob, 2400);
      }
    };

    void syncJob();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [jobId, settled]);

  useEffect(() => {
    setStopDialogOpen(false);
    setStopCreditsAtRisk(null);
    setStopPreviewLoading(false);
    setStopSubmitting(false);
    setStopRequested(false);
    setStopError(null);
    setLiveAssets([]);
  }, [jobId]);

  // Keep the live production panel softly in view while new chat updates are
  // inserted above it. This mirrors ChatGPT-style streaming: older updates move
  // upward, while the user remains anchored on the current generation state.
  useEffect(() => {
    if (settled) return;
    const activityKey = `${status}:${statusMessage ?? ""}:${Math.floor(safeProgress / 5)}:${liveAssets.length}`;
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
  }, [liveAssets.length, safeProgress, settled, status, statusMessage]);

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

  async function openStopDialog() {
    if (effectiveCancelling || settled) return;
    const id = jobId ?? getActiveJobId();
    if (!id) return;

    setStopDialogOpen(true);
    setStopPreviewLoading(true);
    setStopCreditsAtRisk(null);
    setStopError(null);
    try {
      const liveJob = await fetchJob(id);
      setStopCreditsAtRisk(Math.max(0, Math.round(liveJob.creditsSpent ?? 0)));
    } catch {
      setStopCreditsAtRisk(null);
    } finally {
      setStopPreviewLoading(false);
    }
  }

  async function confirmStopProduction() {
    const id = jobId ?? getActiveJobId();
    if (!id || stopSubmitting || stopRequested) return;

    setStopSubmitting(true);
    setStopError(null);
    try {
      await request<{ cancelling: boolean; immediate: boolean }>(`/api/jobs/${id}/cancel`, {
        method: "POST",
        body: "{}",
      });
      setStopRequested(true);
      setStopDialogOpen(false);
    } catch (error) {
      setStopError(cancellationErrorMessage(error));
    } finally {
      setStopSubmitting(false);
    }
  }

  const creditsKnown = stopCreditsAtRisk !== null;
  const creditsAtRisk = stopCreditsAtRisk ?? 0;
  const hasReservedCredits = creditsKnown && creditsAtRisk > 0;

  return (
    <>
      <section
        ref={panelRef}
        className="relative w-full overflow-hidden rounded-[20px] border border-white/[.09] bg-[#0d0a18]/95 shadow-[0_22px_64px_-42px_rgba(139,92,246,.82)]"
        aria-label={`${copy.label} generation progress`}
        aria-live="polite"
        aria-atomic="false"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_-10%,rgba(139,92,246,.16),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(52,217,196,.065),transparent_28%)]" />
        <div className="relative p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`flex h-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[.09] bg-white/[.045] text-mint ${brandMarkUrl && productionKind === "website-video" ? "min-w-9 max-w-[112px] px-1.5" : "w-9"}`}
              >
                {brandMarkUrl && productionKind === "website-video" ? (
                  <img
                    src={brandMarkUrl}
                    alt={brandName ? `${brandName} logo` : "Website logo"}
                    className="max-h-5 max-w-[88px] object-contain"
                  />
                ) : (
                  <Icon size={15} />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[12px] font-semibold text-white">
                    {settled ? phase(status) : "Generating your result"}
                  </p>
                  {!settled && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-mint/15 bg-mint/[.07] px-1.5 py-0.5 font-utility text-[7px] uppercase tracking-[.12em] text-mint">
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
              <span className="rounded-full border border-white/[.08] bg-black/20 px-2 py-1 font-utility text-[9px] font-semibold text-white">{safeProgress}%{progressIsEstimated ? " est." : ""}</span>
            </div>
          </div>

          {photoMode ? (
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold text-white">Live image generation</p>
                  <p className="mt-0.5 text-[8px] text-text-dim">Each slot fills immediately when its real generated image becomes available.</p>
                </div>
                <span className="rounded-full border border-white/[.07] bg-white/[.025] px-2 py-1 text-[8px] text-white/60">{generatedPhotos.length}/4 ready</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => {
                  const asset = generatedPhotos[index];
                  return (
                    <div
                      key={asset?.id ?? index}
                      className="relative aspect-[4/5] overflow-hidden rounded-xl border border-white/[.08] bg-[linear-gradient(145deg,#171229,#0a0813)]"
                    >
                      {asset ? (
                        <img src={asset.url} alt={`Generated photo ${index + 1}`} className="h-full w-full object-cover" loading="eager" decoding="async" />
                      ) : (
                        <>
                          {sourcePreview && <img src={sourcePreview.url} alt="" className="absolute inset-0 h-full w-full scale-105 object-cover opacity-[.12] blur-[2px]" />}
                          <div className="generation-soft-flash pointer-events-none absolute inset-0" />
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_28%,rgba(139,92,246,.18),transparent_36%)]" />
                          <div className="relative flex h-full flex-col items-center justify-center gap-1.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet/20 bg-violet/[.09] text-violet">
                              <LoaderCircle size={13} className={!settled ? "animate-spin" : ""} />
                            </span>
                            <span className="text-[8px] font-semibold text-white/75">Creating photo {index + 1}</span>
                          </div>
                        </>
                      )}
                      {asset && <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-mint/20 bg-black/55 px-1.5 py-0.5 text-[7px] font-semibold text-mint backdrop-blur"><Check size={8} />Ready</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_150px]">
              <div className="relative h-40 overflow-hidden rounded-2xl border border-white/[.08] bg-[#080611] sm:h-44">
                {generatedVideo ? (
                  <video src={generatedVideo.url} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-contain" />
                ) : sourceRecording ? (
                  <video src={sourceRecording.url} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover opacity-55" />
                ) : sourcePreview ? (
                  <img src={sourcePreview.url} alt={sourcePreview.title} className="h-full w-full object-cover object-top opacity-55" loading="eager" decoding="async" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_36%,rgba(139,92,246,.2),transparent_32%),linear-gradient(145deg,#171229,#080611)]" />
                )}
                {!generatedVideo && <div className="generation-soft-flash pointer-events-none absolute inset-0" />}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/15" />
                <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-mint/20 bg-black/55 px-2 py-1 text-[7px] font-semibold uppercase tracking-[.1em] text-mint backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
                  {generatedVideo ? "Live output" : "Live canvas"}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[10px] font-semibold text-white">{generatedVideo ? "Generated video is arriving" : phase(status)}</p>
                  <p className="mt-0.5 max-w-[520px] text-[8px] leading-4 text-white/55">{generatedVideo ? "Showing the real generated media as soon as the backend exposes it." : statusMessage || (sourcePreview || sourceRecording ? "Veo is generating the next premium shot from your selected references and creative direction." : "Preparing your production.")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-2.5">
                  <p className="font-utility text-[7px] uppercase tracking-[.13em] text-text-dim">Current stage</p>
                  <p className="mt-1 text-[10px] font-semibold text-white">{liveStage}</p>
                  <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-white/45">{statusMessage || "Production is progressing."}</p>
                  {elapsedLabel && <p className="mt-1 text-[7px] font-medium text-mint/75">{elapsedLabel}</p>}
                </div>
                <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-2.5">
                  <p className="font-utility text-[7px] uppercase tracking-[.13em] text-text-dim">Output</p>
                  <p className="mt-1 text-[10px] font-semibold text-white">{aspectRatio}{settings.quality ? ` · ${settings.quality === "4k" ? "4K" : settings.quality}` : ""}</p>
                  <p className="mt-1 text-[8px] leading-4 text-white/45">{settings.duration ? `${settings.duration}s` : "Selected duration"}{settings.audio ? ` · ${cleanAudio(settings.audio)}` : ""}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[.06]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={safeProgress}
            >
              <div className="h-full rounded-full bg-signature shadow-[0_0_14px_rgba(236,72,153,.28)] transition-[width] duration-700" style={{ width: `${safeProgress}%` }} />
            </div>
            {eta && !settled && <span className="shrink-0 text-[8px] text-text-dim sm:hidden">{eta}</span>}
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

          {visibleReferences.length > 0 && (
            <div className="mt-3 border-t border-white/[.055] pt-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-[8px] font-semibold text-white/65">Live inputs</p>
                <p className="text-[7px] text-text-dim">Using your real references</p>
              </div>
              <div className="chat-scroll flex gap-1.5 overflow-x-auto pb-0.5">
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
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2.5 border-t border-white/[.06] pt-2.5">
            <p className="min-w-0 flex-1 truncate text-[8px] text-text-dim">
              {progressIsEstimated ? "Estimated progress · provider generation time varies. Live stage and elapsed time are real." : "Live progress is saved. You can leave this chat and return without stopping generation."}
            </p>
            {onCancel && !settled && (
              <button
                type="button"
                onClick={() => void openStopDialog()}
                disabled={effectiveCancelling}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/[.08] bg-white/[.02] px-2.5 text-[8px] font-semibold text-text-muted transition hover:border-pink/30 hover:bg-pink/[.04] hover:text-pink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {effectiveCancelling ? <LoaderCircle size={10} className="animate-spin" /> : <X size={10} />}
                {effectiveCancelling ? "Stopping…" : "Stop"}
              </button>
            )}
          </div>
        </div>
      </section>

      <AlertDialog
        open={stopDialogOpen}
        onOpenChange={(open) => {
          if (!stopSubmitting) setStopDialogOpen(open);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-[440px] overflow-hidden rounded-[24px] border border-white/[.1] bg-[#100c1d] p-0 text-white shadow-[0_28px_90px_-28px_rgba(0,0,0,.92),0_0_70px_-36px_rgba(244,63,94,.45)] sm:rounded-[24px]">
          <div className="relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(244,63,94,.13),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(139,92,246,.12),transparent_32%)]" />
            <div className="relative">
              <AlertDialogHeader className="space-y-0 text-left">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-pink/20 bg-pink/[.09] text-pink shadow-[0_12px_32px_-18px_rgba(244,63,94,.8)]">
                    <AlertTriangle size={20} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <AlertDialogTitle className="text-[18px] font-semibold tracking-[-.02em] text-white">
                      Stop production?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="mt-1.5 text-[12px] leading-5 text-white/55">
                      Your generation is already in progress. Stopping it cannot be undone.
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>

              <div className="mt-5 rounded-2xl border border-white/[.08] bg-white/[.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-white/58">
                    <ShieldCheck size={14} className="text-mint" />
                    Credits at risk
                  </div>
                  <div className="min-w-[92px] text-right">
                    {stopPreviewLoading ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-white/42">
                        <LoaderCircle size={11} className="animate-spin" /> Checking…
                      </span>
                    ) : hasReservedCredits ? (
                      <span className="inline-flex rounded-full border border-pink/20 bg-pink/[.09] px-2.5 py-1 text-[11px] font-semibold text-pink">
                        {creditsAtRisk} credits
                      </span>
                    ) : creditsKnown ? (
                      <span className="text-[11px] font-semibold text-white/75">0 credits</span>
                    ) : (
                      <span className="text-[10px] font-medium text-amber-300">Live amount unavailable</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 border-t border-white/[.06] pt-3">
                  {stopPreviewLoading ? (
                    <p className="text-[11px] leading-5 text-white/45">Checking the live reservation before you decide.</p>
                  ) : hasReservedCredits ? (
                    <p className="text-[11px] leading-5 text-white/65">
                      If you stop now, all <span className="font-semibold text-white">{creditsAtRisk} reserved credits</span> will be lost and will <span className="font-semibold text-pink">not be refunded</span>.
                    </p>
                  ) : creditsKnown ? (
                    <p className="text-[11px] leading-5 text-white/58">
                      No paid credits are reserved right now. If paid AI starts before the stop is processed, any new reservation is not refundable.
                    </p>
                  ) : (
                    <p className="text-[11px] leading-5 text-amber-200/75">
                      We could not verify the live reserved amount. If paid AI has already started, reserved credits are not refundable after Stop.
                    </p>
                  )}
                </div>
              </div>

              {stopError && (
                <div className="mt-3 rounded-xl border border-pink/20 bg-pink/[.07] px-3 py-2.5 text-[10px] leading-4 text-pink">
                  {stopError}
                </div>
              )}

              <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <AlertDialogCancel
                  disabled={stopSubmitting}
                  className="m-0 min-h-10 rounded-xl border border-white/[.1] bg-white/[.035] px-4 text-[11px] font-semibold text-white/80 hover:bg-white/[.07] hover:text-white disabled:opacity-50"
                >
                  Keep generating
                </AlertDialogCancel>
                <button
                  type="button"
                  onClick={() => void confirmStopProduction()}
                  disabled={stopPreviewLoading || stopSubmitting || stopRequested}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-pink/30 bg-pink px-4 text-[11px] font-semibold text-white shadow-[0_12px_30px_-18px_rgba(244,63,94,.9)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {stopSubmitting ? <LoaderCircle size={13} className="animate-spin" /> : <X size={13} />}
                  {stopSubmitting
                    ? "Stopping…"
                    : hasReservedCredits
                      ? `Stop and lose ${creditsAtRisk} credits`
                      : "Stop production"}
                </button>
              </div>

              <p className="mt-3 text-center text-[9px] leading-4 text-white/28">
                Closing this dialog keeps your production running normally.
              </p>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}