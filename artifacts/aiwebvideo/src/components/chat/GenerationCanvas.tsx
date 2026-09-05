import { useMemo } from "react";
import {
  Activity,
  Check,
  Clock3,
  Film,
  Globe2,
  Image,
  LoaderCircle,
  MessageCircleMore,
  PackageOpen,
  X,
} from "lucide-react";
import type { JobStatus } from "./types";
import type { CaptureMediaItem } from "./MediaPlanningPanel";

export type ProductionKind =
  | "website-video"
  | "ai-video"
  | "product-photos"
  | "campaign-photos"
  | "product-video"
  | "talking-scene";

function formatEta(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `~${Math.max(5, Math.ceil(seconds / 5) * 5)} sec`;
  return `~${Math.max(1, Math.ceil(seconds / 60))} min`;
}

const productionCopy: Record<
  ProductionKind,
  { label: string; active: string; Icon: typeof Film }
> = {
  "website-video": {
    label: "Website campaign",
    active: "Turning your brand into a directed campaign",
    Icon: Globe2,
  },
  "ai-video": {
    label: "AI video",
    active: "Creating one continuous film from your direction",
    Icon: Film,
  },
  "product-photos": {
    label: "Product photography",
    active: "Building your final product image set",
    Icon: PackageOpen,
  },
  "campaign-photos": {
    label: "Campaign photography",
    active: "Building your campaign image set",
    Icon: Image,
  },
  "product-video": {
    label: "Product video",
    active: "Directing your product into motion",
    Icon: PackageOpen,
  },
  "talking-scene": {
    label: "Talking scene",
    active: "Directing performance, timing and camera",
    Icon: MessageCircleMore,
  },
};

function phaseIndex(status: JobStatus, progress = 0) {
  if (status === "queued" || status === "capturing") return 0;
  if (status === "captured") return 1;
  if (status === "storyboarding") return 1;
  if (status === "rendering") return progress >= 94 ? 3 : 2;
  return 3;
}

function productionStages(kind: ProductionKind) {
  if (kind === "product-photos" || kind === "campaign-photos") {
    return ["References", "Art direction", "Generation", "Finishing"];
  }
  if (kind === "website-video") {
    return ["Brand read", "Direction", "Film", "Mastering"];
  }
  if (kind === "talking-scene") {
    return ["Brief", "Performance", "Film", "Mastering"];
  }
  if (kind === "product-video") {
    return ["References", "Direction", "Film", "Mastering"];
  }
  return ["Brief", "Direction", "Film", "Mastering"];
}

function defaultStatus(kind: ProductionKind, status: JobStatus) {
  const photo = kind === "product-photos" || kind === "campaign-photos";
  if (status === "queued") return "Preparing your inputs and reserving the production run.";
  if (status === "capturing")
    return kind === "website-video"
      ? "Reading the strongest brand, product and visual signals from your website."
      : "Preparing the brief and reference media for production.";
  if (status === "captured") return "Website capture is ready and the creative direction is starting.";
  if (status === "storyboarding")
    return photo
      ? "Choosing compositions, lighting and the campaign treatment."
      : "Locking the full-film timeline, pacing and creative direction.";
  if (status === "rendering")
    return photo
      ? "Generating and finishing the final campaign images."
      : "Generating one continuous film and preparing the master delivery.";
  return "Production state updated.";
}

function parseRenderUnits(message?: string | null) {
  if (!message) return null;
  const match = message.match(/(\d+)\s*\/\s*(\d+)\s*(?:scenes?|images?|shots?)/i);
  if (!match) return null;
  const completed = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return null;
  return { completed: Math.max(0, Math.min(total, completed)), total: Math.min(total, 8) };
}

function parseCurrentRenderUnit(message?: string | null) {
  if (!message) return null;
  const match = message.match(/(?:scene|image|shot)\s*(\d+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function renderUnitLabel(kind: ProductionKind) {
  return kind === "product-photos" || kind === "campaign-photos" ? "Image" : "Scene";
}

function computeVideoGenerationProgress(status: JobStatus, rawProgress: number) {
  if (status === "done") return 100;
  if (status !== "rendering") return 0;

  // Backend render progress reserves ~0-79% for capture + direction/planning.
  // The right-side meter must represent ONLY the actual video provider/mastering
  // work, so remap the rendering window (80..95) to a clean 0..100%.
  const videoOnly = ((rawProgress - 80) / 15) * 100;
  return Math.max(1, Math.min(99, Math.round(videoOnly)));
}

function computeDisplayedProgress({
  status,
  rawProgress,
  unitTotal,
  unitCompleted,
  currentUnit,
}: {
  status: JobStatus;
  rawProgress: number;
  unitTotal: number;
  unitCompleted: number;
  currentUnit: number;
}) {
  if (status === "done") return 100;
  if (status === "failed" || status === "cancelled") return Math.max(0, Math.min(100, rawProgress));
  if (status === "queued") return Math.max(4, Math.min(10, rawProgress || 6));
  if (status === "capturing") return Math.max(12, Math.min(28, rawProgress || 18));
  if (status === "storyboarding") return Math.max(32, Math.min(56, rawProgress || 44));
  const activeFraction = currentUnit > unitCompleted ? 0.18 : 0;
  const progressUnits = Math.min(unitTotal, unitCompleted + activeFraction);
  const renderProgress = 58 + (progressUnits / Math.max(1, unitTotal)) * 38;
  return Math.max(58, Math.min(96, Math.round(renderProgress)));
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
  const rawProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const settled = ["done", "failed", "cancelled"].includes(status);
  const stages = useMemo(() => productionStages(productionKind), [productionKind]);
  const copy = productionCopy[productionKind];
  const Icon = copy.Icon;
  const parsedUnits = useMemo(() => parseRenderUnits(statusMessage), [statusMessage]);
  const parsedCurrentUnit = useMemo(() => parseCurrentRenderUnit(statusMessage), [statusMessage]);
  const retrying = /retry|busy|temporar/i.test(statusMessage ?? "");
  const unitLabel = renderUnitLabel(productionKind);
  const defaultUnitTotal = productionKind === "product-photos" || productionKind === "campaign-photos" ? 4 : 4;
  const unitTotal = parsedUnits?.total ?? defaultUnitTotal;
  const inferredCompleted = Math.max(0, Math.min(unitTotal, Math.floor(((rawProgress - 55) / 39) * unitTotal)));
  const unitCompleted = parsedUnits?.completed ?? (status === "done" ? unitTotal : status === "rendering" ? inferredCompleted : 0);
  const currentUnit =
    status === "rendering"
      ? Math.min(unitTotal, parsedCurrentUnit ?? unitCompleted + 1)
      : 0;
  const safeProgress = computeDisplayedProgress({
    status,
    rawProgress,
    unitTotal,
    unitCompleted,
    currentUnit,
  });
  const videoGenerationProgress = computeVideoGenerationProgress(status, rawProgress);
  const currentPhase = phaseIndex(status, safeProgress);
  const sceneReferenceCount = Object.keys(sceneAssignments).length;

  const liveMessage = statusMessage || defaultStatus(productionKind, status);

  const phaseLabel =
    status === "queued"
      ? "Preparing production"
      : status === "capturing"
        ? stages[0]
        : status === "captured"
          ? "Capture ready"
          : status === "storyboarding"
          ? stages[1]
          : status === "rendering"
            ? stages[currentPhase]
            : status === "done"
              ? "Complete"
              : status === "cancelled"
                ? "Stopped"
                : "Needs attention";

  const workingNotes =
    status === "capturing"
      ? [
          "Reading the prompt and visual identity",
          "Selecting only distinct, high-value pages",
          "Skipping repeated pages and preparing the film direction",
        ]
      : status === "storyboarding"
        ? [
            "Structuring the story and opening hook",
            "Choosing the strongest captures as film references",
            "Locking the pacing, motion and final ending",
          ]
        : status === "rendering"
          ? productionKind === "product-photos" || productionKind === "campaign-photos"
            ? [
                `Generating ${unitLabel.toLowerCase()} ${Math.max(1, currentUnit || 1)} of ${unitTotal}`,
                retrying ? "Provider is busy, so the system is retrying automatically" : "Generating the current image and keeping progress attached to this chat",
                "Preparing the final image set in the background",
              ]
            : [
                "Generating one continuous film for the full requested duration",
                retrying ? "Provider is busy, so the system is retrying automatically" : "Long videos continue from the same Veo video instead of stitching unrelated clips",
                "Mastering the exact duration, format and audio after generation",
              ]
          : [
              "Finalizing outputs",
              "Saving the result to this conversation",
              "Preparing reuse controls for the next version",
            ];

  return (
    <section
      className="relative w-full overflow-hidden rounded-[28px] border border-white/[.09] bg-[#0d0a18] shadow-[0_34px_100px_-58px_rgba(139,92,246,.9)]"
      aria-label={`${copy.label} production progress`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_-12%,rgba(139,92,246,.18),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(52,217,196,.07),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet/60 to-transparent" />

      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`relative flex h-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[.055] text-mint shadow-[inset_0_1px_0_rgba(255,255,255,.07),0_12px_30px_-22px_rgba(52,217,196,.65)] ${brandMarkUrl && productionKind === "website-video" ? "min-w-11 max-w-[118px] px-2.5" : "w-11"}`}>
              {brandMarkUrl && productionKind === "website-video" ? (
                <img src={brandMarkUrl} alt={brandName ? `${brandName} logo` : "Website logo"} className="max-h-7 max-w-[92px] object-contain" />
              ) : (
                <Icon size={18} aria-hidden="true" />
              )}
              {!settled && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0a18] bg-mint shadow-[0_0_12px_rgba(52,217,196,.75)]" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-semibold text-white sm:text-[15px]">{copy.label}</p>
                {!settled && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-mint/15 bg-mint/[.07] px-2 py-0.5 font-utility text-[8px] font-semibold uppercase tracking-[.16em] text-mint">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Live
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-text-dim">{aspectRatio} delivery · this production stays in the chat</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {formatEta(etaSeconds) && !settled && (
              <span className="hidden items-center gap-1.5 text-[10px] text-text-dim sm:flex">
                <Clock3 size={12} aria-hidden="true" /> {formatEta(etaSeconds)}
              </span>
            )}
            <div className="relative flex h-12 w-12 items-center justify-center" aria-label={`${safeProgress}% complete`}>
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2.5" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#34d9c4" strokeWidth="2.5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - safeProgress} className="transition-[stroke-dashoffset] duration-700" />
              </svg>
              <span className="font-utility text-[10px] font-semibold text-white">{safeProgress}%</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,.92fr)] lg:gap-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-mint">
              <Activity size={13} aria-hidden="true" />
              <span className="font-utility text-[9px] font-semibold uppercase tracking-[.19em]">{phaseLabel}</span>
            </div>
            <h3 className="mt-2 max-w-2xl font-display text-2xl font-bold leading-[1.1] tracking-[-.025em] text-white sm:text-[30px]">{copy.active}</h3>
            <div className="mt-3 flex max-w-2xl flex-wrap items-start gap-2.5">
              <p role="status" aria-live="polite" className="min-w-0 flex-1 text-[12px] leading-6 text-text-muted sm:text-[13px]">{liveMessage}</p>
              {retrying && !settled && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet/20 bg-violet/[.08] px-2.5 py-1 font-utility text-[8px] font-semibold uppercase tracking-[.14em] text-violet">
                  <LoaderCircle size={9} className="animate-spin" /> Auto retry
                </span>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.028] p-4">
              <div className="flex items-center gap-2 text-mint">
                <Activity size={13} aria-hidden="true" />
                <span className="font-utility text-[8px] font-semibold uppercase tracking-[.18em]">Working now</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {workingNotes.map((note, index) => (
                  <div key={note} className="flex items-start gap-2.5 text-[11px] leading-5 text-text-muted">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${index === 0 && !settled ? "bg-mint shadow-[0_0_14px_rgba(52,217,196,.85)]" : "bg-white/25"}`} />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Production stages">
              {stages.map((label, index) => {
                const complete = index < currentPhase || status === "done";
                const current = index === currentPhase && !settled;
                const compactLabel = label === "Brand read" ? "Brand" : label;
                return (
                  <li
                    key={label}
                    className={`relative min-w-0 overflow-hidden rounded-xl border px-2 py-2.5 transition-all duration-300 sm:px-2.5 ${
                      complete
                        ? "border-mint/20 bg-mint/[.055] shadow-[0_12px_26px_-24px_rgba(52,217,196,.7)]"
                        : current
                          ? "border-violet/35 bg-[linear-gradient(135deg,rgba(139,92,246,.16),rgba(236,72,153,.07))] shadow-[0_14px_30px_-24px_rgba(139,92,246,.9)]"
                          : "border-white/[.07] bg-white/[.018]"
                    }`}
                  >
                    {current && <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-violet to-transparent" />}
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${complete ? "border-mint/25 bg-mint/10 text-mint" : current ? "border-violet/35 bg-violet/[.14] text-violet" : "border-white/[.08] bg-black/15 text-text-dim"}`}>
                        {complete ? <Check size={11} strokeWidth={2.5} /> : current ? <LoaderCircle size={11} className="animate-spin" /> : <span className="font-utility text-[8px]">{index + 1}</span>}
                      </span>
                      <div className="min-w-0">
                        <span className={`block truncate text-[9px] font-semibold sm:text-[10px] ${complete || current ? "text-white" : "text-text-dim"}`}>{compactLabel}</span>
                        <span className={`mt-0.5 hidden font-utility text-[7px] uppercase tracking-[.12em] sm:block ${complete ? "text-mint/75" : current ? "text-violet/80" : "text-white/25"}`}>
                          {complete ? "Done" : current ? "Active" : "Next"}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] text-text-dim">
                <span>{settled ? phaseLabel : "Overall production"}</span>
                <span className="font-utility uppercase tracking-[.12em]">{safeProgress}%</span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/[.07]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-signature transition-[width] duration-700" style={{ width: `${Math.max(2, safeProgress)}%` }} />
                {!settled && <div className="generation-sweep absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />}
              </div>
            </div>

            {productionKind === "website-video" && (status === "capturing" || referenceItems.length > 0) && (
              <div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-utility text-[8px] font-semibold uppercase tracking-[.18em] text-mint">Live capture · film references</p>
                    <p className="mt-1 text-[11px] leading-5 text-text-muted">Screenshots appear as they are saved. Only distinct, high-value pages are kept, and R1, R2, R3… badges show the strongest references guiding the continuous film.</p>
                  </div>
                  <span className="rounded-full border border-white/[.08] bg-white/[.04] px-2.5 py-1 font-utility text-[8px] uppercase tracking-[.14em] text-white/75">{referenceItems.length} useful</span>
                </div>
                <div className="chat-scroll mt-3 flex gap-3 overflow-x-auto pb-1">
                  {(referenceItems.length ? referenceItems : Array.from({ length: 4 }).map((_, index) => ({ id: `placeholder-${index}`, url: "", title: `Capture ${index + 1}` } as CaptureMediaItem))).map((item, index) => {
                    const isPlaceholder = !item.url;
                    const sceneNumber = sceneAssignments[item.id];
                    return (
                      <div key={item.id} className="w-44 shrink-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[#110d1e] sm:w-52">
                        <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(145deg,#171229,#0a0813)]">
                          {isPlaceholder ? (
                            <div className="absolute inset-0">
                              <div className="generation-soft-flash pointer-events-none absolute inset-0" aria-hidden="true" />
                              <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_35%_30%,rgba(139,92,246,.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,0))]" />
                              <div className="absolute inset-x-5 top-5 h-4 rounded-full bg-white/[.06]" />
                              <div className="absolute inset-x-8 top-14 h-20 rounded-2xl border border-white/[.08] bg-white/[.03]" />
                            </div>
                          ) : (
                            <img src={item.url} alt={item.title} className="h-full w-full object-cover object-top" />
                          )}
                          <span className={`absolute left-2 top-2 rounded-full px-2 py-1 font-utility text-[8px] uppercase tracking-[.14em] ${isPlaceholder ? "border border-violet/20 bg-violet/15 text-violet" : "border border-mint/20 bg-mint/15 text-mint"}`}>{isPlaceholder ? "Capturing" : "Saved"}</span>
                          {sceneNumber ? <span className="absolute right-2 top-2 rounded-full border border-violet/25 bg-violet/95 px-2 py-1 font-utility text-[8px] font-bold uppercase tracking-[.14em] text-white">R{sceneNumber}</span> : null}
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="truncate text-[10px] text-white/90">{item.title}</p>
                          <p className="mt-1 text-[9px] text-text-dim">{isPlaceholder ? "Will appear here as soon as capture completes" : "Ready as a film reference"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-white/[.08] bg-[#100c1c] p-4 sm:p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(139,92,246,.14),transparent_42%),radial-gradient(circle_at_65%_85%,rgba(52,217,196,.07),transparent_34%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="font-utility text-[8px] font-semibold uppercase tracking-[.18em] text-text-dim">Live generation</p>
                <p className="mt-1 font-display text-sm font-semibold text-white">{status === "rendering" ? (productionKind === "product-photos" || productionKind === "campaign-photos" ? `${unitLabel} ${Math.max(1, currentUnit || 1)} of ${unitTotal}` : "Continuous film") : phaseLabel}</p>
              </div>
              {!settled && <span className="h-2 w-2 animate-pulse rounded-full bg-mint shadow-[0_0_18px_rgba(52,217,196,.9)]" />}
            </div>

            <div className="generation-preview relative mt-5 min-h-[190px] sm:min-h-[250px] overflow-hidden rounded-[20px] border border-white/[.08] bg-[linear-gradient(145deg,#161028,#0b0912)]">
              {!settled && <div className="generation-soft-flash pointer-events-none absolute inset-0" aria-hidden="true" />}
              <div className="pointer-events-none absolute inset-0 generation-grid opacity-30" />
              <div className="relative flex min-h-[190px] sm:min-h-[250px] flex-col items-center justify-center px-7 text-center">
                <span className={`flex min-h-12 items-center justify-center overflow-hidden rounded-2xl border border-white/[.1] bg-white/[.05] text-mint ${brandMarkUrl && productionKind === "website-video" ? "min-w-12 max-w-[132px] px-3 py-2" : "h-12 w-12"}`}>
                  {brandMarkUrl && productionKind === "website-video" ? (
                    <img src={brandMarkUrl} alt={brandName ? `${brandName} logo` : "Website logo"} className="max-h-8 max-w-[104px] object-contain" />
                  ) : status === "rendering" ? (
                    <Film size={20} />
                  ) : (
                    <Icon size={20} />
                  )}
                </span>
                <p className="mt-4 font-display text-base font-semibold text-white">
                  {status === "rendering" ? (productionKind === "product-photos" || productionKind === "campaign-photos" ? `Creating ${unitLabel.toLowerCase()} ${Math.max(1, currentUnit || 1)}` : "Creating your full video") : copy.active}
                </p>
                <p className="mt-2 max-w-xs text-[10px] leading-5 text-text-dim">
                  {retrying ? "The provider is busy. Retrying automatically without losing this production." : "The visual pulse stays active while generation is running. You can leave this chat and return without stopping the job."}
                </p>
                {!settled && (
                  <div className="mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-white/[.06]">
                    <div className="generation-sweep h-full w-16 bg-gradient-to-r from-transparent via-mint/80 to-transparent" />
                  </div>
                )}
              </div>
            </div>

            {productionKind === "product-photos" || productionKind === "campaign-photos" ? (
              <div className="relative mt-4 grid grid-cols-4 gap-2">
                {Array.from({ length: unitTotal }).map((_, index) => {
                const number = index + 1;
                const complete = number <= unitCompleted || status === "done";
                const current = status === "rendering" && number === currentUnit && !complete;
                return (
                  <div key={number} className={`relative overflow-hidden rounded-xl border px-2 py-2.5 text-center transition-all duration-300 ${complete ? "border-mint/20 bg-mint/[.055]" : current ? "border-violet/35 bg-[linear-gradient(145deg,rgba(139,92,246,.17),rgba(236,72,153,.06))] shadow-[0_14px_28px_-24px_rgba(139,92,246,.9)]" : "border-white/[.07] bg-white/[.018]"}`}>
                    {current && <span className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-violet to-transparent" />}
                    <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg border ${complete ? "border-mint/20 bg-mint/10" : current ? "border-violet/30 bg-violet/[.12]" : "border-white/[.07] bg-black/20"}`}>
                      {complete ? <Check size={11} className="text-mint" /> : current ? <LoaderCircle size={11} className="animate-spin text-violet" /> : <span className="font-utility text-[8px] text-text-dim">{number}</span>}
                    </div>
                    <p className={`mt-1.5 font-utility text-[8px] font-semibold uppercase tracking-[.12em] ${complete ? "text-mint/85" : current ? "text-white" : "text-text-dim"}`}>S{number}</p>
                  </div>
                );
                })}
              </div>
            ) : status === "rendering" || status === "done" ? (
              <div className="relative mt-4 rounded-2xl border border-white/[.08] bg-white/[.025] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-utility text-[8px] font-semibold uppercase tracking-[.16em] text-mint">Video generation</p>
                    <p className="mt-1 text-[10px] text-text-muted">This meter counts only the continuous video render, not Brand or Direction.</p>
                  </div>
                  <span className="font-utility text-[9px] font-semibold text-white/80">{videoGenerationProgress}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]" role="progressbar" aria-label="Video generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={videoGenerationProgress}>
                  <div className="h-full rounded-full bg-signature transition-[width] duration-700" style={{ width: `${videoGenerationProgress}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-text-dim">
            <span className="font-utility uppercase tracking-[.14em]">{aspectRatio}</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
            <span>{formatEta(etaSeconds) ? `Estimated ${formatEta(etaSeconds)}` : "Live status updates automatically"}</span>
          </div>
          {onCancel && !settled && (
            <button type="button" onClick={onCancel} disabled={cancelling} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/[.09] bg-white/[.025] px-3.5 text-[10px] font-semibold text-text-muted transition hover:border-pink/30 hover:bg-pink/[.055] hover:text-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 disabled:cursor-not-allowed disabled:opacity-50">
              <X size={12} /> {cancelling ? "Stopping safely…" : "Stop generation"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
