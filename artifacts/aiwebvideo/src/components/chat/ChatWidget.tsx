import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatBubble } from "./ChatBubble";
import { QuickReplyChips } from "./QuickReplyChips";
import { ChatInputBar } from "./ChatInputBar";
import { SiteCard } from "./SiteCard";
import { ResultGrid } from "./ResultGrid";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
import { watchAuthState } from "@/lib/firebase/client";
import {
  startCapture,
  requestStoryboard,
  requestGenerationPreflight,
  requestRender,
  requestRenderQuote,
  cancelJob,
  fetchJob,
  fetchMe,
  reuseSavedCapture,
  saveJobMessage,
  saveJobWorkflow,
  uploadPhotos,
  uploadStudioMedia,
  uploadPrivatePages,
  claimJob,
  ApiError,
} from "@/lib/api-client";
import { LockedTeaser } from "./LockedTeaser";
import { PaywallModal } from "./PaywallModal";
import { PhotoUploadPicker } from "./PhotoUploadPicker";
import { MediaPlanningPanel, autoSelectCaptureIds, captureMediaItems } from "./MediaPlanningPanel";
import { useJobPolling } from "@/lib/hooks/useJobPolling";
import { clearActiveJobId, getActiveJobId, resolveDashboardDestination, setActiveJobId } from "@/lib/guestSession";
import {
  FORMAT_OPTIONS,
  MODE_OPTIONS,
  type AudioMode,
  type CaptureMetadata,
  type JobAsset,
  type JobMode,
  type JobStatusResponse,
  type JobWorkflowState,
  type WorkflowStage,
} from "./types";
import { normalizeWebsiteUrl } from "@/lib/websiteUrl";
import { estimateRenderCredits } from "@/lib/credits";
import {
  clearLocalJobWorkflow,
  loadLocalJobWorkflow,
  normalizeJobWorkflow,
  saveLocalJobWorkflow,
} from "@/lib/jobWorkflowDraft";
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft } from "@/lib/photoDraft";
import {
  WebsiteBriefForm,
  type CreationIntent,
  type StudioGenerationRequest,
  type WebsiteProductionMode,
  type WebsiteGenerationSettings,
} from "./WebsiteBriefForm";
import { GenerationCanvas, type ProductionKind } from "./GenerationCanvas";
import { clearPublicCreatorHandoff, loadPublicCreatorHandoff, savePublicCreatorHandoff } from "@/lib/publicCreatorHandoff";

type Stage = "awaiting_url" | WorkflowStage;

interface Message {
  id: string;
  role: "bot" | "user";
  content: ReactNode;
}

function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
}


function isPublicCreatorPath() {
  return window.location.pathname === "/" || window.location.pathname.startsWith("/studio");
}

function isWorkspacePath() {
  return window.location.pathname === "/dashboard";
}

function buildDraftItems(files: File[]) {
  return files.map((file, index) => ({
    id: `${Date.now()}-${index}-${file.name}`,
    file,
    source: "picker" as const,
  }));
}

function websiteBrandName(sourceUrl?: string | null, title?: string | null) {
  if (sourceUrl && !sourceUrl.startsWith("upload://")) {
    try {
      return new URL(sourceUrl).hostname.replace(/^www\./i, "");
    } catch { /* use title below */ }
  }
  const compactTitle = (title || "").split(/[|·—]/)[0]?.trim();
  return compactTitle || "Website";
}

const RESTORABLE_BEFORE_STORYBOARD = new Set<WorkflowStage>([
  "preview_ready",
  "awaiting_private_pages",
  "awaiting_mode",
  "awaiting_duration",
  "awaiting_format",
  "awaiting_features",
  "awaiting_brief",
]);
const RESTORABLE_WITH_STORYBOARD = new Set<WorkflowStage>([
  "awaiting_duration",
  "awaiting_format",
  "awaiting_features",
  "awaiting_brief",
  "ready_to_render",
]);

function resolveResumeStage(
  saved: JobStatusResponse,
  workflow: JobWorkflowState | null,
): WorkflowStage {
  // Server process status always wins over a cached UI step. This is what
  // makes closing the tab during generation safe: the provider continues,
  // and reopening reconnects to that same job rather than starting another.
  if (saved.status === "rendering") return "rendering";
  if (saved.status === "done") return "done";
  if (saved.status === "failed" || saved.status === "cancelled")
    return "failed";

  // A public guest website preview intentionally stops after browser capture.
  // Do not auto-start direction until the visitor continues into Workspace.
  if (workflow?.stage === "preview_ready" && saved.captureMetadata && !saved.storyboard)
    return "preview_ready";

  // Website productions are intentionally automatic. If capture finished but
  // the storyboard has not started yet, reconnect through the live capture
  // stage so the transition effect can launch planning. This also repairs jobs
  // created by an older frontend that did not persist websiteAutoFlow in time.
  if (
    saved.captureMetadata &&
    !saved.storyboard &&
    !saved.sourceUrl.startsWith("upload://")
  )
    return "capturing";

  // A storyboard can finish while the tab is hidden/reloaded. Re-enter the
  // storyboarding stage for website jobs so the existing auto-render effect
  // can immediately continue into final generation instead of parking forever
  // on a ready state.
  if (
    saved.status === "storyboarding" &&
    saved.storyboard &&
    !saved.sourceUrl.startsWith("upload://")
  )
    return "storyboarding";

  if (saved.status === "storyboarding" && !saved.storyboard)
    return "storyboarding";
  if (
    (saved.status === "capturing" || saved.status === "queued") &&
    !saved.captureMetadata
  )
    return "capturing";

  const candidate = workflow?.stage;
  if (saved.storyboard)
    return candidate && RESTORABLE_WITH_STORYBOARD.has(candidate)
      ? candidate
      : "ready_to_render";
  if (candidate && RESTORABLE_BEFORE_STORYBOARD.has(candidate))
    return candidate;
  return saved.sourceUrl.startsWith("upload://")
    ? "awaiting_mode"
    : "awaiting_private_pages";
}

const MODE_DEFAULT_VIBES: Record<JobMode, string> = {
  video: "Premium editorial · luxury agency pacing",
  tutorial: "Clear · calm · easy to follow",
  buy: "Premium commerce · confident · conversion focused",
  tour: "Polished feature showcase · clean · modern",
  demo: "Generative cinematic brand film · premium launch quality",
  photos: "Premium marketing campaign · art-directed · brand faithful",
  icon: "Distinctive · brand faithful · polished at every size",
  both: "Exact-capture video · creative premium marketing stills",
  mockup: "Fast social-feed reveal · energetic · scroll-stopping",
  linkedin: "Professional · credible · LinkedIn feed optimized",
  custom: "Guided entirely by your written idea",
};

const isImageMode = (value: JobMode) => value === "photos" || value === "icon";

let msgCounter = 0;
const nextId = () => `m${++msgCounter}`;

function doneResultMessage(
  job: JobStatusResponse,
  onUnlock: () => void,
): ReactNode {
  const label =
    job.mode === "photos"
      ? "Your AI photo campaign is ready."
      : job.mode === "custom"
        ? "Your AI-generated video is ready."
        : job.sourceUrl.startsWith("upload://")
          ? "Your AI-generated production is ready."
          : "Your website campaign is ready.";
  return (
    <div className="space-y-2">
      <p>{label}</p>
      {job.errorMessage && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {job.errorMessage}
        </p>
      )}
      <ResultGrid assets={job.assets} onUnlock={onUnlock} sourceKind={resultSourceKind(job)} />
    </div>
  );
}

const HIDDEN_RESTORED_MESSAGE_KINDS = new Set(["source_continuation"]);

function resultSourceKind(job: Pick<JobStatusResponse, "sourceUrl" | "captureMetadata">): "website" | "studio" | "upload" {
  const sourceType = job.captureMetadata?.sourceType;
  if (sourceType === "studio") return "studio";
  if (sourceType === "upload" || job.sourceUrl.startsWith("upload://")) return "upload";
  return "website";
}

function restoredMessageContent(
  message: JobStatusResponse["messages"][number],
  onUnlock: () => void,
  sourceKind: "website" | "studio" | "upload" = "website",
): ReactNode {
  const assets = Array.isArray(message.payload?.resultAssets)
    ? (message.payload?.resultAssets as JobAsset[])
    : [];
  if (message.kind === "result" && assets.length > 0) {
    return (
      <div className="space-y-3">
        <p>{message.content}</p>
        <ResultGrid assets={assets} onUnlock={onUnlock} sourceKind={sourceKind} />
      </div>
    );
  }
  return message.content;
}

function storyboardSummaryMessage(
  job: JobStatusResponse,
  mode: JobMode,
  aspectRatio: string,
  frameRate: number,
): ReactNode {
  const sb = job.storyboard;
  if (!sb) return null;
  const scenes = Array.isArray(sb.scenes)
    ? sb.scenes.filter((scene) => scene && typeof scene === "object")
    : [];
  const ideas = Array.isArray(sb.ideas)
    ? sb.ideas.filter((idea): idea is string => typeof idea === "string")
    : [];
  return (
    <div className="space-y-2">
      <p className="font-semibold text-text-primary">
        {sb.concept || "Production plan"}
      </p>
      <p className="text-text-muted">
        {isImageMode(mode)
          ? `${scenes.length} marketing image${scenes.length === 1 ? "" : "s"}.`
          : `One continuous ${sb.targetDurationSeconds || scenes.reduce((s, x) => s + (Number(x.durationSeconds) || 0), 0)}s video · ${scenes.length} internal timeline beat${scenes.length === 1 ? "" : "s"}.`}
      </p>
      <p className="font-utility text-[11px] text-mint">
        {isImageMode(mode)
          ? `Creative photo editing · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === "4k" ? "4K master" : "1080p"}`
          : `Studio quality · ${sb.aspectRatio ?? aspectRatio} · ${sb.outputQuality === "4k" ? "4K master" : "1080p"} · ${sb.frameRate ?? frameRate} FPS`}
      </p>
      <div className="space-y-1.5">
        {scenes.map((scene, index) => (
          <div
            key={scene.sceneNumber ?? index}
            className="rounded-xl border border-white/5 bg-white/[.025] px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-violet">
              {isImageMode(mode)
                ? mode === "icon"
                  ? "Icon"
                  : "Image"
                : "Beat"}{" "}
              {scene.sceneNumber ?? index + 1}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {scene.shotDescription || "Timeline beat ready"}
            </p>
          </div>
        ))}
      </div>
      {ideas.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer text-text-dim hover:text-text-muted">
            Other creative directions
          </summary>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            {ideas.map((idea, i) => (
              <li key={i}>{idea}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ChatWidget({
  className,
  onJobCreated,
  initialJobId,
  initialMode,
  resumeJobId,
  expandInitialPanel = false,
  initialCreationIntent,
  compactLanding = false,
}: {
  className?: string;
  onJobCreated?: (jobId: string) => void;
  initialJobId?: string | null;
  initialMode?: JobMode | null;
  resumeJobId?: string | null;
  expandInitialPanel?: boolean;
  initialCreationIntent?: CreationIntent;
  compactLanding?: boolean;
}) {
  const reopeningExistingChat = Boolean(resumeJobId || initialJobId);
  const streamlinedInitialComposer = compactLanding || isWorkspacePath() || window.location.pathname.startsWith("/studio");
  const [messages, setMessages] = useState<Message[]>(() =>
    reopeningExistingChat
      ? []
      : [
          {
            id: nextId(),
            role: "bot",
            content:
              "Choose what you want to create, add your source, and direct it here. I’ll keep the full production in this conversation.",
          },
        ],
  );
  const [restoring, setRestoring] = useState(reopeningExistingChat);
  const [stage, setStage] = useState<Stage>("awaiting_url");
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const selectJobId = (value: string | null) => {
    jobIdRef.current = value;
    setJobId(value);
    // Remember the in-progress chat across a sign-in redirect (see
    // guestSession.ts) — harmless to also set this for already-signed-in
    // dashboard usage, it's just never read there.
    if (value) setActiveJobId(value);
  };
  const [mode, setMode] = useState<JobMode>("video");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallContext, setPaywallContext] = useState<string | undefined>();
  const [creditBalance, setCreditBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("voice_music");
  const skipVoiceover = audioMode !== "voice_music";
  const [narrationLanguage, setNarrationLanguage] = useState("en");
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [featuresText, setFeaturesText] = useState<string | null>(null);
  const [creativeBrief, setCreativeBrief] = useState<string | null>(null);
  const [manualRenderAfterPlan, setManualRenderAfterPlan] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">(
    "16:9",
  );
  const [outputQuality, setOutputQuality] = useState<"1080p" | "4k">("1080p");
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(24);
  const [activeCaptureMetadata, setActiveCaptureMetadata] =
    useState<CaptureMetadata | null>(null);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<string[]>([]);
  const selectionKeyRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const generationProcessRef = useRef<HTMLDivElement>(null);
  const previousPollingActiveRef = useRef(false);
  const pendingActionRef = useRef<(() => unknown | Promise<unknown>) | null>(null);
  const redirectAfterAuthRef = useRef(false);
  const pendingWebsiteAttachmentsRef = useRef<File[]>([]);
  const pollNoticeRef = useRef(false);
  const workflowReadyRef = useRef(!resumeJobId && !initialJobId);
  const autoRenderRef = useRef(false);
  const publicHandoffStartedRef = useRef(false);
  const websiteRequestRef = useRef<{
    brief: string;
    mode: WebsiteProductionMode;
    durationSeconds: number | "auto";
    aspectRatio: "16:9" | "9:16" | "1:1";
    outputQuality: "1080p" | "4k";
    audioMode: AudioMode;
    narrationLanguage: string;
  } | null>(null);

  const pollingActive =
    stage === "capturing" || stage === "storyboarding" || stage === "rendering";
  const { job, error: pollError } = useJobPolling(jobId, pollingActive);
  const estimatedCredits = estimateRenderCredits(
    mode,
    skipVoiceover,
    job?.storyboard?.targetDurationSeconds || durationSeconds,
    job?.storyboard?.outputQuality ?? outputQuality,
  );
  const estimatedShortfall = Math.max(0, estimatedCredits - creditBalance);
  const projectCaptureMetadata = activeCaptureMetadata ?? job?.captureMetadata;
  const isStudioProject = projectCaptureMetadata?.sourceType === "studio";
  const productionKind: ProductionKind =
    mode === "photos"
      ? isStudioProject
        ? "product-photos"
        : "campaign-photos"
      : isStudioProject && projectCaptureMetadata?.studioKind === "product"
        ? "product-video"
        : isStudioProject && projectCaptureMetadata?.studioKind === "scenario"
          ? "talking-scene"
          : isStudioProject
            ? "ai-video"
            : "website-video";
  const liveReferenceItems = captureMediaItems(projectCaptureMetadata);
  const activeSceneCount = Math.max(
    1,
    Math.ceil((job?.storyboard?.targetDurationSeconds || durationSeconds) / 8),
  );
  const sceneAssignments = useMemo(() => {
    const exactSceneRefs = job?.storyboard?.sceneCaptureIds;
    if (Array.isArray(exactSceneRefs) && exactSceneRefs.length > 0) {
      const entries: Array<readonly [string, number]> = [];
      exactSceneRefs.forEach((captureIds, sceneIndex) => {
        for (const id of captureIds ?? []) {
          if (!id || entries.some(([existing]) => existing === id)) continue;
          entries.push([id, sceneIndex + 1] as const);
        }
      });
      if (entries.length) return Object.fromEntries(entries) as Record<string, number>;
    }
    const entries = selectedCaptureIds.slice(0, activeSceneCount).map((id, index) => [id, index + 1] as const);
    return Object.fromEntries(entries) as Record<string, number>;
  }, [job?.storyboard?.sceneCaptureIds, selectedCaptureIds, activeSceneCount]);

  // A fresh job (new capture, reuse, regenerate) always starts cancellable
  // again — never leave the Stop button disabled because of a previous job.
  useEffect(() => {
    setCancelling(false);
    autoRenderRef.current = false;
  }, [jobId]);

  useEffect(
    () =>
      watchAuthState((user) => {
        setIsSignedIn(!!user);
        if (!user) {
          setIsAdmin(false);
          setCreditBalance(0);
          return;
        }
        void fetchMe()
          .then((me) => {
            setIsAdmin(me.isAdmin);
            setCreditBalance(me.creditsBalance);
          })
          .catch(() => {
            setIsAdmin(false);
          });
      }),
    [],
  );

  useEffect(() => {
    if (publicHandoffStartedRef.current) return;
    if (!isSignedIn || restoring || busy || jobId) return;
    if (window.location.pathname !== "/dashboard") return;
    const handoff = loadPublicCreatorHandoff();
    if (!handoff) return;
    publicHandoffStartedRef.current = true;

    void (async () => {
      try {
        let files: File[] = [];
        if (handoff.attachmentDraftKey) {
          const draft = await loadPhotoDraft(handoff.attachmentDraftKey).catch(() => []);
          files = draft.map((item) => item.file).filter((file): file is File => file instanceof File);
          await clearPhotoDraft(handoff.attachmentDraftKey).catch(() => {});
        }

        clearPublicCreatorHandoff();
        if (window.location.search.includes("handoff=1") || window.location.search.includes("create=")) {
          window.history.replaceState({}, "", "/dashboard");
        }

        if (handoff.kind === "website") {
          await performWebsiteSubmit(handoff.url, handoff.brief, handoff.settings, files);
        } else {
          await performStudioSubmit({ ...handoff.request, files });
        }
      } catch (error) {
        clearPublicCreatorHandoff();
        pushBot(errorMessage(error));
        publicHandoffStartedRef.current = false;
      }
    })();
  }, [isSignedIn, restoring, busy, jobId]);

  function restoreWorkflow(saved: JobStatusResponse): JobWorkflowState | null {
    const localWorkflow = loadLocalJobWorkflow(saved.id);
    const serverWorkflow = normalizeJobWorkflow(saved.workflowState);
    const workflow =
      (localWorkflow?.savedAt ?? 0) > (serverWorkflow?.savedAt ?? 0)
        ? localWorkflow
        : (serverWorkflow ?? localWorkflow);
    if (workflow) {
      setMode(workflow.mode);
      setDurationSeconds(workflow.durationSeconds);
      setFeaturesText(workflow.featuresText);
      setCreativeBrief(workflow.creativeBrief);
      setManualRenderAfterPlan(workflow.manualRenderAfterPlan === true);
      setAspectRatio(workflow.aspectRatio);
      setOutputQuality(workflow.outputQuality);
      setFrameRate(workflow.frameRate);
      setSelectedCaptureIds(workflow.selectedCaptureIds);
      setAudioMode(workflow.audioMode);
      setNarrationLanguage(workflow.narrationLanguage);
      if (
        workflow.websiteAutoFlow &&
        !saved.sourceUrl.startsWith("upload://")
      ) {
        websiteRequestRef.current = {
          brief: workflow.creativeBrief ?? "",
          mode:
            workflow.mode === "photos" || workflow.mode === "custom"
              ? "video"
              : (workflow.mode as WebsiteProductionMode),
          durationSeconds: workflow.requestedDurationSeconds ?? "auto",
          aspectRatio: workflow.aspectRatio,
          outputQuality: workflow.outputQuality,
          audioMode: workflow.audioMode,
          narrationLanguage: workflow.narrationLanguage,
        };
      }
    } else {
      setManualRenderAfterPlan(false);
      setMode(saved.mode);
      if (saved.storyboard?.targetDurationSeconds)
        setDurationSeconds(saved.storyboard.targetDurationSeconds);
      if (saved.storyboard?.aspectRatio)
        setAspectRatio(saved.storyboard.aspectRatio);
      if (saved.storyboard?.outputQuality)
        setOutputQuality(saved.storyboard.outputQuality);
      if (saved.storyboard?.frameRate) setFrameRate(saved.storyboard.frameRate);
      if (saved.storyboard?.creativeBrief !== undefined)
        setCreativeBrief(saved.storyboard.creativeBrief ?? null);
      if (saved.storyboard?.selectedCaptureIds)
        setSelectedCaptureIds(saved.storyboard.selectedCaptureIds);
    }
    if (saved.captureMetadata) {
      const allIds = autoSelectCaptureIds(saved.captureMetadata, 30);
      selectionKeyRef.current = `${saved.id}:${allIds.join("|")}`;
      if (
        !workflow?.selectedCaptureIds.length &&
        !saved.storyboard?.selectedCaptureIds?.length
      )
        setSelectedCaptureIds(allIds);
    }
    return workflow;
  }

  // Save immediately in the browser and shortly afterward on the job itself.
  // The browser copy covers abrupt refresh/sign-out; the server copy makes the
  // same unfinished step available on another device.
  useEffect(() => {
    if (!jobId || stage === "awaiting_url" || !workflowReadyRef.current) return;
    const workflowState: JobWorkflowState = {
      savedAt: Date.now(),
      stage,
      mode,
      durationSeconds,
      featuresText,
      creativeBrief,
      aspectRatio,
      outputQuality,
      frameRate,
      selectedCaptureIds,
      audioMode,
      narrationLanguage,
      websiteAutoFlow: Boolean(websiteRequestRef.current),
      manualRenderAfterPlan,
      requestedDurationSeconds: websiteRequestRef.current?.durationSeconds,
    };
    saveLocalJobWorkflow(jobId, workflowState);
    const timer = window.setTimeout(
      () => void saveJobWorkflow(jobId, workflowState).catch(() => {}),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [
    jobId,
    stage,
    mode,
    durationSeconds,
    featuresText,
    creativeBrief,
    manualRenderAfterPlan,
    aspectRatio,
    outputQuality,
    frameRate,
    selectedCaptureIds,
    audioMode,
    narrationLanguage,
  ]);

  useEffect(() => {
    const metadata = activeCaptureMetadata ?? job?.captureMetadata;
    if (!jobId || !metadata) return;
    const ids = autoSelectCaptureIds(metadata, 30);
    const key = `${jobId}:${ids.join("|")}`;
    if (selectionKeyRef.current === key) return;
    selectionKeyRef.current = key;
    setSelectedCaptureIds(ids);
  }, [jobId, job?.captureMetadata, activeCaptureMetadata]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
  }, [messages, stage]);

  // When a generation actually starts, move the outer page and the chat to the
  // live production canvas automatically. This makes the click on Generate feel
  // connected to the visible work instead of leaving the visitor up at the form.
  useEffect(() => {
    const justStarted = pollingActive && !previousPollingActiveRef.current;
    previousPollingActiveRef.current = pollingActive;
    if (!justStarted) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = generationProcessRef.current;
        if (!target) return;
        target.scrollIntoView({ behavior, block: "start" });
        // Keep the sticky site navigation from covering the live-stage heading.
        window.requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          if (rect.top < 88) window.scrollBy({ top: rect.top - 88, behavior });
        });
      });
    });
  }, [pollingActive]);

  function persist(
    role: "user" | "assistant",
    content: ReactNode,
    kind = "text",
  ) {
    const activeJobId = jobIdRef.current;
    if (!activeJobId || typeof content !== "string") return;
    void saveJobMessage(activeJobId, role, content, kind).catch(() => {});
  }
  function pushBot(content: ReactNode, kind = "text") {
    setMessages((p) => [...p, { id: nextId(), role: "bot", content }]);
    persist("assistant", content, kind);
  }
  function pushUser(content: ReactNode, kind = "text") {
    setMessages((p) => [...p, { id: nextId(), role: "user", content }]);
    persist("user", content, kind);
  }

  // Capture stage: watch for capture_metadata
  const capturedRef = useRef(false);
  const storyboardedRef = useRef(false);
  useEffect(() => {
    if (!initialJobId) return;
    let cancelled = false;
    void fetchJob(initialJobId)
      .then((saved) => {
        if (cancelled || !saved.captureMetadata) return;
        selectJobId(saved.id);
        setActiveCaptureMetadata(saved.captureMetadata);
        setMode(initialMode ?? saved.mode);
        capturedRef.current = true;
        const transcript: Message[] = (
          Array.isArray(saved.messages) ? saved.messages : []
        )
          .filter((message) => !HIDDEN_RESTORED_MESSAGE_KINDS.has(message.kind))
          .map((message) => ({
            id: message.id,
            role: message.role === "user" ? "user" : "bot",
            content: restoredMessageContent(message, () => setShowAuthModal(true), resultSourceKind(saved)),
          }));
        const reopenedMessages: Message[] = [
          ...transcript,
          {
            id: nextId(),
            role: "bot",
            content: (
              <SiteCard
                sourceUrl={saved.sourceUrl}
                metadata={saved.captureMetadata}
              />
            ),
          },
        ];
        if (initialMode) {
          const label =
            MODE_OPTIONS.find((option) => option.mode === initialMode)?.label ??
            "Continue creating";
          reopenedMessages.push({ id: nextId(), role: "user", content: label });
          if (initialMode === "photos") {
            reopenedMessages.push({
              id: nextId(),
              role: "bot",
              content:
                "Your project references are ready. Choose the format for the new photo set.",
            });
            setStage("awaiting_format");
          } else if (initialMode === "icon") {
            setAspectRatio("1:1");
            setOutputQuality("1080p");
            setFrameRate(24);
            reopenedMessages.push({
              id: nextId(),
              role: "bot",
              content:
                "Your captured brand and website icon are ready. Add an optional icon direction, or let the AI choose the strongest four concepts.",
            });
            setStage("awaiting_brief");
          } else {
            reopenedMessages.push({
              id: nextId(),
              role: "bot",
              content:
                "Your saved website capture is ready—no rescan needed. How long should this production be?",
            });
            setStage("awaiting_duration");
          }
        } else {
          reopenedMessages.push({
            id: nextId(),
            role: "bot",
            content:
              "Saved capture loaded. What would you like to create from it?",
          });
          setStage("awaiting_mode");
        }
        workflowReadyRef.current = true;
        setMessages(reopenedMessages);
        setRestoring(false);
        onJobCreated?.(saved.id);
      })
      .catch(() => {
        workflowReadyRef.current = true;
        setRestoring(false);
        pushBot(
          "We could not reopen that saved project. Please choose another chat or start a new one.",
        );
        setStage("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [initialJobId, initialMode]);

  // Resume stage: reopen an existing job (any status — still in progress,
  // already completed, or failed) exactly where it left off, instead of
  // routing back through mode/duration/format selection like initialJobId
  // does. This is what lets a user switch to another chat mid-generation and
  // come back to find the live progress (or finished result) still there,
  // rather than landing on a different summary-style view.
  useEffect(() => {
    if (!resumeJobId) return;
    let cancelled = false;
    void fetchJob(resumeJobId)
      .then((saved) => {
        if (cancelled) return;
        selectJobId(saved.id);
        setActiveCaptureMetadata(saved.captureMetadata);
        const workflow = restoreWorkflow(saved);
        const resumedStage = resolveResumeStage(saved, workflow);

        const transcript: Message[] = (
          Array.isArray(saved.messages) ? saved.messages : []
        )
          .filter((message) => !HIDDEN_RESTORED_MESSAGE_KINDS.has(message.kind))
          .map((message) => ({
            id: message.id,
            role: message.role === "user" ? "user" : "bot",
            content: restoredMessageContent(message, () => setShowAuthModal(true), resultSourceKind(saved)),
          }));
        const rebuilt: Message[] = [...transcript];
        if (saved.captureMetadata) {
          rebuilt.push({
            id: nextId(),
            role: "bot",
            content: (
              <SiteCard
                sourceUrl={saved.sourceUrl}
                metadata={saved.captureMetadata}
              />
            ),
          });
        }
        if (saved.storyboard) {
          rebuilt.push({
            id: nextId(),
            role: "bot",
            content: storyboardSummaryMessage(
              saved,
              saved.mode,
              saved.storyboard.aspectRatio ?? "16:9",
              saved.storyboard.frameRate ?? 24,
            ),
          });
        }

        // Mark the effects that would otherwise fire on a live transition as
        // already-handled for whichever milestones this job already passed,
        // so resuming doesn't replay bubbles the saved transcript already has.
        // A live resume must not mark the milestone as already handled when
        // the UI deliberately re-enters that stage to continue the automatic
        // website pipeline. Otherwise the guard below prevents the next step
        // from ever firing even though the server already says capture/plan is ready.
        capturedRef.current = Boolean(saved.captureMetadata) && resumedStage !== "capturing";
        storyboardedRef.current = Boolean(saved.storyboard) && resumedStage !== "storyboarding";

        if (resumedStage === "done") {
          renderedRef.current = true;
          const restoredResult = saved.messages.some(
            (message) =>
              message.kind === "result" &&
              Array.isArray(message.payload?.resultAssets) &&
              message.payload.resultAssets.length > 0,
          );
          if (!restoredResult) {
            rebuilt.push({
              id: nextId(),
              role: "bot",
              content: doneResultMessage(saved, () => setShowAuthModal(true)),
            });
          }
          setMessages(rebuilt);
          setStage("done");
        } else if (resumedStage === "failed") {
          renderedRef.current = true;
          rebuilt.push({
            id: nextId(),
            role: "bot",
            content:
              saved.status === "cancelled"
                ? "Stopped — all reserved credits for this render were restored."
                : saved.errorMessage ||
                  "The render didn't finish. Try again or start over with a different URL.",
          });
          setMessages(rebuilt);
          setStage("failed");
        } else {
          setMessages(rebuilt);
          setStage(resumedStage);
        }
        workflowReadyRef.current = true;
        setRestoring(false);
        onJobCreated?.(saved.id);
      })
      .catch(() => {
        workflowReadyRef.current = true;
        setRestoring(false);
        pushBot(
          "We could not reopen that chat. Please choose another chat or start a new one.",
        );
        setStage("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [resumeJobId]);
  useEffect(() => {
    if (stage !== "capturing" || !job || job.id !== jobId || !job.captureMetadata) return;
    // During the crawl the API streams partial capture metadata. Keep it live
    // in the generation canvas so each screenshot appears immediately, but do
    // not advance the workflow until the backend explicitly marks it captured.
    setActiveCaptureMetadata(job.captureMetadata);
  }, [job, jobId, stage]);

  useEffect(() => {
    if (
      stage !== "capturing" ||
      !job ||
      job.id !== jobId ||
      capturedRef.current
    )
      return;

    if (job.status === "cancelled") {
      capturedRef.current = true;
      pushBot("Stopped — no credits were spent on this capture.");
      setCancelling(false);
      setStage("failed");
      return;
    }

    if (job.status === "failed") {
      capturedRef.current = true;
      pushBot(
        job.errorMessage ||
          "We couldn't load that site. Check the URL and try again.",
      );
      setStage("failed");
      return;
    }

    // Another tab or a fast previous transition may already have advanced the
    // same job. Follow the server's authoritative stage instead of leaving
    // this tab visually parked on Brand read.
    if (job.status === "rendering") {
      capturedRef.current = true;
      storyboardedRef.current = true;
      setStage("rendering");
      return;
    }
    if (job.status === "storyboarding") {
      capturedRef.current = true;
      setStage("storyboarding");
      return;
    }

    const metadata = job.captureMetadata;
    if (!metadata) return;

    // The API now exposes the real `captured` database status. Keep the
    // message/progress checks as backwards-compatible fallbacks for a server
    // that is being rolling-deployed while an older browser tab is still open.
    const captureIsReady =
      job.status === "captured" ||
      (job.progress >= 40 &&
        /website capture complete|website read complete|capture complete|distinct page.*selected/i.test(
          job.statusMessage ?? "",
        ));

    if (!captureIsReady) return;

    // Lock this transition before starting async work so polling cannot launch
    // the storyboard twice on the next 1.8s tick.
    capturedRef.current = true;
    setActiveCaptureMetadata(metadata);
    pushBot(<SiteCard sourceUrl={job.sourceUrl} metadata={metadata} />);

    if (job.sourceUrl.startsWith("upload://")) {
      pushBot("What do you want to generate?");
      setStage("awaiting_mode");
      return;
    }

    if (isPublicCreatorPath() && !isSignedIn) {
      const request = websiteRequestRef.current;
      const ids = autoSelectCaptureIds(metadata, 8);
      setSelectedCaptureIds(ids);
      setManualRenderAfterPlan(true);
      const previewWorkflow: JobWorkflowState = {
        savedAt: Date.now(), stage: "preview_ready", mode: request?.mode ?? "video",
        durationSeconds: request?.durationSeconds === "auto" || request?.durationSeconds === undefined ? Math.max(8, Math.min(32, Math.max(1, metadata.pageCount || ids.length) * 8)) : request.durationSeconds,
        featuresText: null, creativeBrief: request?.brief ?? creativeBrief ?? "",
        aspectRatio: request?.aspectRatio ?? aspectRatio, outputQuality: request?.outputQuality ?? outputQuality, frameRate: 24,
        selectedCaptureIds: ids, audioMode: request?.audioMode ?? audioMode, narrationLanguage: request?.narrationLanguage ?? narrationLanguage,
        websiteAutoFlow: true, manualRenderAfterPlan: true, requestedDurationSeconds: request?.durationSeconds ?? "auto",
      };
      saveLocalJobWorkflow(job.id, previewWorkflow);
      void saveJobWorkflow(job.id, previewWorkflow).catch(() => {});
      pushBot("That is your real website. I’ve saved the strongest pages and tab icon. Continue when you’re ready — account creation comes next, before AI direction or paid generation.");
      setStage("preview_ready");
      return;
    }

    const pendingReferences = pendingWebsiteAttachmentsRef.current;
    if (pendingReferences.length > 0) {
      if (!isSignedIn) {
        pushBot(
          "Your references are ready. Sign in once to add them after sign-in, then I’ll continue this same production.",
        );
        pendingActionRef.current = () =>
          performWebsiteAttachmentUpload(job.id, pendingReferences);
        setShowAuthModal(true);
        setStage("awaiting_private_pages");
      } else {
        void performWebsiteAttachmentUpload(job.id, pendingReferences);
      }
      return;
    }

    if (!isSignedIn) {
      pushBot("Your capture is ready. Sign in once to save it to your account and continue into the production plan.");
      pendingActionRef.current = async () => {
        await claimJob(job.id);
        await startWebsiteStoryboard(job.id, metadata);
      };
      setShowAuthModal(true);
      setStage("preview_ready");
      return;
    }

    // Optional private/reference images are already available in the composer;
    // once ownership is established we continue straight into direction.
    void startWebsiteStoryboard(job.id, metadata);
  }, [job, jobId, stage, isSignedIn]);

  // Storyboard stage
  useEffect(() => {
    if (
      stage !== "storyboarding" ||
      !job ||
      job.id !== jobId ||
      storyboardedRef.current
    )
      return;
    if (job.status === "cancelled") {
      storyboardedRef.current = true;
      pushBot("Stopped — no credits were spent on planning.");
      setCancelling(false);
      setStage("failed");
      return;
    }
    if (job.status === "failed") {
      storyboardedRef.current = true;
      pushBot(
        job.errorMessage ||
          "We couldn't prepare the edit plan this time. Your capture is safe — try the direction again.",
      );
      setStage("awaiting_brief");
      return;
    }
    if (job.status === "rendering") {
      storyboardedRef.current = true;
      setStage("rendering");
      return;
    }
    if (job.status === "done") {
      storyboardedRef.current = true;
      setStage("rendering");
      return;
    }
    if (job.storyboard) {
      storyboardedRef.current = true;
      const usedSceneIds = Array.from(new Set((job.storyboard.sceneCaptureIds ?? []).flat().filter(Boolean)));
      if (usedSceneIds.length) setSelectedCaptureIds(usedSceneIds);
      pushBot(storyboardSummaryMessage(job, mode, aspectRatio, frameRate));
      if (!isSignedIn) {
        pushBot("Your production plan is ready. Sign in to continue automatically into final generation, or unlock when you’re ready.");
        showLockedTeaser();
        setStage("ready_to_render");
        return;
      }
      if (manualRenderAfterPlan) {
        autoRenderRef.current = false;
        pushBot("Your saved setup and direction are ready. Review them once, then click Generate when you want to spend credits and start the final video.");
        setStage("ready_to_render");
        return;
      }
      if (!autoRenderRef.current) {
        autoRenderRef.current = true;
        pushBot("Storyboard locked. Starting final generation automatically in this same chat.");
        void handleGenerate();
        return;
      }
      setStage("rendering");
    }
  }, [job, stage, isSignedIn, mode, aspectRatio, frameRate, manualRenderAfterPlan]);

  // Render stage
  const renderedRef = useRef(false);
  useEffect(() => {
    if (
      stage !== "rendering" ||
      !job ||
      job.id !== jobId ||
      renderedRef.current
    )
      return;
    if (job.status === "done") {
      renderedRef.current = true;
      void fetchMe().then((account) => setCreditBalance(account.creditsBalance)).catch(() => {});
      pushBot(doneResultMessage(job, () => setShowAuthModal(true)));
      setStage("done");
    } else if (job.status === "cancelled") {
      renderedRef.current = true;
      void fetchMe().then((account) => setCreditBalance(account.creditsBalance)).catch(() => {});
      pushBot("Stopped — all reserved credits for this render were restored.");
      setCancelling(false);
      setStage("failed");
    } else if (job.status === "failed") {
      renderedRef.current = true;
      void fetchMe().then((account) => setCreditBalance(account.creditsBalance)).catch(() => {});
      pushBot(
        job.errorMessage ||
          "The render didn't finish. Try again or start over with a different URL.",
      );
      // Never let a retry reuse the same job/storyboard that just failed —
      // the backend now refuses that anyway (RENDER_ALREADY_FAILED), and
      // reusing it would replay the exact same edit plan on the next click.
      // Automatically prepare a brand-new job + a brand-new storyboard from
      // the same saved screenshots and the same creative choices, so the
      // next "Generate" click is guaranteed to be a fresh attempt.
      void prepareFreshVersionAfterFailure(job.id);
    }
  }, [job, stage]);

  useEffect(() => {
    if (pollError && !pollNoticeRef.current) {
      pollNoticeRef.current = true;
      pushBot(
        "The connection paused briefly. Your project is safe and we are reconnecting automatically.",
      );
    }
    if (!pollError) pollNoticeRef.current = false;
  }, [pollError]);

  async function redirectSignedInWebsiteSetupToWorkspace(
    url: string,
    brief: string,
    settings: WebsiteGenerationSettings,
    referenceFiles: File[],
  ) {
    let attachmentDraftKey: string | undefined;
    if (referenceFiles.length) {
      attachmentDraftKey = `public-website-${Date.now()}`;
      await savePhotoDraft(attachmentDraftKey, buildDraftItems(referenceFiles));
    }
    savePublicCreatorHandoff({
      kind: "website", url, brief, settings: { ...settings }, attachmentDraftKey,
    });
    window.location.assign('/dashboard?create=website&handoff=1');
  }

  async function performLandingWebsitePreview(
    url: string,
    brief: string,
    settings: WebsiteGenerationSettings,
    referenceFiles: File[],
  ) {
    clearPublicCreatorHandoff();
    // Free public marketing preview: read the real site first, show its favicon
    // and useful screenshots, then stop before AI direction/rendering.
    setManualRenderAfterPlan(true);
    websiteRequestRef.current = {
      brief, mode: settings.mode, durationSeconds: settings.durationSeconds,
      aspectRatio: settings.aspectRatio, outputQuality: settings.outputQuality,
      audioMode: settings.audioMode, narrationLanguage: settings.narrationLanguage,
    };
    setMode(settings.mode);
    setCreativeBrief(brief);
    setAspectRatio(settings.aspectRatio);
    setOutputQuality(settings.outputQuality);
    setAudioMode(settings.audioMode);
    setNarrationLanguage(settings.narrationLanguage);
    if (settings.durationSeconds !== "auto") setDurationSeconds(settings.durationSeconds);
    pendingWebsiteAttachmentsRef.current = referenceFiles;
    await handleUrlSubmit(url, brief);
  }

  async function finalizeLandingPreviewToWorkspace() {
    const activeJobId = jobIdRef.current;
    if (!activeJobId) {
      pushBot("The website preview is not ready yet. Wait for the screenshots to finish, then continue.");
      return;
    }
    setBusy(true);
    try {
      await claimJob(activeJobId);

      // Restore any references the guest attached before account creation.
      const draftKey = `landing-preview-refs-${activeJobId}`;
      const savedRefs = await loadPhotoDraft(draftKey).catch(() => []);
      const files = savedRefs.map((item) => item.file).filter((file): file is File => file instanceof File);
      if (files.length) {
        await uploadPrivatePages(activeJobId, files);
        await clearPhotoDraft(draftKey).catch(() => {});
      }

      const request = websiteRequestRef.current;
      if (!request) throw new Error("Your saved website setup could not be restored. Please reopen the preview and try again.");
      const metadata = (await fetchJob(activeJobId)).captureMetadata;
      const ids = autoSelectCaptureIds(metadata, Math.min(8, Math.max(3, Math.ceil((request.durationSeconds === "auto" ? 32 : request.durationSeconds) / 8) * 2)));
      const seconds = request.durationSeconds === "auto"
        ? Math.max(8, Math.min(32, Math.max(1, metadata?.pageCount || ids.length) * 8))
        : request.durationSeconds;
      const workflow: JobWorkflowState = {
        savedAt: Date.now(), stage: "capturing", mode: request.mode,
        durationSeconds: seconds, featuresText: null, creativeBrief: request.brief,
        aspectRatio: request.aspectRatio, outputQuality: request.outputQuality, frameRate: 24,
        selectedCaptureIds: ids, audioMode: request.audioMode, narrationLanguage: request.narrationLanguage,
        websiteAutoFlow: true, manualRenderAfterPlan: true, requestedDurationSeconds: request.durationSeconds,
      };
      saveLocalJobWorkflow(activeJobId, workflow);
      await saveJobWorkflow(activeJobId, workflow);
      setActiveJobId(activeJobId);
      window.location.assign(`/dashboard?job=${encodeURIComponent(activeJobId)}&from=preview`);
    } catch (error) {
      pushBot(errorMessage(error));
      setBusy(false);
    }
  }

  function continueLandingPreview() {
    if (!isSignedIn) {
      pendingActionRef.current = finalizeLandingPreviewToWorkspace;
      setShowAuthModal(true);
      return;
    }
    void finalizeLandingPreviewToWorkspace();
  }

  function handlePublicIntentRequest(intent: CreationIntent) {
    if (!isPublicCreatorPath() || intent === "website") return true;
    const destination = `/dashboard?create=${encodeURIComponent(intent)}`;
    if (isSignedIn) {
      window.location.assign(destination);
      return false;
    }
    pendingActionRef.current = () => { window.location.assign(destination); };
    setShowAuthModal(true);
    return false;
  }

  async function redirectStudioSubmitToWorkspace(request: StudioGenerationRequest) {
    let attachmentDraftKey: string | undefined;
    if (request.files.length) {
      attachmentDraftKey = `public-studio-${Date.now()}`;
      await savePhotoDraft(attachmentDraftKey, buildDraftItems(request.files));
    }
    savePublicCreatorHandoff({
      kind: "studio",
      request: {
        studioKind: request.studioKind,
        prompt: request.prompt,
        mode: request.mode,
        durationSeconds: request.durationSeconds,
        aspectRatio: request.aspectRatio,
        outputQuality: request.outputQuality,
        audioMode: request.audioMode,
      },
      attachmentDraftKey,
    });
    const mappedCreate = request.studioKind === "idea" ? "video" : request.studioKind === "scenario" ? "scenario" : request.mode === "photos" ? "photo" : "product-video";
    window.location.assign(`/dashboard?create=${encodeURIComponent(mappedCreate)}&handoff=1`);
  }

  async function performWebsiteSubmit(
    url: string,
    brief: string,
    settings: WebsiteGenerationSettings,
    referenceFiles: File[],
  ) {
    websiteRequestRef.current = {
      brief,
      mode: settings.mode,
      durationSeconds: settings.durationSeconds,
      aspectRatio: settings.aspectRatio,
      outputQuality: settings.outputQuality,
      audioMode: settings.audioMode,
      narrationLanguage: settings.narrationLanguage,
    };
    setMode(settings.mode);
    setCreativeBrief(brief || null);
    setAspectRatio(settings.aspectRatio);
    setOutputQuality(settings.outputQuality);
    setFrameRate(24);
    setAudioMode(settings.audioMode);
    setNarrationLanguage(settings.narrationLanguage);
    if (settings.durationSeconds !== "auto")
      setDurationSeconds(settings.durationSeconds);
    pendingWebsiteAttachmentsRef.current = referenceFiles;
    await handleUrlSubmit(url, brief);
  }

  function handleWebsiteSubmit(
    url: string,
    brief: string,
    settings: WebsiteGenerationSettings,
    referenceFiles: File[],
  ) {
    if (isPublicCreatorPath()) {
      if (isSignedIn) {
        void redirectSignedInWebsiteSetupToWorkspace(url, brief, settings, referenceFiles);
        return;
      }
      // The landing page deliberately proves the product before asking for an
      // account: capture the website now, then stop at preview_ready.
      void performLandingWebsitePreview(url, brief, settings, referenceFiles);
      return;
    }
    if (!isSignedIn) {
      pendingActionRef.current = () => performWebsiteSubmit(url, brief, settings, referenceFiles);
      setShowAuthModal(true);
      return;
    }
    void performWebsiteSubmit(url, brief, settings, referenceFiles);
  }

  async function handleUrlSubmit(url: string, brief: string) {
    let normalized: string;
    try {
      normalized = normalizeWebsiteUrl(url);
    } catch (error) {
      pushBot(
        error instanceof Error ? error.message : "Enter a valid website name.",
      );
      return;
    }
    pushUser(
      brief ? `${normalized}\nPromotion direction: ${brief}` : normalized,
    );
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
    setBusy(true);
    capturedRef.current = false;
    setStage("capturing");
    try {
      const pendingRequest = websiteRequestRef.current;
      const setupSummary = pendingRequest
        ? `Setup: ${MODE_OPTIONS.find((option) => option.mode === pendingRequest.mode)?.label ?? "Website video"} · ${pendingRequest.durationSeconds === "auto" ? "Auto duration" : `${pendingRequest.durationSeconds}s`} · ${pendingRequest.aspectRatio} · ${pendingRequest.outputQuality} · ${pendingRequest.audioMode === "voice_music" ? `Narration ${pendingRequest.narrationLanguage.toUpperCase()}` : pendingRequest.audioMode.replace(/_/g, " ")}`
        : undefined;
      const res = await startCapture(normalized, brief, setupSummary);
      selectJobId(res.jobId);
      if (isPublicCreatorPath() && !isSignedIn && pendingWebsiteAttachmentsRef.current.length) {
        await savePhotoDraft(`landing-preview-refs-${res.jobId}`, buildDraftItems(pendingWebsiteAttachmentsRef.current)).catch(() => {});
      }

      // Persist the automatic website workflow immediately, before a route
      // change or remount can clear the in-memory ref. This closes the race
      // where capture completed successfully but the UI stayed on Brand read.
      if (pendingRequest) {
        const initialDuration = pendingRequest.durationSeconds === "auto" ? 8 : pendingRequest.durationSeconds;
        const initialWorkflow: JobWorkflowState = {
          savedAt: Date.now(),
          stage: "capturing",
          mode: pendingRequest.mode,
          durationSeconds: initialDuration,
          featuresText: null,
          creativeBrief: pendingRequest.brief || null,
          aspectRatio: pendingRequest.aspectRatio,
          outputQuality: pendingRequest.outputQuality,
          frameRate: 24,
          selectedCaptureIds: [],
          audioMode: pendingRequest.audioMode,
          narrationLanguage: pendingRequest.narrationLanguage,
          websiteAutoFlow: true,
          manualRenderAfterPlan,
          requestedDurationSeconds: pendingRequest.durationSeconds,
        };
        saveLocalJobWorkflow(res.jobId, initialWorkflow);
        await saveJobWorkflow(res.jobId, initialWorkflow).catch(() => ({ saved: true as const, updatedAt: "" }));
      }

      onJobCreated?.(res.jobId);
      let hostname = normalized;
      try {
        hostname = new URL(normalized).hostname;
      } catch {}
      pushBot(
        isPublicCreatorPath() && !isSignedIn
          ? `I’m opening ${hostname} now. You’ll see the real favicon and the strongest distinct pages before I ask you to create an account.`
          : `I’m opening ${hostname} now. I’ll keep only the strongest distinct pages, learn the visual identity and prepare the promotion automatically.`,
      );
      if (isSignedIn && (window.location.pathname === "/" || window.location.pathname.startsWith("/studio"))) {
        window.location.assign(`/dashboard?job=${encodeURIComponent(res.jobId)}`);
        return;
      }
    } catch (err) {
      pushBot(errorMessage(err));
      setStage("awaiting_url");
    } finally {
      setBusy(false);
    }
  }

  async function ensureCreditsBeforePaidPlanning(
    activeJobId: string,
    plannedMode: JobMode,
    plannedDuration: number,
    plannedQuality: "1080p" | "4k",
    plannedAudioMode: AudioMode,
  ) {
    try {
      const quote = await requestGenerationPreflight(
        activeJobId,
        plannedMode,
        plannedDuration,
        plannedQuality,
        plannedAudioMode,
      );
      setCreditBalance(quote.balance);
      if (!quote.affordable) {
        const needed = quote.shortfall;
        setPaywallContext(
          `Add ${needed} more credit${needed === 1 ? "" : "s"} before AI production starts`,
        );
        setShowPaywall(true);
        pushBot(
          `Your source and references are saved. This production needs ${quote.totalCredits} credits and you have ${quote.balance}. Add ${needed} more before AI planning or any paid generation API starts. Nothing paid has started yet.`,
        );
        return false;
      }
      return true;
    } catch (error) {
      pushBot(errorMessage(error));
      return false;
    }
  }

  async function startWebsiteStoryboard(
    activeJobId: string,
    metadata: CaptureMetadata | null,
  ) {
    if (!metadata || !activeJobId) return;

    // Prefer the exact request from the composer. If the component remounted
    // while Chromium was capturing, rebuild the request from restored workflow
    // state instead of leaving the job stranded at Brand read.
    const fallbackMode: WebsiteProductionMode =
      mode === "tutorial" || mode === "buy" || mode === "tour" || mode === "linkedin" || mode === "demo"
        ? mode
        : "video";
    const request = websiteRequestRef.current ?? {
      brief: creativeBrief ?? "",
      mode: fallbackMode,
      durationSeconds,
      aspectRatio,
      outputQuality,
      audioMode,
      narrationLanguage,
    };
    websiteRequestRef.current = request;
    const usefulPageCount = Math.max(1, Math.min(4, metadata.pageCount || captureMediaItems(metadata).length || 1));
    const smartDuration = request.durationSeconds === "auto" ? usefulPageCount * 8 : request.durationSeconds;
    const sceneCount = Math.max(1, Math.ceil(smartDuration / 8));
    // Compact diversity-ranked pool: enough alternatives for the director to
    // choose the strongest scene references, without flooding it with every page.
    const captureIds = autoSelectCaptureIds(metadata, Math.min(8, Math.max(3, sceneCount * 2)));
    const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
      activeJobId,
      request.mode,
      smartDuration,
      request.outputQuality,
      request.audioMode,
    );
    if (!canStartPaidPlanning) {
      setStage("preview_ready");
      return;
    }
    setMode(request.mode);
    setDurationSeconds(smartDuration);
    setCreativeBrief(request.brief || null);
    setAspectRatio(request.aspectRatio);
    setOutputQuality(request.outputQuality);
    setFrameRate(24);
    setSelectedCaptureIds(captureIds);
    setAudioMode(request.audioMode);
    setNarrationLanguage(request.narrationLanguage);
    pushBot(`The website capture is ready and visible below. I selected ${usefulPageCount} strong story beat${usefulPageCount === 1 ? "" : "s"} and a ${durationLabel(smartDuration)} production. Now I’m directing the hook, scene order, motion and ending.`);
    storyboardedRef.current = false;
    setStage("storyboarding");
    try {
      const storyboardResponse = await requestStoryboard(activeJobId, request.mode, MODE_DEFAULT_VIBES[request.mode], smartDuration, undefined, {
        creativeBrief: request.brief || undefined,
        aspectRatio: request.aspectRatio,
        outputQuality: request.outputQuality,
        audioMode: request.audioMode,
        frameRate: 24,
        selectedCaptureIds: captureIds,
      });
      if (storyboardResponse.creditsRemaining !== undefined) setCreditBalance(storyboardResponse.creditsRemaining);
    } catch (error) {
      storyboardedRef.current = false;
      pushBot(errorMessage(error));
      setStage("failed");
    }
  }

  async function performWebsiteAttachmentUpload(activeJobId: string, files: File[]) {
    if (!activeJobId || !files.length) return false;
    setBusy(true);
    try {
      await claimJob(activeJobId).catch(() => ({ claimed: false }));
      const result = await uploadPrivatePages(activeJobId, files);
      const refreshed = await fetchJob(activeJobId).catch(() => null);
      const metadata = refreshed?.captureMetadata ?? activeCaptureMetadata ?? null;
      if (metadata) setActiveCaptureMetadata(metadata);
      pendingWebsiteAttachmentsRef.current = [];
      pushUser(`Added ${result.added} reference image${result.added === 1 ? "" : "s"}`);
      pushBot("Reference images added securely. I’m folding them into the same website production now.");
      if (metadata) {
        await startWebsiteStoryboard(activeJobId, metadata);
        if (redirectAfterAuthRef.current) {
          redirectAfterAuthRef.current = false;
          window.location.assign(`/dashboard?job=${encodeURIComponent(activeJobId)}`);
        }
      } else {
        setStage("awaiting_private_pages");
      }
      return true;
    } catch (error) {
      pushBot(errorMessage(error));
      setStage("awaiting_private_pages");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function continueAfterPrivatePages() {
    pushUser("Continue with captured pages");
    if (websiteRequestRef.current && (activeCaptureMetadata ?? job?.captureMetadata)) {
      pushBot("Great. I’m directing the production from the captured pages now. The same chat will show the plan, progress and final result.");
      void startWebsiteStoryboard(
        jobId ?? "",
        activeCaptureMetadata ?? job?.captureMetadata ?? null,
      );
      return;
    }
    pushBot("Great. What do you want to generate? You can still add your own creative prompt and photos during the next steps.");
    setStage("awaiting_mode");
  }

  async function performPrivatePageUpload(files: File[]) {
    if (!jobId) return false;
    setBusy(true);
    try {
      await claimJob(jobId).catch(() => ({ claimed: false }));
      const result = await uploadPrivatePages(jobId, files);
      const refreshed = await fetchJob(jobId).catch(() => null);
      if (refreshed?.captureMetadata)
        setActiveCaptureMetadata(refreshed.captureMetadata);
      pushUser(
        `Added ${result.added} private-page screenshot${result.added === 1 ? "" : "s"}`,
      );
      pushBot(
        "Private pages added to this project. What do you want to generate?",
      );
      setStage("awaiting_mode");
      if (redirectAfterAuthRef.current) {
        redirectAfterAuthRef.current = false;
        window.location.assign(`/dashboard?job=${encodeURIComponent(jobId)}`);
      }
      return true;
    } catch (err) {
      pushBot(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handlePrivatePageUpload(files: File[]) {
    if (!jobId) return false;
    if (!isSignedIn) {
      // Resume the authenticated operation directly. React's auth-state update
      // can land one render after AuthModal's callback, so re-entering this
      // guard from that callback could otherwise reopen the modal.
      const pendingJobId = jobId;
      pendingActionRef.current = () =>
        performPrivatePageUpload(files).then((succeeded) => {
          if (succeeded)
            void clearPhotoDraft(`private-pages-${pendingJobId}`).catch(
              () => {},
            );
          return succeeded;
        });
      setShowAuthModal(true);
      return false;
    }
    return performPrivatePageUpload(files);
  }

  async function handlePhotoUploadSubmit(files: File[]) {
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
    pushUser(
      `Uploaded ${files.length} photo${files.length === 1 ? "" : "s"}`,
    );
    setBusy(true);
    capturedRef.current = false;
    setStage("capturing");
    try {
      const res = await uploadPhotos(files);
      selectJobId(res.jobId);
      onJobCreated?.(res.jobId);
      pushBot("Saving your photos…");
      return true;
    } catch (err) {
      pushBot(errorMessage(err));
      setStage("awaiting_url");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function performStudioSubmit(request: StudioGenerationRequest) {
    setBusy(true);
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
    setMode(request.mode);
    setDurationSeconds(request.durationSeconds);
    setAspectRatio(request.aspectRatio);
    setOutputQuality(request.outputQuality);
    setAudioMode(request.audioMode);
    setCreativeBrief(request.prompt || null);
    capturedRef.current = true;
    storyboardedRef.current = false;
    renderedRef.current = false;
    pushUser(
      request.studioKind === "product"
        ? request.mode === "photos"
          ? `Create a product photo campaign${request.prompt ? ` · ${request.prompt}` : ""}`
          : `Create a product video${request.prompt ? ` · ${request.prompt}` : ""}`
        : request.prompt,
    );
    pushBot(
      request.mode === "photos"
        ? "I’m reviewing your references and art-directing a complete AI photo campaign. The next updates will appear right here."
        : request.studioKind === "product"
          ? "I’m grounding the film in your product references, then building one continuous film plan, pacing and audio here in the same conversation."
          : "I’m turning your idea into one continuous film plan with pacing and sound. I’ll show the work as it happens in this chat.",
    );
    try {
      const account = await fetchMe();
      setIsSignedIn(true);
      setIsAdmin(account.isAdmin);
      setCreditBalance(account.creditsBalance);
      const required = estimateRenderCredits(
        request.mode,
        request.audioMode !== "voice_music",
        request.durationSeconds,
        request.outputQuality,
      );
      if (account.creditsBalance < required) {
        setPaywallContext(`Add ${required - account.creditsBalance} credits to start this AI production`);
        setShowPaywall(true);
        setStage("awaiting_url");
        return;
      }
      const upload = await uploadStudioMedia({
        files: request.files,
        studioKind: request.studioKind,
        mode: request.mode,
        durationSeconds: request.durationSeconds,
        audioMode: request.audioMode,
        aspectRatio: request.aspectRatio,
        outputQuality: request.outputQuality,
        ideaPrompt: request.prompt || undefined,
      });
      selectJobId(upload.jobId);
      onJobCreated?.(upload.jobId);
      const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
        upload.jobId,
        request.mode,
        request.durationSeconds,
        request.outputQuality,
        request.audioMode,
      );
      if (!canStartPaidPlanning) {
        setStage("awaiting_url");
        return;
      }
      setStage("storyboarding");
      const storyboardResponse = await requestStoryboard(
        upload.jobId,
        request.mode,
        MODE_DEFAULT_VIBES[request.mode],
        request.durationSeconds,
        undefined,
        {
          creativeBrief: request.prompt || undefined,
          aspectRatio: request.aspectRatio,
          outputQuality: request.outputQuality,
          audioMode: request.audioMode,
          frameRate: 24,
        },
      );
      if (storyboardResponse.creditsRemaining !== undefined) setCreditBalance(storyboardResponse.creditsRemaining);
      if (window.location.pathname === "/" || window.location.pathname.startsWith("/studio")) {
        window.location.assign(`/dashboard?job=${encodeURIComponent(upload.jobId)}`);
        return;
      }
      if (redirectAfterAuthRef.current) {
        redirectAfterAuthRef.current = false;
        window.location.assign(`/dashboard?job=${encodeURIComponent(upload.jobId)}`);
      }
    } catch (error) {
      pushBot(errorMessage(error));
      setStage("awaiting_url");
    } finally {
      setBusy(false);
    }
  }

  function handleStudioSubmit(request: StudioGenerationRequest) {
    if (isPublicCreatorPath()) {
      if (!isSignedIn) {
        pendingActionRef.current = () => redirectStudioSubmitToWorkspace(request);
        setShowAuthModal(true);
        return;
      }
      void redirectStudioSubmitToWorkspace(request);
      return;
    }
    if (!isSignedIn) {
      pendingActionRef.current = () => performStudioSubmit(request);
      setShowAuthModal(true);
      return;
    }
    void performStudioSubmit(request);
  }

  function handleModeSelect(label: string) {
    const selected: JobMode =
      MODE_OPTIONS.find((o) => o.label === label)?.mode ?? "video";
    pushUser(label);
    setMode(selected);
    setFeaturesText(null);
    setCreativeBrief(null);
    if (selected === "photos") {
      pushBot("Choose the delivery format.");
      setStage("awaiting_format");
    } else if (selected === "icon") {
      setAspectRatio("1:1");
      setOutputQuality("1080p");
      setFrameRate(24);
      pushBot(
        "I’ll create four square website-icon concepts from the real captured brand, colors, logo and what the site does. Add an optional direction, or let the AI choose the strongest brand-suitable designs.",
      );
      setStage("awaiting_brief");
    } else {
      const mediaCount = captureMediaItems(
        activeCaptureMetadata ?? job?.captureMetadata,
      ).length;
      const recommended = Math.min(144, Math.max(8, mediaCount * 8));
      pushBot(
        mediaCount > 1
          ? `I found ${mediaCount} usable photos/pages. For one complete scene per item, I recommend ${durationLabel(recommended)}. You can use that length, choose a shorter focus selection, or set any custom whole-second duration from 8 to 144 seconds.`
          : "Choose the video length. You can use a preset or set a custom duration from 8 seconds to 2 minutes 24 seconds as one continuous film.",
      );
      setStage("awaiting_duration");
    }
  }

  function handleDurationSelect(seconds: number, label: string) {
    if (selectedCaptureIds.length === 0) {
      pushBot(
        "Choose at least one photo or screenshot before setting the video length.",
      );
      return;
    }
    pushUser(label);
    setDurationSeconds(seconds);
    const dedicatedScenes = seconds / 8;
    if (selectedCaptureIds.length > dedicatedScenes) {
      pushBot(
        `This ${durationLabel(seconds)} continuous film has ${dedicatedScenes} internal timeline beats for ${selectedCaptureIds.length} selected references. The AI will focus on the strongest references; return to media selection if you want different priorities.`,
      );
    } else {
      pushBot(
        `Your ${durationLabel(seconds)} plan will be generated as one continuous video, using ${dedicatedScenes} internal timeline beats only for direction. Choose the delivery format next.`,
      );
    }
    setStage("awaiting_format");
  }

  function askForBrief() {
    if (mode === "photos") {
      pushBot(
        "Describe what you want the marketing photos to become. You can ask for a product ad, new background, luxury studio, lifestyle scene, social-media creative, seasonal campaign, lighting change, or another edit. I’ll use the captured website images as the real brand/product references. If website UI appears in a result, its existing text must stay faithful to the capture.",
      );
    } else if (mode === "icon") {
      pushBot(
        "Describe any icon direction you want—minimal, dimensional, geometric, elegant, bold, or based on a real initial—or let the AI create the best four directions for this website.",
      );
    } else if (mode === "both") {
      pushBot(
        "Describe the campaign direction once. Tell me what the video should emphasize and what you want the marketing photos to look like. The video will be generated by AI from your real captured website states, with visible UI text, products, prices, and branding required to stay faithful to those references; the photos may be creatively edited from the same brand/product references.",
      );
    } else if (mode === "demo") {
      pushBot(
        "Describe the campaign direction if you want to steer it — a feature, product, journey, atmosphere, or cinematic treatment to emphasize. I’ll generate a true AI cinematic brand film grounded in your real logo, products, UI, and captured brand content — or let the studio choose the strongest direction automatically.",
      );
    } else if (mode === "mockup") {
      pushBot(
        "Anything you want emphasized in the reveal — which pages/panels to lead with, a title/brand card to close on, or a specific mood (bold, playful, minimal)? I’ll generate a fast, scroll-stopping flip-through from your real captured pages — or let the studio pick the strongest sequence automatically.",
      );
    } else if (mode === "custom") {
      pushBot(
        "This one is fully your idea — describe exactly the video you want: the story, the mood, what should happen in it. Be as specific as you like. I’ll direct real AI-generated video around your real captures/photos to bring it to life.",
      );
    } else {
      pushBot(
        "Everything important is already set. Add one optional instruction if you want to emphasize a page, product, real user action, feature, pacing, or cinematic style — or let the studio choose the strongest AI-video direction from the saved website states automatically.",
      );
    }
    setStage("awaiting_brief");
  }

  function handleFormatSelect(label: string) {
    const option =
      FORMAT_OPTIONS.find((item) => item.label === label) ?? FORMAT_OPTIONS[0];
    pushUser(label);
    setAspectRatio(option.aspectRatio);
    setOutputQuality(option.outputQuality);
    setFrameRate(option.frameRate);
    if (mode === "tour") {
      pushBot(
        "Feature Tour can detect the strongest features automatically. If there are specific features you must include, type them below.",
      );
      setStage("awaiting_features");
    } else {
      askForBrief();
    }
  }

  function handleFeaturesAuto() {
    pushUser("Detect the strongest features");
    setFeaturesText(null);
    askForBrief();
  }

  function handleFeaturesSubmit(text: string) {
    pushUser(text);
    setFeaturesText(text);
    askForBrief();
  }

  async function requestBestStoryboard(briefOverride?: string | null) {
    if (!jobId) return;
    const vibe = MODE_DEFAULT_VIBES[mode];
    const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
      jobId, mode, durationSeconds, outputQuality, audioMode,
    );
    if (!canStartPaidPlanning) return;
    setBusy(true);
    storyboardedRef.current = true;
    setStage("storyboarding");
    pushBot(
      productionKind === "product-photos"
        ? "Planning a product photo campaign from your real references and direction."
        : productionKind === "product-video"
          ? "Planning a product film around the real references, pacing, movement and final hero moment."
          : productionKind === "talking-scene"
            ? "Planning the performance, dialogue timing, camera and scene flow."
            : productionKind === "ai-video"
              ? "Planning one continuous AI video from your idea and references."
              : mode === "photos"
                ? "Planning campaign images from the website source and your direction."
                : mode === "icon"
          ? "Planning four distinct square icon concepts from the website’s real identity, captured icon/logo, colors, purpose, and your direction."
          : mode === "both"
            ? "Planning one campaign from the captured website states and brand references, with coordinated video and campaign photography."
            : mode === "demo"
              ? "Planning a true AI-generated cinematic brand film grounded in your real logo, products, UI, and captured brand content. Each scene will be generated as video rather than created by moving screenshots with code."
              : mode === "mockup"
                ? "Planning a fast, AI-generated social-feed-style reveal of your real pages/photos — the flip-through style used to advertise products and digital downloads on TikTok, Reels, and Pinterest."
                : mode === "custom"
                  ? "Planning your custom concept as real AI-generated video, grounded in your captured pages/photos."
                  : "Planning one continuous AI-generated website film from your real saved captures. The screenshots are grounding references for the full film, not separate clips. Visible UI text, prices, products and branding must stay faithful to the captured website.",
    );
    try {
      const requestedJobId = jobId;
      const response = await requestStoryboard(
        requestedJobId,
        mode,
        vibe,
        durationSeconds,
        featuresText ?? undefined,
        {
          creativeBrief:
            (briefOverride === undefined ? creativeBrief : briefOverride) ??
            undefined,
          aspectRatio,
          outputQuality,
          audioMode,
          frameRate,
          selectedCaptureIds,
        },
      );
      if (response.creditsRemaining !== undefined) setCreditBalance(response.creditsRemaining);
      if (response.jobId !== requestedJobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
        capturedRef.current = true;
        renderedRef.current = false;
      }
      storyboardedRef.current = false;
    } catch (err) {
      pushBot(errorMessage(err));
      setStage("awaiting_brief");
    } finally {
      setBusy(false);
    }
  }

  function handleBriefPreset(label: string) {
    pushUser(label);
    setCreativeBrief(null);
    void requestBestStoryboard(null);
  }

  function handleBriefSubmit(text: string) {
    pushUser(text);
    setCreativeBrief(text);
    void requestBestStoryboard(text);
  }

  function showLockedTeaser() {
    const sb = job?.storyboard;
    pushBot(
      <LockedTeaser
        siteUrl={job?.sourceUrl ?? ""}
        screenshotUrl={job?.captureMetadata?.screenshotUrl ?? null}
        sceneCount={Array.isArray(sb?.scenes) ? sb.scenes.length : 3}
        durationSeconds={sb?.targetDurationSeconds || durationSeconds}
        onUnlock={() => setShowPaywall(true)}
      />,
    );
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /**
   * Stops an in-progress capture/plan/render. The backend settles the job
   * cooperatively (refunding any spent credits along the way) — this just
   * requests it and gives immediate visual feedback while that happens.
   */
  async function handleCancelJob() {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      await cancelJob(jobId);
    } catch (err) {
      pushBot(errorMessage(err));
      setCancelling(false);
    }
    // Left true until the job's status flips (polling will show 'cancelled'
    // within a couple of seconds); the effects above reset stage/UI then.
  }

  async function handleGenerate() {
    if (!jobId) return;
    if (!isSignedIn) {
      pendingActionRef.current = () => handleGenerate();
      setShowAuthModal(true);
      return;
    }

    // Claim guest previews after sign-in, then ask the server for the exact
    // quote. This runs before any expensive provider call or credit mutation.
    try {
      await claimJob(jobId).catch(() => ({ claimed: false }));
      const quote = await requestRenderQuote(jobId, audioMode);
      setCreditBalance(quote.balance);
      if (!quote.affordable) {
        const context = `You need ${quote.shortfall} more credit${quote.shortfall === 1 ? "" : "s"} for this ${durationLabel(quote.generatedSeconds)} production`;
        setPaywallContext(context);
        pushBot(
          `This production costs exactly ${quote.totalCredits} credits: ${quote.videoCredits} for video${quote.photoCredits ? `, ${quote.photoCredits} for the photo set` : ""}${quote.narrationCredits ? `, and ${quote.narrationCredits} for voice narration` : ""}. You have ${quote.balance}, so you need ${quote.shortfall} more. Nothing was charged. Choose fewer priority photos with a shorter duration, switch quality, or add credits.`,
        );
        setShowPaywall(true);
        return;
      }
    } catch {
      /* The atomic server render gate remains the final authority. */
    }

    setBusy(true);
    autoRenderRef.current = true;
    renderedRef.current = false;
    setStage("rendering");
    const isVideo = !isImageMode(mode);
    pushBot(
      productionKind === "product-photos"
        ? "Generating the product photo campaign now. The real references stay grounded while the campaign styling follows your direction."
        : productionKind === "product-video"
          ? `Generating the ${durationLabel(durationSeconds)} product film now, with the selected format and product references locked to this production.`
          : productionKind === "talking-scene"
            ? `Generating the ${durationLabel(durationSeconds)} talking scene now, including performance, camera and selected audio direction.`
            : productionKind === "ai-video"
              ? `Generating the ${durationLabel(durationSeconds)} AI video now from the approved scene direction.`
              : mode === "photos"
                ? "Generating the website campaign image set now, grounded in the captured brand and product references."
                : mode === "icon"
          ? "Creating four polished square website-icon concepts. Each one uses a different professional direction while staying grounded in the real site, brand colors and captured mark."
          : mode === "both"
            ? `Creating both deliverables in parallel: a true AI-generated ${durationLabel(durationSeconds)} website video grounded in the selected site states, plus four AI marketing photos based on the captured brand/products.`
            : mode === "demo"
              ? `Generating one continuous ${durationLabel(durationSeconds)} cinematic brand film grounded in your real logo, products, UI and captured brand content. Longer durations continue the same Veo video instead of stitching unrelated clips.`
              : isVideo && durationSeconds > 8
                ? `Generating one continuous ${durationLabel(durationSeconds)} AI video from the selected real website references. Important actions resolve naturally, and longer durations continue the same Veo-generated film instead of stitching separate scene clips.`
                : "Generating a complete short AI-video beat from the strongest real website state. The key action is planned to finish inside the clip instead of being cut off, while visible UI text and brand details must stay faithful to the reference.",
    );
    try {
      const renderResponse = await requestRender(jobId, audioMode, narrationLanguage);
      if (typeof renderResponse.creditsRemaining === "number") {
        setCreditBalance(renderResponse.creditsRemaining);
      }
      if (redirectAfterAuthRef.current) {
        redirectAfterAuthRef.current = false;
        window.location.assign(`/dashboard?job=${encodeURIComponent(jobId)}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAN_REQUIRED") {
        setStage("ready_to_render");
        showLockedTeaser();
      } else if (
        err instanceof ApiError &&
        err.code === "INSUFFICIENT_CREDITS"
      ) {
        const required = estimateRenderCredits(
          mode,
          skipVoiceover,
          durationSeconds,
          outputQuality,
        );
        const shortfall = Math.max(0, required - creditBalance);
        setPaywallContext(
          `Add ${shortfall} credit${shortfall === 1 ? "" : "s"} to generate this saved production`,
        );
        pushBot(
          `This production needs ${required} credits. You have ${creditBalance}, so you need ${shortfall} more. Nothing was charged and your project is saved. Choose a shorter version, reduce the selected media, or add credits.`,
        );
        setStage("ready_to_render");
        setShowPaywall(true);
      } else {
        pushBot(errorMessage(err));
        setStage("ready_to_render");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleStartOver() {
    if (jobId) clearLocalJobWorkflow(jobId);
    clearActiveJobId();
    void clearPhotoDraft("new-photo-project").catch(() => {});
    selectJobId(null);
    setBusy(false);
    capturedRef.current = false;
    storyboardedRef.current = false;
    renderedRef.current = false;
    autoRenderRef.current = false;
    websiteRequestRef.current = null;
    pendingWebsiteAttachmentsRef.current = [];
    setMode("video");
    setAudioMode("voice_music");
    setNarrationLanguage("en");
    setDurationSeconds(8);
    setFeaturesText(null);
    setCreativeBrief(null);
    setActiveCaptureMetadata(null);
    setSelectedCaptureIds([]);
    selectionKeyRef.current = "";
    setPaywallContext(undefined);
    setAspectRatio("16:9");
    setOutputQuality("1080p");
    setFrameRate(24);
    setStage("awaiting_url");
    setMessages([
      {
        id: nextId(),
        role: "bot",
        content: "New project — choose a creation mode and tell me what you want to make.",
      },
    ]);
  }

  async function handleRegenerateResult() {
    if (!jobId) return;
    const sourceJobId = jobId;
    const vibe = MODE_DEFAULT_VIBES[mode];
    const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
      sourceJobId, mode, durationSeconds, outputQuality, audioMode,
    );
    if (!canStartPaidPlanning) return;
    const label =
      productionKind === "product-photos" || productionKind === "campaign-photos"
        ? "Create another photo direction"
        : productionKind === "product-video"
          ? "Create another product video"
          : productionKind === "talking-scene"
            ? "Create another take"
            : productionKind === "ai-video"
              ? "Create another video direction"
              : "Create another campaign cut";
    setBusy(true);
    storyboardedRef.current = true;
    renderedRef.current = false;
    pushUser(label);
    pushBot(
      isImageMode(mode)
        ? "Creating a fresh image direction from the same project references. Your finished images stay in this conversation."
        : "Creating a fresh scene direction from the same project source. Your finished video stays in this conversation.",
    );
    setStage("storyboarding");
    try {
      // The storyboard endpoint automatically creates an immutable child job
      // when the current result is complete. That keeps one visible chat while
      // preserving every previous output.
      const response = await requestStoryboard(
        sourceJobId,
        mode,
        vibe,
        durationSeconds,
        featuresText ?? undefined,
        {
          creativeBrief: creativeBrief ?? undefined,
          aspectRatio,
          outputQuality,
          audioMode,
          frameRate,
          selectedCaptureIds,
        },
      );
      if (response.creditsRemaining !== undefined) setCreditBalance(response.creditsRemaining);
      if (response.jobId !== sourceJobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
        capturedRef.current = true;
      }
      storyboardedRef.current = false;
    } catch (err) {
      storyboardedRef.current = false;
      pushBot(errorMessage(err));
      setStage("done");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinueAfterResult(text: string) {
    if (!jobId || !text.trim()) return;
    const sourceJobId = jobId;
    const nextBrief = text.trim();
    const vibe = MODE_DEFAULT_VIBES[mode];
    const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
      sourceJobId, mode, durationSeconds, outputQuality, audioMode,
    );
    if (!canStartPaidPlanning) return;
    pushUser(nextBrief);
    setCreativeBrief(nextBrief);
    setBusy(true);
    storyboardedRef.current = true;
    renderedRef.current = false;
    setStage("storyboarding");
    try {
      const response = await requestStoryboard(
        sourceJobId,
        mode,
        vibe,
        durationSeconds,
        featuresText ?? undefined,
        {
          creativeBrief: nextBrief,
          aspectRatio,
          outputQuality,
          audioMode,
          frameRate,
          selectedCaptureIds,
        },
      );
      if (response.creditsRemaining !== undefined) setCreditBalance(response.creditsRemaining);
      if (response.jobId !== sourceJobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
        capturedRef.current = true;
      }
      storyboardedRef.current = false;
    } catch (err) {
      storyboardedRef.current = false;
      pushBot(errorMessage(err));
      setStage("done");
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitchProductResult(nextMode: "photos" | "video") {
    if (!jobId) return;
    setBusy(true);
    try {
      const continuation = await reuseSavedCapture(jobId);
      const saved = await fetchJob(continuation.jobId);
      selectJobId(saved.id);
      onJobCreated?.(saved.id);
      setActiveCaptureMetadata(saved.captureMetadata);
      capturedRef.current = true;
      storyboardedRef.current = false;
      renderedRef.current = false;
      setCreativeBrief(null);
      setMode(nextMode);
      if (nextMode === "photos") {
        setAspectRatio("1:1");
        setOutputQuality("1080p");
        setFrameRate(24);
        setAudioMode("silent");
        pushUser("Create product photos");
        pushBot("Product references are ready. Describe the new photo campaign or choose the best direction automatically.");
        setStage("awaiting_brief");
      } else {
        if (audioMode === "silent") setAudioMode("native_audio");
        pushUser("Create a product video");
        pushBot("Product references are ready. Choose the video length, then the delivery format.");
        setStage("awaiting_duration");
      }
    } catch (err) {
      pushBot(errorMessage(err));
      setStage("done");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Runs automatically after a render fails. Gets a brand-new job (fresh copy
   * of the saved screenshots, new job id) and a brand-new storyboard (fresh
   * AI planning attempt, new variant seed) using the same creative choices
   * the user already made, so the next "Generate" click can never replay the
   * exact plan that just failed.
   */
  async function prepareFreshVersionAfterFailure(failedJobId: string) {
    const vibe = MODE_DEFAULT_VIBES[mode];
    setBusy(true);
    storyboardedRef.current = true;
    renderedRef.current = false;
    pushBot(
      isImageMode(mode)
        ? `Preparing a fresh ${mode === "icon" ? "website-icon" : "marketing-image"} plan from your saved brand references…`
        : "Preparing a fresh direction from your project references so the next attempt uses a brand-new scene plan…",
    );
    try {
      const reused = await reuseSavedCapture(failedJobId);
      selectJobId(reused.jobId);
      onJobCreated?.(reused.jobId);
      capturedRef.current = true;
      const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning(
        reused.jobId, mode, durationSeconds, outputQuality, audioMode,
      );
      if (!canStartPaidPlanning) {
        setStage("failed");
        return;
      }
      setStage("storyboarding");
      const response = await requestStoryboard(
        reused.jobId,
        mode,
        vibe,
        durationSeconds,
        featuresText ?? undefined,
        {
          creativeBrief: creativeBrief ?? undefined,
          aspectRatio,
          outputQuality,
          audioMode,
          frameRate,
          selectedCaptureIds,
        },
      );
      if (response.creditsRemaining !== undefined) setCreditBalance(response.creditsRemaining);
      if (response.jobId !== reused.jobId) {
        selectJobId(response.jobId);
        onJobCreated?.(response.jobId);
      }
      storyboardedRef.current = false;
    } catch (err) {
      storyboardedRef.current = false;
      pushBot(errorMessage(err));
      setStage("failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleCaptureSelection(id: string) {
    setSelectedCaptureIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      const maxForNextCut = Math.min(30, activeSceneCount);
      if (current.length >= maxForNextCut) return current;
      return [...current, id];
    });
  }

  async function handleChatAttachments(files: File[]) {
    if (!files.length || busy) return;
    if (!isSignedIn) {
      pendingActionRef.current = () => handleChatAttachments(files);
      setShowAuthModal(true);
      return;
    }
    if (!jobId) {
      pushBot("Start a project first, then paste or attach screenshots directly in this chat.");
      return;
    }

    setBusy(true);
    try {
      let targetJobId = jobId;
      if (stage === "done") {
        const reused = await reuseSavedCapture(jobId);
        targetJobId = reused.jobId;
        const saved = await fetchJob(targetJobId);
        selectJobId(saved.id);
        onJobCreated?.(saved.id);
        capturedRef.current = true;
        storyboardedRef.current = false;
        renderedRef.current = false;
        setActiveCaptureMetadata(saved.captureMetadata);
        setMode(mode);
        setStage("awaiting_brief");
      }

      await claimJob(targetJobId).catch(() => ({ claimed: false }));
      const response = await uploadPrivatePages(targetJobId, files);
      const refreshed = await fetchJob(targetJobId);
      if (refreshed.captureMetadata) {
        setActiveCaptureMetadata(refreshed.captureMetadata);
        const nextIds = autoSelectCaptureIds(refreshed.captureMetadata, Math.max(activeSceneCount, selectedCaptureIds.length || 1));
        setSelectedCaptureIds(nextIds);
      }
      pushUser(`${response.added} attached image${response.added === 1 ? "" : "s"}`, "attachment");
      pushBot(`${response.added} image${response.added === 1 ? " is" : "s are"} now attached to this conversation and available as generation references.`);
    } catch (err) {
      pushBot(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemixResult() {
    if (!jobId) return;
    const previousMode = mode;
    setBusy(true);
    try {
      const reused = await reuseSavedCapture(jobId);
      const saved = await fetchJob(reused.jobId);
      selectJobId(saved.id);
      onJobCreated?.(saved.id);
      capturedRef.current = true;
      storyboardedRef.current = false;
      renderedRef.current = false;
      setMode(previousMode);
      setCreativeBrief(null);
      pushUser(
        productionKind === "product-photos" || productionKind === "campaign-photos"
          ? "Change the photo direction"
          : productionKind === "talking-scene"
            ? "Change the scene direction"
            : "Change the creative direction",
      );
      if (saved.captureMetadata)
        pushBot(
          <SiteCard
            sourceUrl={saved.sourceUrl}
            metadata={saved.captureMetadata}
          />,
        );
      pushBot(
        previousMode === "photos"
          ? "Describe the photo change you want — background, product focus, studio style, lifestyle setup, lighting, crop, or campaign mood. The project references stay attached."
          : previousMode === "icon"
            ? "Describe how you want the website icon changed—more minimal, bolder, more dimensional, a different silhouette, or closer to the existing mark. The captured identity stays attached for the new concepts."
            : previousMode === "both"
              ? "Describe what to change in the video and/or photos. The project source stays attached while a new video and/or image direction is created."
              : previousMode === "demo"
                ? "Describe what to change in the cinematic film — a different feature, product, journey, atmosphere, camera language, or mood. The current brand references stay attached."
                : "Tell me what to change: pages, products, actions, feature emphasis, scene order, timing, energy, format, or pacing. The current source stays attached to this conversation.",
      );
      setStage("awaiting_brief");
    } catch (err) {
      pushBot(errorMessage(err));
      setStage("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative flex min-h-0 flex-col overflow-hidden ${compactLanding ? "rounded-[20px] sm:rounded-[24px]" : "rounded-[20px] sm:rounded-[30px]"} border border-white/10 bg-[linear-gradient(180deg,rgba(34,24,62,.96),rgba(17,12,30,.98))] shadow-[0_34px_110px_-48px_rgba(139,92,246,.8)] backdrop-blur-2xl ${className ?? ""}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet/10 to-transparent" />
      {/* Header — hidden on the compact public landing composer because the mode tabs already explain the tool. */}
      <div className={`${streamlinedInitialComposer && stage === "awaiting_url" ? "hidden" : "relative flex items-center gap-3 border-b border-border bg-white/[.018] px-4 py-3.5 sm:px-5"}`}>
        <img
          src="/logo.svg"
          alt=""
          width={26}
          height={26}
          className="shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[13.5px] font-semibold text-text-primary">
            AiWebVideo Director
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
            <span
              className="h-1.5 w-1.5 rounded-full bg-mint"
              aria-hidden="true"
            />
            {productionKind === "product-photos"
              ? "Product campaign · one conversation"
              : productionKind === "product-video"
                ? "Product film · one conversation"
                : productionKind === "talking-scene"
                  ? "Talking scene · one conversation"
                  : productionKind === "ai-video"
                    ? "AI video · one conversation"
                    : "Website campaign · one conversation"}
          </p>
        </div>
        {jobId && (
          <div className="hidden items-center gap-1.5 rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-[10px] font-semibold text-mint sm:flex">
            <span aria-hidden="true">✓</span>{" "}
            {isStudioProject
              ? mode === "photos"
                ? "AI product photos"
                : projectCaptureMetadata?.studioKind === "product"
                  ? "AI product video"
                  : projectCaptureMetadata?.studioKind === "scenario"
                    ? "Talking scene"
                    : "Original AI video"
              : mode === "photos"
                ? "Creative photo edits"
                : mode === "icon"
                  ? "Website icon studio"
                  : mode === "both"
                    ? "AI video · creative photos"
                    : mode === "demo"
                      ? "AI cinematic film"
                      : "AI video · site-grounded"}
          </div>
        )}
      </div>

      {/* Messages */}
      {(stage !== "awaiting_url" || restoring) && (
        <div
          ref={scrollRef}
          className="chat-scroll relative flex-1 min-h-0 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0))] px-4 py-5 sm:px-5"
        >
          {restoring ? (
            <div className="flex min-h-[260px] items-center justify-center sm:min-h-[360px]">
              <div className="w-full max-w-sm rounded-2xl border border-white/[.08] bg-white/[.025] px-4 py-6 text-center sm:rounded-3xl sm:px-6 sm:py-8">
                <span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-violet/30 border-t-mint" aria-hidden="true" />
                <p className="mt-4 font-display text-sm font-semibold text-text-primary">Reconnecting your production</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-text-dim">Restoring the conversation, exact settings and live generation state.</p>
              </div>
            </div>
          ) : (
            messages.map((m, index) =>
              index === 0 ? null : (
                <ChatBubble key={m.id} role={m.role}>
                  {m.content}
                </ChatBubble>
              ),
            )
          )}
          {!restoring && pollingActive && (
            <div ref={generationProcessRef} className="scroll-mt-24">
            <GenerationCanvas
              status={
                job?.status ??
                (stage === "capturing"
                  ? "capturing"
                  : stage === "storyboarding"
                    ? "storyboarding"
                    : "rendering")
              }
              progress={
                job?.progress ??
                (stage === "capturing"
                  ? 12
                  : stage === "storyboarding"
                    ? 52
                    : 80)
              }
              statusMessage={job?.statusMessage}
              etaSeconds={job?.etaSeconds}
              onCancel={jobId ? () => void handleCancelJob() : undefined}
              cancelling={cancelling}
              aspectRatio={aspectRatio}
              productionKind={productionKind}
              referenceItems={liveReferenceItems}
              sceneAssignments={sceneAssignments}
              brandMarkUrl={projectCaptureMetadata?.logoUrl ?? null}
              brandName={websiteBrandName(job?.sourceUrl, projectCaptureMetadata?.title)}
            />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      {!restoring && (
      <div
        className={`chat-scroll space-y-2.5 ${stage === "awaiting_url" ? "min-h-0 overflow-y-auto bg-transparent p-0" : stage === "done" ? "shrink-0 max-h-[42dvh] overflow-y-auto border-t border-white/[.07] bg-[linear-gradient(180deg,rgba(9,8,18,.72),rgba(19,15,32,.95))] p-3 sm:max-h-[36vh] sm:p-4" : "shrink-0 max-h-[68dvh] overflow-y-auto border-t border-white/[.07] bg-[linear-gradient(180deg,rgba(9,8,18,.72),rgba(19,15,32,.95))] p-3 sm:max-h-[72vh] sm:p-4"}`}
      >
        {stage === "awaiting_url" && (
          <WebsiteBriefForm
            onSubmit={handleWebsiteSubmit}
            onStudioSubmit={handleStudioSubmit}
            initialCreationIntent={initialCreationIntent}
            disabled={busy}
            showCreditPricing={!isPublicCreatorPath()}
            landingWebsitePreview={isPublicCreatorPath()}
            onIntentRequest={handlePublicIntentRequest}
            compactLayout={streamlinedInitialComposer}
          />
        )}
        {stage === "preview_ready" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-mint/25 bg-mint/[.055] p-4">
              <p className="font-utility text-[9px] font-semibold uppercase tracking-[.16em] text-mint">Website preview ready</p>
              <p className="mt-1 text-sm font-semibold text-white">We reached your website successfully.</p>
              <p className="mt-1 text-[11px] leading-5 text-text-muted">Your domain, promotion brief, favicon and useful screenshots are saved for free. Continue when you are ready; credits are checked before any paid AI planning, video, image or voice provider starts.</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                if (!isPublicCreatorPath() && isSignedIn && jobId) {
                  void startWebsiteStoryboard(jobId, activeCaptureMetadata ?? job?.captureMetadata ?? null);
                } else {
                  continueLandingPreview();
                }
              }}
              disabled={busy}
            >
              {!isPublicCreatorPath() && isSignedIn ? "Continue to AI production" : "Continue in Workspace"}
            </Button>
            <p className="text-center text-[10px] text-text-dim">Website preview and screenshots are free. No generation credits are used here.</p>
          </div>
        )}
        {stage === "awaiting_private_pages" && (
          <div className="space-y-2.5">
            <PhotoUploadPicker
              onSubmit={handlePrivatePageUpload}
              disabled={busy}
              isAdmin={isAdmin}
              draftKey={`private-pages-${jobId ?? "pending"}`}
              title="Paste or add private/admin page screenshots"
              buttonLabel="Add"
              helper={
                isAdmin
                  ? "Administrator upload · add any number of authorized screenshots"
                  : "Paste with Ctrl+V / Cmd+V or choose screens you are authorized to use"
              }
            />
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={continueAfterPrivatePages}
              disabled={busy}
            >
              Continue without private pages
            </Button>
          </div>
        )}
        {stage === "awaiting_mode" && (
          <QuickReplyChips
            options={MODE_OPTIONS.map((o) => o.label)}
            onSelect={handleModeSelect}
            disabled={busy}
          />
        )}
        {stage === "awaiting_duration" && (
          <MediaPlanningPanel
            metadata={activeCaptureMetadata ?? job?.captureMetadata}
            selectedIds={selectedCaptureIds}
            onSelectionChange={setSelectedCaptureIds}
            onChooseDuration={handleDurationSelect}
            creditBalance={creditBalance}
            isSignedIn={isSignedIn}
            disabled={busy}
          />
        )}
        {stage === "awaiting_format" && (
          <QuickReplyChips
            options={FORMAT_OPTIONS.map((o) => o.label)}
            onSelect={handleFormatSelect}
            disabled={busy}
          />
        )}
        {stage === "awaiting_features" && (
          <>
            <QuickReplyChips
              options={["Detect the strongest features"]}
              onSelect={handleFeaturesAuto}
              disabled={busy}
            />
            <ChatInputBar
              placeholder="e.g. search, wishlist, live chat, fast checkout…"
              onSubmit={handleFeaturesSubmit}
              onFiles={handleChatAttachments}
              disabled={busy}
            />
          </>
        )}
        {stage === "awaiting_brief" && (
          <>
            {mode !== "photos" && (
              <QuickReplyChips
                options={["Create with best direction"]}
                onSelect={handleBriefPreset}
                disabled={busy}
              />
            )}
            <ChatInputBar
              multiline
              placeholder={
                mode === "photos"
                  ? "Describe the marketing edit: e.g. use the black dress, luxury beige studio, soft shadows, Instagram ad style, no added text…"
                  : mode === "icon"
                    ? "Optional: e.g. elegant minimal symbol, use the real gold and cream palette, keep the existing L idea, no words…"
                    : mode === "both"
                      ? "Optional: video focus + photo style, e.g. fast luxury video; create clean studio product ads from the captured products…"
                      : "Optional: e.g. focus on dresses, make the pacing faster, show add-to-cart clearly, end on checkout…"
              }
              onSubmit={handleBriefSubmit}
              onFiles={handleChatAttachments}
              disabled={busy}
            />
          </>
        )}
        {stage === "ready_to_render" && (
          <div className="space-y-3">
            <div
              className={`rounded-2xl border p-4 ${estimatedShortfall > 0 && isSignedIn ? "border-amber-300/30 bg-amber-300/10" : "border-mint/25 bg-mint/[.06]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-utility text-[9px] uppercase tracking-[.16em] text-mint">
                    {mode === "photos"
                      ? "Photo campaign ready"
                      : isStudioProject
                        ? "AI video plan ready"
                        : "Website film plan ready"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {mode === "photos"
                      ? "AI-directed photo campaign"
                      : isStudioProject
                        ? projectCaptureMetadata?.studioKind === "product"
                          ? "AI-directed product video"
                          : projectCaptureMetadata?.studioKind === "scenario"
                            ? "AI-directed talking scene"
                            : "AI-directed original video"
                        : "AI-selected website film"}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-utility text-[10px] text-white">
                  {estimatedCredits} credits
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-text-muted sm:grid-cols-4">
                <span className="rounded-lg bg-black/15 px-2.5 py-2">
                  {durationLabel(
                    job?.storyboard?.targetDurationSeconds || durationSeconds,
                  )}
                </span>
                <span className="rounded-lg bg-black/15 px-2.5 py-2">
                  {aspectRatio}
                </span>
                <span className="rounded-lg bg-black/15 px-2.5 py-2">
                  {outputQuality === "4k" ? ((job?.storyboard?.targetDurationSeconds || durationSeconds) > 8 ? "4K mastered" : "4K native") : ((job?.storyboard?.targetDurationSeconds || durationSeconds) > 8 ? "1080p master" : "1080p native")}
                </span>
                <span className="rounded-lg bg-black/15 px-2.5 py-2">
                  {audioMode === "voice_music"
                    ? `Narrated · ${narrationLanguage.toUpperCase()}`
                    : audioMode === "native_audio"
                      ? "Scene audio"
                      : audioMode === "music_only"
                        ? "Music only"
                        : "Silent"}
                </span>
              </div>
              {isSignedIn && (
                <p className="mt-3 text-[10px] font-semibold text-text-muted">
                  Balance: {creditBalance}
                  {estimatedShortfall > 0
                    ? ` · ${estimatedShortfall} more credits needed`
                    : " · ready — automatic generation pauses only when you need to choose credits or make changes"}
                </p>
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleGenerate}
              disabled={busy}
            >
              {isSignedIn
                ? estimatedShortfall > 0
                  ? `Add ${estimatedShortfall} credits and continue`
                  : mode === "photos"
                    ? `Generate the AI photo campaign · ${estimatedCredits} credits`
                    : `Generate the final video · ${estimatedCredits} credits`
                : "Sign in and generate"}
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                storyboardedRef.current = false;
                pushBot(
                  isStudioProject
                    ? "Tell me what you want changed in the creative direction and I’ll prepare a fresh plan from this project."
                    : "Tell me what you want changed in the promotion and I’ll prepare a fresh creative plan from the saved website.",
                );
                setStage("awaiting_brief");
              }}
              className="w-full rounded-xl py-2 text-[11px] font-semibold text-text-dim transition hover:bg-white/[.035] hover:text-white disabled:opacity-50"
            >
              {isStudioProject ? "Adjust the creative direction" : "Adjust the promotion brief"}
            </button>
          </div>
        )}
        {stage === "done" && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => void handleRegenerateResult()}
                disabled={busy}
              >
                {productionKind === "product-photos" || productionKind === "campaign-photos"
                  ? "New photo direction"
                  : productionKind === "product-video"
                    ? "New product video"
                    : productionKind === "talking-scene"
                      ? "New take"
                      : productionKind === "ai-video"
                        ? "New video direction"
                        : "New campaign cut"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => void handleRemixResult()}
                disabled={busy}
              >
                Change direction
              </Button>

              {productionKind === "product-photos" && (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:col-span-2"
                  onClick={() => void handleSwitchProductResult("video")}
                  disabled={busy}
                >
                  Turn these product references into video
                </Button>
              )}
              {productionKind === "product-video" && (
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:col-span-2"
                  onClick={() => void handleSwitchProductResult("photos")}
                  disabled={busy}
                >
                  Create product photos in this chat
                </Button>
              )}
            </div>

            {liveReferenceItems.length > 0 && (
              <details className="group rounded-2xl border border-white/[.08] bg-white/[.025] p-3">
                <summary className="flex min-h-10 list-none items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-[11px] font-semibold text-text-primary">Reuse saved screenshots</p>
                    <p className="mt-0.5 text-[10px] text-text-dim">{selectedCaptureIds.length} selected · open only when you want to change the next cut</p>
                  </div>
                  <span className="rounded-full border border-white/[.08] bg-white/[.04] px-2.5 py-1 text-[9px] text-text-muted group-open:text-white">Manage</span>
                </summary>
                <div className="mt-3 border-t border-white/[.06] pt-3">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <p className="max-w-xl text-[10px] leading-5 text-text-dim">Scroll sideways to review all saved screenshots. Click any one to include or remove it for the next version. Tagged cards show their current scene slot.</p>
                    <div className="flex flex-wrap gap-2 text-[9px]">
                    <button
                      type="button"
                      onClick={() => setSelectedCaptureIds(autoSelectCaptureIds(projectCaptureMetadata, Math.min(30, activeSceneCount)))}
                      className="rounded-full border border-white/[.08] bg-white/[.04] px-2.5 py-1 text-text-muted transition hover:bg-white/[.08] hover:text-white"
                    >
                      Auto-pick best
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCaptureIds([])}
                      className="rounded-full border border-white/[.08] bg-white/[.04] px-2.5 py-1 text-text-muted transition hover:bg-white/[.08] hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-2 text-[9px] text-text-dim">
                  <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 text-mint">{selectedCaptureIds.length} selected</span>
                  <span className="rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1">Choose up to {Math.min(30, activeSceneCount)} priority references</span>
                  <span className="rounded-full border border-white/[.08] bg-white/[.03] px-2.5 py-1">Film timeline: {activeSceneCount} beat{activeSceneCount === 1 ? "" : "s"}</span>
                </div>
                <div className="chat-scroll flex gap-3 overflow-x-auto pb-2">
                  {liveReferenceItems.map((item, index) => {
                    const selected = selectedCaptureIds.includes(item.id);
                    const sceneNumber = sceneAssignments[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleCaptureSelection(item.id)}
                        className={`group w-48 shrink-0 overflow-hidden rounded-2xl border text-left transition sm:w-56 ${selected ? "border-violet/40 bg-violet/[.08] shadow-[0_18px_36px_-28px_rgba(139,92,246,.95)]" : "border-white/[.08] bg-black/15 hover:border-white/[.14] hover:bg-white/[.04]"}`}
                      >
                        <div className="relative">
                          <img src={item.url} alt={item.title} className="aspect-[16/10] w-full object-cover object-top" />
                          <span className="absolute left-2 top-2 rounded-full border border-black/10 bg-black/60 px-2 py-1 font-utility text-[8px] uppercase tracking-[.14em] text-white/85">{String(index + 1).padStart(2, "0")}</span>
                          {sceneNumber && <span className="absolute right-2 top-2 rounded-full border border-violet/25 bg-violet/95 px-2 py-1 font-utility text-[8px] font-bold uppercase tracking-[.14em] text-white">S{sceneNumber}</span>}
                          {selected && <span className="absolute left-2 bottom-2 rounded-full border border-mint/20 bg-mint/90 px-2 py-1 font-utility text-[8px] uppercase tracking-[.12em] text-[#07131a]">Selected</span>}
                        </div>
                        <div className="border-t border-white/[.06] px-3 py-2.5">
                          <p className="truncate text-[10px] text-white/85">{item.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                </div>
              </details>
            )}

            <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-3">
              <div className="mb-2 px-1">
                <p className="text-[11px] font-semibold text-text-primary">Continue in this chat</p>
                <p className="mt-0.5 text-[10px] text-text-dim">Your finished result stays above while the next version is created.</p>
              </div>
              <ChatInputBar
                multiline
                placeholder={
                  productionKind === "product-photos" || productionKind === "campaign-photos"
                    ? "e.g. Make the next set brighter with a clean studio background…"
                    : productionKind === "talking-scene"
                      ? "e.g. Make the dialogue shorter and the camera more cinematic…"
                      : productionKind === "product-video"
                        ? "e.g. Make the next video faster with a premium product reveal…"
                        : productionKind === "website-video"
                          ? "e.g. Focus more on checkout and make the opening faster…"
                          : "e.g. Change the mood, pacing, camera, or scene direction…"
                }
                onSubmit={handleContinueAfterResult}
                onFiles={handleChatAttachments}
                disabled={busy}
              />
            </div>

            <button
              type="button"
              onClick={handleStartOver}
              disabled={busy}
              className="flex min-h-11 w-full items-center justify-center rounded-xl text-[11px] font-semibold text-text-dim transition hover:bg-white/[.035] hover:text-text-primary disabled:opacity-50"
            >
              {isStudioProject ? "Start a separate creation" : "Start with another website"}
            </button>
          </div>
        )}
        {stage === "failed" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {activeCaptureMetadata && (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => void handleRemixResult()}
                disabled={busy}
              >
                Try a new direction
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              className="w-full"
              onClick={handleStartOver}
              disabled={busy}
            >
              {isStudioProject ? "Start a separate creation" : "Use another website"}
            </Button>
          </div>
        )}
      </div>
      )}

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          context={paywallContext}
          durationSeconds={
            job?.storyboard?.targetDurationSeconds || durationSeconds
          }
          mode={mode}
          outputQuality={job?.storyboard?.outputQuality ?? outputQuality}
          skipVoiceover={skipVoiceover}
          currentBalance={creditBalance}
          reservedCredits={job?.creditsSpent ?? 0}
          jobId={jobId}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignedIn={async () => {
            setShowAuthModal(false);
            const resume = pendingActionRef.current;
            pendingActionRef.current = null;
            const isPublicCreator =
              window.location.pathname === "/" ||
              window.location.pathname.startsWith("/studio");

            // On a public creator/landing page, authentication should always
            // finish in Workspace. If Generate/upload was waiting on auth, let
            // that action complete first so navigation cannot abort its API call.
            redirectAfterAuthRef.current = false;
            const hadPendingAction = Boolean(resume);
            if (resume) await resume();
            // A pending action owns its own destination (preview continuation,
            // non-website creator handoff, upload, etc.). Do not overwrite it
            // with an older active-job redirect from localStorage.
            if (!hadPendingAction && isPublicCreator && getActiveJobId()) {
              window.location.assign(resolveDashboardDestination());
            }
          }}
        />
      )}
    </div>
  );
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const friendly: Record<string, string> = {
      RATE_LIMITED:
        "The studio is handling several website previews right now. Please wait a few minutes, then try again.",
      SSRF_BLOCKED:
        "That address cannot be opened safely. Please use a public website URL.",
      VALIDATION_ERROR: "Please check what you entered and try again.",
      PROMPT_REQUIRED: "Add a clear prompt describing what you want before generating.",
      PRODUCT_PHOTO_REQUIRED: "Attach at least one real product photo before generating.",
      INVALID_STUDIO_OPTIONS: "Check the duration and production settings, then try again.",
      INVALID_STUDIO_MODE: "That production type does not match the selected creator mode. Choose the mode again.",
      NO_FILES: "Add a prompt or the required reference images before generating.",
      PLAN_REQUIRED:
        "Your production plan is ready. Choose a production option when you want to create the final files.",
      INSUFFICIENT_CREDITS:
        "Your project is saved, but this version needs more production credits. Nothing was charged.",
      RENDER_ALREADY_STARTED:
        "This production is already running. Progress will update here automatically.",
      RENDER_ALREADY_FAILED:
        "That version already tried once and failed. Preparing a fresh version to try again…",
      STORYBOARD_NOT_READY:
        "The production plan is still being prepared. Please give it another moment.",
      BILLING_NOT_CONFIGURED:
        "Checkout is temporarily unavailable. Your project is saved; please try again shortly.",
      PRICE_NOT_CONFIGURED:
        "That purchase option is temporarily unavailable. Your project is saved.",
      INTERNAL_ERROR:
        "We could not complete that step right now. Your work is safe; please try again shortly.",
      NOT_FOUND:
        "That project could not be found. Start a new project from the website URL.",
    };
    return (
      friendly[err.code ?? ""] ??
      "We could not complete that step. Your project is safe; please try again."
    );
  }
  // Anything else (network drops, unexpected exceptions) should never leak
  // technical details — show a calm, professional message instead.
  if (
    err instanceof TypeError ||
    (err instanceof Error && /fetch|network|load failed/i.test(err.message))
  ) {
    return "We're having trouble connecting. Please check your internet connection and try again.";
  }
  return "Something unexpected happened on our side. Please try again in a moment — if it keeps happening, we're on it.";
}
