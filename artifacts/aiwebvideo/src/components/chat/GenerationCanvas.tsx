import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Film, Globe2, Image, LoaderCircle, PackageOpen, ShieldCheck, Sparkles, X } from "lucide-react";
import { fetchJob, request } from "@/lib/api-client";
import { getActiveJobId } from "@/lib/guestSession";
import type { JobAsset, JobStatus, JobStatusResponse } from "./types";
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
  | "talking-scene"
  | "interior-design";

type Settings = {
  quality: string | null;
  duration: number | null;
  audio: string | null;
  frameRate: number | null;
};

const KIND: Record<ProductionKind, {
  label: string;
  Icon: typeof Film;
  accentText: string;
  accentDot: string;
  accentSoft: string;
  accentBorder: string;
  accentBar: string;
}> = {
  "website-video": {
    label: "Website campaign",
    Icon: Globe2,
    accentText: "text-violet",
    accentDot: "bg-violet shadow-[0_0_16px_rgba(139,92,246,.8)]",
    accentSoft: "bg-violet/[.08]",
    accentBorder: "border-violet/20",
    accentBar: "bg-violet",
  },
  "ai-video": {
    label: "AI video",
    Icon: Film,
    accentText: "text-pink",
    accentDot: "bg-pink shadow-[0_0_16px_rgba(244,114,182,.72)]",
    accentSoft: "bg-pink/[.07]",
    accentBorder: "border-pink/20",
    accentBar: "bg-pink",
  },
  "product-photos": {
    label: "Product photos",
    Icon: PackageOpen,
    accentText: "text-gold",
    accentDot: "bg-gold shadow-[0_0_16px_rgba(251,191,36,.7)]",
    accentSoft: "bg-gold/[.07]",
    accentBorder: "border-gold/20",
    accentBar: "bg-gold",
  },
  "campaign-photos": {
    label: "Campaign photos",
    Icon: Image,
    accentText: "text-mint",
    accentDot: "bg-mint shadow-[0_0_16px_rgba(52,217,196,.72)]",
    accentSoft: "bg-mint/[.07]",
    accentBorder: "border-mint/20",
    accentBar: "bg-mint",
  },
  "product-video": {
    label: "Product video",
    Icon: PackageOpen,
    accentText: "text-mint",
    accentDot: "bg-mint shadow-[0_0_16px_rgba(52,217,196,.72)]",
    accentSoft: "bg-mint/[.07]",
    accentBorder: "border-mint/20",
    accentBar: "bg-mint",
  },
  "talking-scene": {
    label: "Talking scene",
    Icon: Film,
    accentText: "text-violet",
    accentDot: "bg-violet shadow-[0_0_16px_rgba(139,92,246,.8)]",
    accentSoft: "bg-violet/[.08]",
    accentBorder: "border-violet/20",
    accentBar: "bg-violet",
  },
  "interior-design": {
    label: "Interior design",
    Icon: Image,
    accentText: "text-gold",
    accentDot: "bg-gold shadow-[0_0_16px_rgba(251,191,36,.7)]",
    accentSoft: "bg-gold/[.07]",
    accentBorder: "border-gold/20",
    accentBar: "bg-gold",
  },
};

function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.max(5, Math.ceil(seconds / 5) * 5)} sec`;
  return `~${Math.max(1, Math.ceil(seconds / 60))} min`;
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function cleanAudio(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sceneNumberFromStatus(message: string | null | undefined) {
  const match = message?.match(/(?:premium\s+)?scene\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function humanStatus(status: JobStatus, statusMessage: string | null | undefined, productionKind: ProductionKind) {
  const raw = (statusMessage ?? "").toLowerCase();
  const sceneNumber = sceneNumberFromStatus(statusMessage);

  if (status === "queued") return "Getting everything ready";
  if (status === "capturing") {
    return productionKind === "website-video" ? "Reading your website" : "Reading your references";
  }
  if (status === "captured" || status === "storyboarding") {
    if (raw.includes("camera") || raw.includes("shot")) return "Directing camera movement";
    return "Choosing the strongest story beat";
  }
  if (status === "rendering") {
    if (raw.includes("assembling") || raw.includes("master") || raw.includes("final") || raw.includes("finishing") || raw.includes("mux")) {
      return "Finishing touches";
    }
    if (raw.includes("download")) return sceneNumber ? `Finishing scene ${sceneNumber}` : "Finishing your scene";
    if (raw.includes("photo") || raw.includes("image")) return "Creating your images";
    if (sceneNumber) return `Rendering scene ${sceneNumber}`;
    if (raw.includes("starting") || raw.includes("veo")) return "Directing camera movement";
    return "Rendering your scene";
  }
  if (status === "done") return "Generated";
  if (status === "cancelled") return "Stopped";
  return "This generation needs attention";
}

function cancellationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "We couldn't stop this production right now. Please try again.";
}

function AnimatedDots() {
  return (
    <span className="ml-0.5 inline-flex w-5 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1 w-1 animate-pulse rounded-full bg-current opacity-70"
          style={{ animationDelay: `${index * 180}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
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
  const [storyboard, setStoryboard] = useState<JobStatusResponse["storyboard"]>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stageElapsedSeconds, setStageElapsedSeconds] = useState(0);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [stopCreditsAtRisk, setStopCreditsAtRisk] = useState<number | null>(null);
  const [stopPreviewLoading, setStopPreviewLoading] = useState(false);
  const [stopSubmitting, setStopSubmitting] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const productionStartedAtRef = useRef(Date.now());
  const stageStartedAtRef = useRef(Date.now());
  const lastPhaseKeyRef = useRef("");
  const lastStatusTextRef = useRef("");

  const copy = KIND[productionKind];
  const Icon = copy.Icon;
  const settled = ["done", "failed", "cancelled"].includes(status);
  const safeProgress = status === "done" ? 100 : Math.max(2, Math.min(99, Math.round(progress || 2)));
  const eta = formatEta(etaSeconds);
  const visibleReferences = referenceItems.slice(0, 12);
  const effectiveCancelling = Boolean(cancelling || stopSubmitting || stopRequested);
  const generatedPhotos = useMemo(() => liveAssets.filter((asset) => asset.type === "photo").slice(-4), [liveAssets]);
  const generatedVideo = useMemo(() => [...liveAssets].reverse().find((asset) => asset.type === "video") ?? null, [liveAssets]);
  const statusText = useMemo(
    () => humanStatus(status, statusMessage, productionKind),
    [productionKind, status, statusMessage],
  );
  const phaseKey = `${status}:${sceneNumberFromStatus(statusMessage) ?? ""}`;
  const showLongStageReassurance = !settled && stageElapsedSeconds >= 30;

  useEffect(() => {
    productionStartedAtRef.current = Date.now();
    stageStartedAtRef.current = Date.now();
    lastPhaseKeyRef.current = "";
    setElapsedSeconds(0);
    setStageElapsedSeconds(0);
    setDetailsOpen(false);
    setStopDialogOpen(false);
    setStopCreditsAtRisk(null);
    setStopPreviewLoading(false);
    setStopSubmitting(false);
    setStopRequested(false);
    setStopError(null);
    setLiveAssets([]);
    setStoryboard(null);
  }, [jobId]);

  useEffect(() => {
    if (lastPhaseKeyRef.current === phaseKey) return;
    lastPhaseKeyRef.current = phaseKey;
    stageStartedAtRef.current = Date.now();
    setStageElapsedSeconds(0);
  }, [phaseKey]);

  useEffect(() => {
    if (settled) return;
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - productionStartedAtRef.current) / 1000)));
      setStageElapsedSeconds(Math.max(0, Math.floor((Date.now() - stageStartedAtRef.current) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [settled, jobId]);

  useEffect(() => {
    if (lastStatusTextRef.current && lastStatusTextRef.current !== statusText) {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reducedMotion && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(status === "done" ? 18 : 5);
        } catch {
          // Haptics are best-effort and must never affect generation.
        }
      }
    }
    lastStatusTextRef.current = statusText;
  }, [status, statusText]);

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
        setStoryboard(job.storyboard ?? null);
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

  const chips = useMemo(() => {
    const values: string[] = [aspectRatio];
    if (settings.quality) values.push(settings.quality === "4k" ? "4K" : settings.quality);
    if (settings.duration) values.push(`${settings.duration}s`);
    if (settings.frameRate) values.push(`${settings.frameRate}fps`);
    if (settings.audio) values.push(cleanAudio(settings.audio));
    return values;
  }, [aspectRatio, settings]);

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
        className="relative w-full overflow-hidden rounded-[18px] border border-white/[.075] bg-[#0d0a18]/92 shadow-[0_22px_64px_-46px_rgba(139,92,246,.72)]"
        aria-label={`${copy.label} generation progress`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_-18%,rgba(139,92,246,.12),transparent_34%)]" />
        <div className="relative p-3.5 sm:p-4">
          {settled && status === "done" ? (
            <div className="flex items-center gap-2 text-[11px] text-white/65">
              <span className={`grid h-6 w-6 place-items-center rounded-full border ${copy.accentBorder} ${copy.accentSoft} ${copy.accentText}`}>
                <Check size={12} />
              </span>
              <span>Generated in {formatElapsed(elapsedSeconds)}</span>
            </div>
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border ${copy.accentBorder} ${copy.accentSoft} ${copy.accentText}`}>
                  {brandMarkUrl && productionKind === "website-video" ? (
                    <img
                      src={brandMarkUrl}
                      alt={brandName ? `${brandName} logo` : "Website logo"}
                      className="max-h-5 max-w-7 object-contain"
                    />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  <span className={`absolute bottom-1 right-1 h-1.5 w-1.5 animate-pulse rounded-full ${copy.accentDot}`} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex h-5 items-center overflow-hidden" aria-live="polite" aria-atomic="true">
                    <p key={statusText} className={`animate-fade-in-up truncate text-[12px] font-medium ${copy.accentText}`}>
                      {statusText}<AnimatedDots />
                    </p>
                  </div>
                  <p className="mt-0.5 text-[9px] text-white/38">{copy.label}</p>
                </div>
              </div>

              {showLongStageReassurance && (
                <p className="mt-2 pl-[46px] text-[9px] leading-4 text-white/38">
                  Still working — high-quality renders can take a little longer.
                </p>
              )}

              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] text-white/45">
                  <span className="font-utility tabular-nums">{safeProgress}%</span>
                  <span className="font-utility tabular-nums">{formatElapsed(elapsedSeconds)} elapsed</span>
                </div>
                <div
                  className="h-1 w-full overflow-hidden rounded-full bg-white/[.065]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={safeProgress}
                  aria-label={statusText}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${copy.accentBar}`}
                    style={{ width: `${safeProgress}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[.055] pt-2.5">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((open) => !open)}
                  aria-expanded={detailsOpen}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1.5 text-[9px] font-medium text-white/42 transition hover:text-white/72"
                >
                  {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {detailsOpen ? "Hide details" : "Show details"}
                </button>

                {onCancel && (
                  <button
                    type="button"
                    onClick={() => void openStopDialog()}
                    disabled={effectiveCancelling}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-white/[.075] bg-white/[.02] px-2.5 text-[8px] font-semibold text-white/46 transition hover:border-pink/25 hover:bg-pink/[.04] hover:text-pink disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {effectiveCancelling ? <LoaderCircle size={10} className="animate-spin" /> : <X size={10} />}
                    {effectiveCancelling ? "Stopping…" : "Stop"}
                  </button>
                )}
              </div>

              {detailsOpen && (
                <div className="mt-2.5 space-y-3 rounded-2xl border border-white/[.065] bg-black/15 p-3">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[.14em] text-white/32">Direction</p>
                    <p className="mt-1 text-[10px] leading-5 text-white/70">
                      {storyboard?.concept || storyboard?.creativeBrief || "Building the strongest direction from your prompt and references."}
                    </p>
                    {storyboard?.scenes?.length ? (
                      <div className="mt-2 space-y-1.5">
                        {storyboard.scenes.map((scene, index) => (
                          <div key={scene.sceneNumber ?? index} className="rounded-xl border border-white/[.05] bg-white/[.018] px-2.5 py-2">
                            <p className="text-[8px] font-semibold text-white/42">
                              {productionKind.includes("photos") ? "Image" : "Beat"} {scene.sceneNumber ?? index + 1}
                            </p>
                            <p className="mt-0.5 text-[9px] leading-4 text-white/58">{scene.shotDescription}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[.14em] text-white/32">Output</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-white/[.065] bg-white/[.025] px-2 py-1 text-[8px] text-white/62">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>

                  {visibleReferences.length > 0 && (
                    <div>
                      <p className="text-[8px] font-semibold uppercase tracking-[.14em] text-white/32">References</p>
                      <div className="chat-scroll mt-1.5 flex gap-2 overflow-x-auto pb-1">
                        {visibleReferences.map((item, index) => (
                          <div key={item.id} className="w-24 shrink-0">
                            <div className="relative aspect-video overflow-hidden rounded-lg border border-white/[.07] bg-black/20">
                              <img
                                src={item.url}
                                alt={item.title}
                                loading="eager"
                                decoding="async"
                                className="h-full w-full object-cover object-top"
                              />
                              {sceneAssignments[item.id] ? (
                                <span className="absolute right-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[6px] font-semibold text-white/80">
                                  R{sceneAssignments[item.id]}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-center text-[7px] text-white/38">{item.title || `Reference ${index + 1}`}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(generatedVideo || generatedPhotos.length > 0) && (
                    <div>
                      <p className="text-[8px] font-semibold uppercase tracking-[.14em] text-white/32">Latest output</p>
                      {generatedVideo ? (
                        <video src={generatedVideo.url} muted loop playsInline autoPlay preload="metadata" className="mt-1.5 max-h-44 w-full rounded-xl bg-black object-contain" />
                      ) : (
                        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                          {generatedPhotos.map((asset, index) => (
                            <img key={asset.id} src={asset.url} alt={`Generated image ${index + 1}`} className="aspect-[4/5] w-full rounded-lg object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="border-t border-white/[.05] pt-2 text-[8px] leading-4 text-white/30">
                    {statusMessage ? `Live stage: ${statusMessage}. ` : ""}
                    Provider timing can vary; the stage and elapsed time above are live.
                    {eta ? ` Current estimate: ${eta}.` : ""}
                  </p>
                </div>
              )}
            </>
          )}
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