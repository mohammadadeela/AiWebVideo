import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  ChevronDown,
  Film,
  Globe2,
  Image as ImageIcon,
  MessageCircleMore,
  Monitor,
  PackageOpen,
  Paperclip,
  Settings2,
  Sparkles,
  Smartphone,
  Volume2,
  X,
} from "lucide-react";
import { normalizeWebsiteUrl } from "@/lib/websiteUrl";
import { estimateRenderCredits } from "@/lib/credits";
import type { AudioMode, JobMode } from "./types";

export type CreationIntent =
  | "website"
  | "video"
  | "photo"
  | "product-video"
  | "scenario";
export type WebsiteProductionMode = Extract<
  JobMode,
  "video" | "tutorial" | "buy" | "tour" | "linkedin" | "demo"
>;

export interface WebsiteGenerationSettings {
  mode: WebsiteProductionMode;
  durationSeconds: number | "auto";
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  audioMode: AudioMode;
  narrationLanguage: string;
}

export interface StudioGenerationRequest {
  studioKind: "product" | "idea" | "scenario";
  prompt: string;
  files: File[];
  mode: "photos" | "video" | "custom";
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  audioMode: AudioMode;
}

const DEFAULT_SETTINGS: WebsiteGenerationSettings = {
  mode: "video",
  durationSeconds: 8,
  aspectRatio: "9:16",
  outputQuality: "1080p",
  audioMode: "native_audio",
  narrationLanguage: "en",
};

const WEBSITE_RECIPES: Array<{
  mode: WebsiteProductionMode;
  label: string;
  helper: string;
}> = [
  { mode: "video", label: "Promo", helper: "Brand campaign" },
  { mode: "demo", label: "Cinematic", helper: "Generated brand film" },
  { mode: "tutorial", label: "Tutorial", helper: "Teach the workflow" },
  { mode: "tour", label: "Feature tour", helper: "Show the product" },
  { mode: "buy", label: "How to buy", helper: "Conversion journey" },
  { mode: "linkedin", label: "LinkedIn", helper: "Professional social" },
];

const CREATION_MODES = [
  { id: "website" as const, label: "Website Video", short: "Website", icon: Globe2 },
  { id: "video" as const, label: "AI Video", short: "AI Video", icon: Film },
  { id: "photo" as const, label: "Product Photos", short: "Photos", icon: ImageIcon },
  { id: "product-video" as const, label: "Product Video", short: "Product", icon: PackageOpen },
  { id: "scenario" as const, label: "Talking Scene", short: "Talking", icon: MessageCircleMore },
] as const;

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const NARRATION_LANGUAGES = [
  ["en", "English"],
  ["ar", "Arabic"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["de", "German"],
  ["it", "Italian"],
  ["tr", "Turkish"],
  ["hi", "Hindi"],
  ["ur", "Urdu"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
] as const;

const DURATION_PRESETS = [8, 16, 24, 32] as const;

const QUICK_IDEAS: Record<CreationIntent, string[]> = {
  website: [
    "Launch the brand with a strong CTA",
    "Show the best features in 20 seconds",
    "Make a premium Reel-style promo",
  ],
  video: [
    "Cinematic product launch",
    "Fast social ad with a bold hook",
    "Premium brand reveal",
  ],
  photo: [
    "Clean luxury studio",
    "Bright ecommerce campaign",
    "Editorial product hero",
  ],
  "product-video": [
    "Slow premium product reveal",
    "Dynamic social product ad",
    "Macro details and hero finish",
  ],
  scenario: [
    "Founder explains the product",
    "Two-person product conversation",
    "Friendly customer testimonial",
  ],
};

function normalizeDuration(value: number) {
  if (!Number.isFinite(value)) return 8;
  return Math.max(8, Math.min(144, Math.round(value)));
}

const optionClass = (active: boolean) =>
  `creator-option flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all ${
    active
      ? "is-active border-mint/60 bg-mint text-[#10231f] shadow-[0_10px_30px_-16px_rgba(114,255,222,.85)]"
      : "border-mint/15 bg-mint/[.045] text-text-muted hover:border-mint/45 hover:bg-mint/[.10] hover:text-white"
  }`;

function intentFromSearch(): CreationIntent | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("create");
  if (value === "photo" || value === "product") return "photo";
  if (value === "product-video") return "product-video";
  if (value === "scenario" || value === "talking") return "scenario";
  if (value === "video" || value === "idea") return "video";
  if (value === "website") return "website";
  return null;
}

function fileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function durationLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${seconds % 60 ? ` ${seconds % 60}s` : ""}`;
}

export function WebsiteBriefForm({
  onSubmit,
  onStudioSubmit,
  disabled,
  initialCreationIntent,
  showCreditPricing = true,
  landingWebsitePreview = false,
  onIntentRequest,
  compactLayout = false,
}: {
  onSubmit: (
    url: string,
    brief: string,
    settings: WebsiteGenerationSettings,
    referenceFiles: File[],
  ) => void | Promise<void>;
  onStudioSubmit: (request: StudioGenerationRequest) => void | Promise<void>;
  disabled?: boolean;
  initialCreationIntent?: CreationIntent;
  /** Hide all credit pricing on the public landing creator. */
  showCreditPricing?: boolean;
  /** Public website CTA is a free capture/brand preview, not a paid generation. */
  landingWebsitePreview?: boolean;
  /** Return false to block switching modes (used to require auth on public non-website creators). */
  onIntentRequest?: (intent: CreationIntent) => boolean | void;
  /** Compact public landing layout. Does not change generation behavior. */
  compactLayout?: boolean;
}) {
  const [activeMode, setActiveMode] = useState<CreationIntent>("website");
  const activeModeRef = useRef<CreationIntent>("website");
  const [url, setUrl] = useState("");
  const [brief, setBrief] = useState("");
  const [prompt, setPrompt] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactPanel, setCompactPanel] = useState<"style" | "ideas" | null>(null);
  const [settings, setSettings] = useState<WebsiteGenerationSettings>(DEFAULT_SETTINGS);
  const [customDurationText, setCustomDurationText] = useState("");
  const [customDurationSelected, setCustomDurationSelected] = useState(false);
  const [selectedWebsiteRecipe, setSelectedWebsiteRecipe] = useState<WebsiteProductionMode | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRootRef = useRef<HTMLDivElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  const primaryFieldsRef = useRef<HTMLDivElement>(null);
  const websiteBriefRef = useRef<HTMLTextAreaElement>(null);
  const studioPromptRef = useRef<HTMLTextAreaElement>(null);
  const customDurationInputRef = useRef<HTMLInputElement>(null);

  function applyIntent(intent: CreationIntent, userInitiated = false) {
    if (userInitiated && onIntentRequest?.(intent) === false) return;
    const previousIntent = activeModeRef.current;
    activeModeRef.current = intent;
    setActiveMode(intent);
    setCompactPanel(null);
    setSettingsOpen(false);
    setError(null);
    setSettings((current) => {
      if (intent === "photo") {
        return { ...current, aspectRatio: "1:1", audioMode: "silent" };
      }

      // Photo creation intentionally forces square + silent output. Only undo
      // those defaults when the user is actually leaving Product Photos; a
      // deliberate square/silent choice made in a video mode should survive.
      const leavingPhotoDefaults =
        previousIntent === "photo" &&
        current.aspectRatio === "1:1" &&
        current.audioMode === "silent";

      return leavingPhotoDefaults
        ? { ...current, aspectRatio: "9:16", audioMode: "native_audio" }
        : current;
    });
  }

  useEffect(() => {
    applyIntent(initialCreationIntent ?? intentFromSearch() ?? "website");
    const handleIntent = (event: Event) => {
      const intent = (event as CustomEvent<CreationIntent>).detail;
      if (intent) applyIntent(intent, true);
    };
    const handleHistoryIntent = () => {
      if (initialCreationIntent) return;
      applyIntent(intentFromSearch() ?? "website");
    };
    window.addEventListener("aiwebvideo:creation-intent", handleIntent);
    window.addEventListener("popstate", handleHistoryIntent);
    return () => {
      window.removeEventListener("aiwebvideo:creation-intent", handleIntent);
      window.removeEventListener("popstate", handleHistoryIntent);
    };
  }, [initialCreationIntent]);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );
  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews],
  );

  useEffect(() => {
    if (!settingsOpen) return;
    const frame = window.requestAnimationFrame(() => {
      settingsPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [settingsOpen, activeMode]);

  function addFiles(list: FileList | File[] | null) {
    if (!list || !list.length) return;
    const accepted: File[] = [];
    let nextError: string | null = null;
    for (const file of Array.from(list)) {
      if (!ACCEPTED_IMAGES.includes(file.type)) {
        nextError = "Use JPEG, PNG, or WEBP reference images.";
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        nextError = `${file.name} is larger than 10MB.`;
        continue;
      }
      accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted].slice(0, 10));
    if (files.length + accepted.length > 10) nextError = "You can attach up to 10 reference images.";
    setError(nextError);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    addFiles(event.dataTransfer.files);
  }

  function updateCustomDuration(value: string) {
    setCustomDurationSelected(true);
    const cleaned = value.replace(/[^0-9]/g, "");
    setCustomDurationText(cleaned);
    if (!cleaned) return;
    const raw = Number(cleaned);
    if (!Number.isFinite(raw)) return;
    setSettings((current) => ({ ...current, durationSeconds: normalizeDuration(raw) }));
  }

  function commitCustomDuration() {
    setCustomDurationSelected(true);
    const raw = Number(customDurationText);
    if (!customDurationText.trim() || !Number.isFinite(raw)) {
      setCustomDurationText("");
      return;
    }
    const normalized = normalizeDuration(raw);
    setCustomDurationText(String(normalized));
    setSettings((current) => ({ ...current, durationSeconds: normalized }));
  }

  function nudgeCustomDuration(direction: -1 | 1) {
    setCustomDurationSelected(true);
    const base = Number(customDurationText || (typeof settings.durationSeconds === "number" ? settings.durationSeconds : estimateSeconds));
    const next = normalizeDuration((Number.isFinite(base) ? base : 8) + direction);
    setCustomDurationText(String(next));
    setSettings((current) => ({ ...current, durationSeconds: next }));
  }

  function closeSettingsAndReturnToGenerate() {
    setSettingsOpen(false);

    const returnToCreatorTop = () => {
      // On the landing page return to the top of the creator so the user
      // sees the URL, prompt and primary action together again. In Workspace,
      // return to the primary fields inside its own fixed-height scroller.
      const isWorkspace = window.location.pathname === "/dashboard";
      const target = isWorkspace
        ? (primaryFieldsRef.current ?? composerRootRef.current ?? generateButtonRef.current)
        : (composerRootRef.current ?? primaryFieldsRef.current ?? generateButtonRef.current);
      if (!target) return;

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

      // 1) Reset the creator's own vertical scroller first. This is essential
      // on the public landing page, where the tall Smart Settings panel lives
      // inside a nested overflow container.
      let parent = target.parentElement;
      let innerScroller: HTMLElement | null = null;
      while (parent) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          parent.scrollHeight > parent.clientHeight + 8
        ) {
          innerScroller = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (innerScroller) {
        const targetRect = target.getBoundingClientRect();
        const containerRect = innerScroller.getBoundingClientRect();
        const targetInsideScroller = Math.max(
          0,
          innerScroller.scrollTop + targetRect.top - containerRect.top - 10,
        );
        innerScroller.scrollTo({ top: targetInsideScroller, behavior });
      }

      // 2) Landing/studio pages also have the document itself as a scroller.
      // Put the Website URL / prompt block directly below the sticky navbar.
      // On Workspace, the page is fixed-height and only the internal creator
      // should move, so deliberately leave window.scrollY untouched there.
      if (!isWorkspace) {
        window.setTimeout(() => {
          const liveTarget = composerRootRef.current ?? primaryFieldsRef.current ?? generateButtonRef.current;
          if (!liveTarget) return;
          const stickyHeaderOffset = window.matchMedia?.("(max-width: 767px)").matches ? 64 : 82;
          const pageTop = Math.max(
            0,
            window.scrollY + liveTarget.getBoundingClientRect().top - stickyHeaderOffset,
          );
          window.scrollTo({ top: pageTop, behavior });
        }, 35);
      }

      // Focus is useful for keyboard users, but prevent it from undoing the
      // exact scroll position we just calculated.
      generateButtonRef.current?.focus({ preventScroll: true });
    };

    // Wait until React has removed the expanded settings panel, then correct
    // the position twice. The second pass handles mobile/Safari layout settling.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        returnToCreatorTop();
        window.setTimeout(returnToCreatorTop, 120);
      });
    });
  }

  function submit() {
    if (disabled) return;
    if (activeMode === "website") {
      const direction = brief.trim();
      if (!url.trim()) {
        setError("Enter the public website URL you want to turn into a video.");
        return;
      }
      if (!direction) {
        setError("Tell AiWebVideo what the video should communicate before generating.");
        websiteBriefRef.current?.focus();
        return;
      }
      try {
        const normalized = normalizeWebsiteUrl(url);
        setError(null);
        void onSubmit(normalized, direction, settings, files);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Enter a valid public website URL.");
      }
      return;
    }

    const isProduct = activeMode === "photo" || activeMode === "product-video";
    const activePrompt = isProduct ? brief.trim() : prompt.trim();
    if (!activePrompt) {
      setError(
        activeMode === "scenario"
          ? "Describe the talking scene you want to create before generating."
          : activeMode === "photo"
            ? "Describe the product-photo campaign you want before generating."
            : activeMode === "product-video"
              ? "Describe how you want the product video to look and move before generating."
              : "Describe the video you want to create before generating.",
      );
      studioPromptRef.current?.focus();
      return;
    }
    if (isProduct && files.length === 0) {
      setError("Attach at least one real product or reference photo.");
      return;
    }

    const resolvedDuration = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
    setError(null);
    void onStudioSubmit({
      studioKind: isProduct ? "product" : activeMode === "scenario" ? "scenario" : "idea",
      prompt: activePrompt,
      files,
      mode: activeMode === "photo" ? "photos" : activeMode === "product-video" ? "video" : "custom",
      durationSeconds: activeMode === "photo" ? 8 : resolvedDuration,
      aspectRatio: settings.aspectRatio,
      outputQuality: settings.outputQuality,
      audioMode: activeMode === "photo" ? "silent" : settings.audioMode,
    });
  }

  const submitDisabled =
    disabled ||
    (activeMode === "website"
      ? !url.trim() || !brief.trim()
      : activeMode === "photo" || activeMode === "product-video"
        ? files.length === 0 || !brief.trim()
        : !prompt.trim());

  const isVideoMode = activeMode !== "photo";
  const isProductMode = activeMode === "photo" || activeMode === "product-video";
  const durationSummary =
    settings.durationSeconds === "auto" ? "8s" : `${settings.durationSeconds}s`;
  const formatSummary =
    settings.aspectRatio === "9:16" ? "Portrait" : settings.aspectRatio === "16:9" ? "Wide" : "Square";
  const audioSummary =
    settings.audioMode === "voice_music"
      ? `Narration · ${settings.narrationLanguage.toUpperCase()}`
      : settings.audioMode === "native_audio"
        ? "Scene audio"
        : settings.audioMode === "music_only"
          ? "Music only"
          : "Silent";
  const estimateSeconds =
    activeMode === "photo"
      ? 8
      : settings.durationSeconds === "auto"
        ? 8
        : settings.durationSeconds;
  const exactCredits =
    activeMode === "photo"
      ? estimateRenderCredits("photos", true, 8, "1080p")
      : estimateRenderCredits(
          "video",
          settings.audioMode !== "voice_music",
          estimateSeconds,
          settings.outputQuality,
        );
  const creditSummary = `${exactCredits} credits`;
  const createLabel =
    activeMode === "website"
      ? "Create website campaign"
      : activeMode === "video"
        ? "Create AI video"
        : activeMode === "photo"
          ? "Create product photos"
          : activeMode === "product-video"
            ? "Create product video"
            : "Create talking scene";

  return (
    <div
      ref={composerRootRef}
      className={`creator-composer relative overflow-hidden ${compactLayout ? "rounded-[22px]" : "rounded-[30px]"} border bg-[#151027]/95 ${compactLayout ? "shadow-[0_26px_80px_-50px_rgba(139,92,246,.72)]" : "shadow-[0_38px_120px_-48px_rgba(139,92,246,.8)]"} backdrop-blur-2xl transition ${dragging ? "border-mint/60 ring-2 ring-mint/15" : "border-white/10"}`}
      onPaste={(event) => {
        if (disabled) return;
        const directFiles = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/"));
        const itemFiles = directFiles.length
          ? []
          : Array.from(event.clipboardData.items ?? [])
              .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => Boolean(file));
        const pastedImages = directFiles.length ? directFiles : itemFiles;
        if (!pastedImages.length) return;
        event.preventDefault();
        addFiles(pastedImages);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="pointer-events-none absolute inset-x-16 -top-24 h-44 rounded-full bg-violet/20 blur-3xl" />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-mint/30 bg-panel px-6 py-5 text-center shadow-2xl">
            <Paperclip className="mx-auto text-mint" size={22} />
            <p className="mt-2 text-sm font-semibold text-white">Drop references here</p>
            <p className="mt-1 text-[11px] text-text-dim">JPEG, PNG or WEBP · up to 10MB each</p>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGES.join(",")}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className={`relative border-b border-white/[.08] ${compactLayout ? "p-2" : "p-2.5 sm:p-3"}`}>
        <div className="chat-scroll flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Creation mode">
          {CREATION_MODES.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeMode === id}
              onClick={() => applyIntent(id, true)}
              className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-[11px] font-semibold transition sm:px-4 sm:text-xs ${
                activeMode === id ? "bg-mint text-[#10231f] shadow-[0_10px_26px_-18px_rgba(114,255,222,.9)]" : "text-text-muted hover:bg-mint/[.08] hover:text-white"
              }`}
            >
              <Icon size={15} className={activeMode === id ? "text-[#10231f]" : ""} />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{short}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`relative ${compactLayout ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
        {!compactLayout && <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-base font-semibold text-white">
              {activeMode === "website"
                ? "Create a video from your website"
                : activeMode === "video"
                  ? "Create an AI video"
                  : activeMode === "photo"
                    ? "Create product photos"
                    : activeMode === "product-video"
                      ? "Create a product video"
                      : "Create a talking scene"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
              {activeMode === "website"
                ? "Paste a link, describe the goal, and AI builds the campaign."
                : activeMode === "video"
                  ? "Describe what you want. Add references only if you need them."
                  : activeMode === "photo"
                    ? "Add your product photo and choose the look."
                    : activeMode === "product-video"
                      ? "Add your product photo and describe the motion."
                      : "Describe who is speaking and what should happen."}
            </p>
          </div>

        </div>}

        {compactLayout && activeMode === "website" && (
          <div ref={primaryFieldsRef} className="space-y-4 scroll-mt-4">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-mint/35 bg-mint/[.10] font-utility text-[10px] text-mint">1</span>
                Website URL
              </span>
              <div className="creator-field flex items-center gap-3 rounded-2xl border border-mint/35 bg-[#0b0818] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_10px_34px_-28px_rgba(52,217,196,.8)] transition focus-within:border-mint/75 focus-within:ring-2 focus-within:ring-mint/15">
                <span className="globe-orbit flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mint/20 bg-mint/[.08] text-mint" aria-hidden="true">
                  <Globe2 size={17} />
                </span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      websiteBriefRef.current?.focus();
                    }
                  }}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="Paste your website URL — example.com"
                  disabled={disabled}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base font-medium text-white outline-none placeholder:font-normal placeholder:text-white/45 sm:text-[15px]"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet/35 bg-violet/[.10] font-utility text-[10px] text-violet">2</span>
                Tell AI what to highlight <span className="text-pink">*</span>
              </span>
              <textarea
                ref={websiteBriefRef}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: Show the best products, highlight the main benefits, and finish with a strong call to action."
                rows={3}
                disabled={disabled}
                className="creator-field min-h-[92px] w-full resize-none rounded-2xl border border-violet/35 bg-[#0b0818] px-4 py-3 text-base leading-6 text-white outline-none sm:min-h-[104px] sm:py-3.5 sm:text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,.05),0_10px_34px_-28px_rgba(139,92,246,.8)] transition placeholder:text-white/45 focus:border-violet/75 focus:ring-2 focus:ring-violet/15"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setCompactPanel((value) => value === "style" ? null : "style");
                }}
                aria-expanded={compactPanel === "style"}
                className={`creator-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${compactPanel === "style" ? "border-mint/40 bg-mint/[.10] text-white" : "border-white/[.11] bg-white/[.035] text-text-muted hover:border-mint/30 hover:bg-mint/[.07] hover:text-white"}`}
              >
                <Film size={13} className="text-mint" />
                Style: <span className="text-white">{selectedWebsiteRecipe ? WEBSITE_RECIPES.find((recipe) => recipe.mode === selectedWebsiteRecipe)?.label : "Auto"}</span>
                <ChevronDown size={13} className={`transition-transform ${compactPanel === "style" ? "rotate-180" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setCompactPanel((value) => value === "ideas" ? null : "ideas");
                }}
                aria-expanded={compactPanel === "ideas"}
                className={`creator-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${compactPanel === "ideas" ? "border-violet/40 bg-violet/[.10] text-white" : "border-white/[.11] bg-white/[.035] text-text-muted hover:border-violet/30 hover:bg-violet/[.07] hover:text-white"}`}
              >
                <Sparkles size={13} className="text-violet" />
                Ideas
                <ChevronDown size={13} className={`transition-transform ${compactPanel === "ideas" ? "rotate-180" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || files.length >= 10}
                className="creator-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/[.11] bg-white/[.035] px-3 text-[11px] font-semibold text-text-muted transition hover:border-mint/30 hover:bg-mint/[.07] hover:text-white disabled:opacity-40"
              >
                <Paperclip size={13} className="text-mint" />
                {files.length ? `References (${files.length})` : "References"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompactPanel(null);
                  setSettingsOpen((value) => !value);
                }}
                aria-expanded={settingsOpen}
                aria-controls="creator-smart-settings"
                className={`creator-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${settingsOpen ? "border-violet/40 bg-violet/[.10] text-white" : "border-white/[.11] bg-white/[.035] text-text-muted hover:border-violet/30 hover:bg-violet/[.07] hover:text-white"}`}
              >
                <Settings2 size={13} className={settingsOpen ? "text-mint" : "text-violet"} />
                {durationSummary} · {formatSummary} · {settings.outputQuality}
                <ChevronDown size={13} className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {compactPanel === "style" && (
              <div className="rounded-2xl border border-mint/20 bg-mint/[.045] p-2.5">
                <div className="chat-scroll flex gap-2 overflow-x-auto pb-0.5">
                  {WEBSITE_RECIPES.map((recipe) => {
                    const selected = selectedWebsiteRecipe === recipe.mode;
                    return (
                      <button
                        key={recipe.mode}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          if (selected) {
                            setSelectedWebsiteRecipe(null);
                            setSettings((current) => ({ ...current, mode: "video" }));
                          } else {
                            setSelectedWebsiteRecipe(recipe.mode);
                            setSettings((current) => ({ ...current, mode: recipe.mode }));
                          }
                          setCompactPanel(null);
                        }}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${selected ? "border-mint/60 bg-mint text-[#10231f]" : "border-white/[.10] bg-black/15 text-text-muted hover:border-mint/35 hover:text-white"}`}
                      >
                        {recipe.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {compactPanel === "ideas" && (
              <div className="rounded-2xl border border-violet/20 bg-violet/[.045] p-2.5">
                <div className="flex flex-wrap gap-2">
                  {QUICK_IDEAS.website.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => { setBrief(idea); setCompactPanel(null); }}
                      className="idea-chip rounded-xl border border-white/[.10] bg-black/15 px-3 py-2 text-[11px] font-medium text-text-muted transition hover:border-violet/35 hover:text-white"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div className="chat-scroll flex gap-2 overflow-x-auto pb-1">
                {previews.map((preview, index) => (
                  <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="group relative w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                    <div className="relative h-16 overflow-hidden">
                      <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-pink" aria-label={`Remove ${preview.file.name}`}>
                        <X size={11} />
                      </button>
                    </div>
                    <p className="truncate px-2 py-1.5 text-[9px] text-text-dim" title={preview.file.name}>{preview.file.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!compactLayout && activeMode === "website" && (
          <div ref={primaryFieldsRef} className="space-y-3 scroll-mt-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text-primary">Website URL</span>
              <div className="creator-field flex items-center gap-3 rounded-2xl border border-mint/30 bg-[#0b0818] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition">
                <span className="globe-orbit flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-mint/25 bg-mint/[.08] text-mint" aria-hidden="true">
                  <Globe2 size={17} />
                </span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://yourwebsite.com"
                  disabled={disabled}
                  className="h-14 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-text-dim sm:text-sm"
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text-primary">What should the video communicate? <span className="text-pink">Required</span></span>
              <textarea
                ref={websiteBriefRef}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Example: Show the product, highlight the main benefits, and end with a strong call to action."
                rows={3}
                disabled={disabled}
                className="creator-field w-full resize-none rounded-2xl border border-violet/30 bg-[#0b0818] px-4 py-3 text-base leading-relaxed text-white outline-none transition placeholder:text-white/40 sm:text-sm"
              />
            </label>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-text-dim">Style · optional</p>

              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" role="group" aria-label="Optional creative recipe">
                {WEBSITE_RECIPES.map((recipe) => {
                  const selected = selectedWebsiteRecipe === recipe.mode;
                  return (
                    <button
                      key={recipe.mode}
                      type="button"
                      title={selected ? `Remove ${recipe.label} recipe` : recipe.helper}
                      aria-pressed={selected}
                      onClick={() => {
                        if (selected) {
                          setSelectedWebsiteRecipe(null);
                          setSettings((current) => ({ ...current, mode: "video" }));
                          return;
                        }
                        setSelectedWebsiteRecipe(recipe.mode);
                        setSettings((current) => ({ ...current, mode: recipe.mode }));
                      }}
                      className={`group relative min-h-10 rounded-xl border px-2 py-2 text-[9px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 ${
                        selected
                          ? "border-mint/60 bg-mint text-[#10231f] shadow-[0_10px_28px_-18px_rgba(114,255,222,.75)]"
                          : "border-mint/15 bg-mint/[.035] text-text-dim hover:border-mint/40 hover:bg-mint/[.09] hover:text-white"
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {recipe.label}
                        {selected && <X size={10} className="text-[#10231f]/70" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[.10em] text-text-dim"><Sparkles size={11} className="text-mint" /> Try an idea</span>
              {QUICK_IDEAS.website.map((idea) => (
                <button key={idea} type="button" onClick={() => setBrief(idea)} className="idea-chip rounded-full border border-mint/15 bg-mint/[.045] px-2.5 py-1.5 text-[9px] font-medium text-text-muted transition hover:border-mint/45 hover:bg-mint/[.10] hover:text-white">{idea}</button>
              ))}
            </div>
          </div>
        )}

        {(activeMode === "video" || activeMode === "scenario") && (
          <div ref={primaryFieldsRef} className="scroll-mt-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text-primary">
                {activeMode === "scenario" ? "Describe the scene" : "Describe your video"} <span className="text-pink">Required</span>
              </span>
              <textarea
                ref={studioPromptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  activeMode === "scenario"
                    ? "Example: Two founders explain the product in a bright studio."
                    : "Example: A cinematic product launch with a strong opening and clean final brand shot."
                }
                rows={compactLayout ? 3 : 5}
                disabled={disabled}
                className="creator-field w-full resize-none rounded-2xl border border-white/[.16] bg-[#0b0818] px-4 py-3 text-base leading-relaxed text-white outline-none transition placeholder:text-white/40 sm:text-sm"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[.10em] text-text-dim"><Sparkles size={11} className="text-mint" /> Try an idea</span>
              {QUICK_IDEAS[activeMode].map((idea) => (
                <button key={idea} type="button" onClick={() => setPrompt(idea)} className="idea-chip rounded-full border border-mint/15 bg-mint/[.045] px-2.5 py-1.5 text-[9px] font-medium text-text-muted transition hover:border-mint/45 hover:bg-mint/[.10] hover:text-white">{idea}</button>
              ))}
            </div>
          </div>
        )}

        {isProductMode && (
          <div ref={primaryFieldsRef} className="scroll-mt-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-text-primary">
                {activeMode === "photo" ? "Choose the photo style" : "Describe the product video"} <span className="text-pink">Required</span>
              </span>
              <textarea
                ref={studioPromptRef}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder={
                  activeMode === "photo"
                    ? "Example: Bright luxury studio, soft light, realistic product details."
                    : "Example: Slow cinematic reveal, macro details, premium hero ending."
                }
                rows={compactLayout ? 3 : 4}
                disabled={disabled}
                className="creator-field w-full resize-none rounded-2xl border border-white/[.16] bg-[#0b0818] px-4 py-3 text-base leading-relaxed text-white outline-none transition placeholder:text-white/40 sm:text-sm"
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[.10em] text-text-dim"><Sparkles size={11} className="text-mint" /> Try an idea</span>
              {QUICK_IDEAS[activeMode].map((idea) => (
                <button key={idea} type="button" onClick={() => setBrief(idea)} className="idea-chip rounded-full border border-mint/15 bg-mint/[.045] px-2.5 py-1.5 text-[9px] font-medium text-text-muted transition hover:border-mint/45 hover:bg-mint/[.10] hover:text-white">{idea}</button>
              ))}
            </div>
          </div>
        )}

        {compactLayout ? (
          activeMode === "website" ? null : (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || files.length >= 10}
                className="creator-secondary-button inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[.10] bg-white/[.035] px-2.5 text-[10px] font-semibold text-text-muted transition hover:border-mint/35 hover:bg-mint/[.08] hover:text-white disabled:opacity-40"
              >
                <Paperclip size={13} className="text-mint" />
                {files.length ? `References (${files.length})` : "Add references"}
              </button>
              <span className="text-[9px] text-text-dim">Optional</span>
            </div>
            {previews.length > 0 && (
              <div className="chat-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
                {previews.map((preview, index) => (
                  <div
                    key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                    className="group relative w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black"
                  >
                    <div className="relative h-14 overflow-hidden">
                      <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-pink"
                        aria-label={`Remove ${preview.file.name}`}
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <p className="truncate px-1.5 py-1 text-[8px] text-text-dim" title={preview.file.name}>{preview.file.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          )
        ) : (
          <div className="mt-3 rounded-2xl border border-white/[.07] bg-black/15 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || files.length >= 10}
              className="creator-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border border-mint/30 bg-mint/[.08] px-3 text-xs font-semibold text-white transition hover:border-mint/60 hover:bg-mint/[.16] disabled:opacity-40"
            >
              <Paperclip size={15} className="text-mint" />
              {files.length ? "Attach more" : "Attach references"}
            </button>
            <p className="text-[10px] leading-4 text-text-dim">
              {isProductMode
                ? "Add your real product photos"
                : "Optional references for a more exact result"}
            </p>
          </div>
          {previews.length > 0 && (
            <div className="chat-scroll mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {previews.map((preview, index) => (
                <div
                  key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                  className="group relative w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black"
                >
                  <div className="relative h-16 overflow-hidden">
                    <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white hover:bg-pink"
                      aria-label={`Remove ${preview.file.name}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[9px] font-medium text-text-muted" title={preview.file.name}>{preview.file.name}</p>
                    <p className="mt-0.5 text-[8px] text-text-dim">{fileSize(preview.file.size)} · ready</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {!compactLayout && <div className="mt-3 rounded-2xl border border-white/[.08] bg-[linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.02))] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-white">Your setup</p>
              <p className="mt-1 text-[10px] leading-5 text-text-dim">
                {`${durationLabel(estimateSeconds)} · ${settings.outputQuality} · ${isVideoMode ? audioSummary : "Silent"}`}
              </p>
            </div>
            {showCreditPricing && <span className="rounded-full border border-mint/20 bg-mint/10 px-2.5 py-1 font-utility text-[10px] text-mint">{creditSummary}</span>}
          </div>
        </div>}

        {error && (
          <p role="alert" className="mt-2 rounded-xl border border-pink/20 bg-pink/5 px-3 py-2 text-xs text-pink">{error}</p>
        )}

        {compactLayout && activeMode === "website" ? (
          <button
            ref={generateButtonRef}
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="premium-button creator-primary-button mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-signature px-5 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{landingWebsitePreview ? "Continue to video" : createLabel}</span>
            {showCreditPricing && <span className="rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[10px] font-semibold text-white/90">{creditSummary}</span>}
            <ArrowRight size={16} className="cta-arrow" />
          </button>
        ) : (
        <div className={`${compactLayout ? "mt-3" : "mt-4"} flex flex-col gap-2.5 sm:flex-row sm:items-stretch`}>
          <button
            type="button"
            onClick={() => { setCompactPanel(null); setSettingsOpen((value) => !value); }}
            className={`creator-secondary-button group flex ${compactLayout ? "min-h-11 px-3 sm:min-w-[220px]" : "min-h-12 px-4 sm:min-w-[245px]"} items-center justify-between gap-3 rounded-xl border text-left transition ${settingsOpen ? "border-violet/40 bg-violet/10 text-white" : "border-white/10 bg-white/[.035] text-text-muted hover:bg-white/[.07] hover:text-white"}`}
            aria-expanded={settingsOpen}
            aria-controls="creator-smart-settings"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Settings2 size={15} className={settingsOpen ? "text-mint" : ""} />
              <span>
                <span className={`block font-semibold ${compactLayout ? "text-[11px]" : "text-xs"}`}>Smart settings</span>
                <span className="mt-0.5 block truncate text-[9px] font-medium text-text-dim">
                  {isVideoMode ? `${durationSummary} · ${formatSummary} · ${settings.outputQuality}` : `${formatSummary} · ${settings.outputQuality}`}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full bg-mint/10 px-2 py-0.5 font-utility text-[9px] text-mint">
                {settingsOpen ? "OPEN" : "EDIT"}
              </span>
              <ChevronDown size={14} className={`transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
            </span>
          </button>
          <button
            ref={generateButtonRef}
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className={`premium-button creator-primary-button flex ${compactLayout ? "min-h-11" : "min-h-12"} flex-1 items-center justify-center gap-2 rounded-xl bg-signature px-5 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <span>{landingWebsitePreview && activeMode === "website" ? "Continue to video" : createLabel}</span>
            {showCreditPricing && <span className="rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[10px] font-semibold text-white/90">{creditSummary}</span>}
            <ArrowRight size={15} className="cta-arrow" />
          </button>
        </div>
        )}

        {settingsOpen && (
          <div
            id="creator-smart-settings"
            ref={settingsPanelRef}
            className="mt-3 scroll-mt-4 rounded-2xl border border-mint/20 bg-[#0f0b1d]/95 p-3.5 shadow-[0_24px_70px_-36px_rgba(52,217,196,.75)] sm:p-4"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-white/[.07] pb-3">
              <div>
                <p className="text-xs font-semibold text-white">Production controls</p>
                <p className="mt-1 text-[10px] leading-relaxed text-text-dim">
                  Choose an exact duration and delivery settings before generation.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[9px] font-semibold text-text-muted">
                {isVideoMode && <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1">{durationSummary}</span>}
                <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1">{settings.aspectRatio}</span>
                <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1">{settings.outputQuality}</span>
                {isVideoMode && <span className="rounded-full border border-white/10 bg-white/[.035] px-2.5 py-1">{audioSummary}</span>}
                {showCreditPricing && <span className="rounded-full border border-mint/15 bg-mint/[.08] px-2.5 py-1 text-mint">{creditSummary}</span>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {isVideoMode && (
                <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-text-primary">Duration</p>
                    <span className="text-[9px] text-text-dim">Any whole second · 8s–2m 24s continuous</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const currentDuration = typeof settings.durationSeconds === "number" ? settings.durationSeconds : 8;
                        setCustomDurationSelected(true);
                        setCustomDurationText(String(currentDuration));
                        setSettings((current) => ({ ...current, durationSeconds: currentDuration }));
                        window.requestAnimationFrame(() => {
                          customDurationInputRef.current?.focus();
                          customDurationInputRef.current?.select();
                        });
                      }}
                      className={optionClass(customDurationSelected)}
                      aria-controls="custom-duration-control"
                      aria-expanded={customDurationSelected}
                    >
                      Custom
                    </button>
                    {DURATION_PRESETS.map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        onClick={() => {
                          setCustomDurationSelected(false);
                          setCustomDurationText("");
                          setSettings((current) => ({ ...current, durationSeconds: duration }));
                        }}
                        className={optionClass(!customDurationSelected && settings.durationSeconds === duration)}
                      >
                        {duration}s
                      </button>
                    ))}
                  </div>
                  {showCreditPricing && <p className="mt-2 text-[9px] leading-relaxed text-text-dim">Exact duration cost: {`${estimateRenderCredits("video", settings.audioMode !== "voice_music", estimateSeconds, settings.outputQuality)} credits`}</p>}
                  {customDurationSelected && (
                    <div id="custom-duration-control" className="mt-2 rounded-2xl border border-mint/20 bg-mint/[.035] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="min-w-0 text-[10px] font-semibold text-white">Custom duration</span>
                        <span className="text-[9px] text-text-dim">8–144 seconds · 1-second control</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => nudgeCustomDuration(-1)}
                          className="creator-icon-button flex h-11 w-11 items-center justify-center rounded-xl border border-mint/20 bg-mint/[.06] text-lg font-bold text-mint transition hover:border-mint/55 hover:bg-mint/[.14]"
                          aria-label="Decrease duration by 1 second"
                        >
                          −
                        </button>
                        <div className="relative flex-1">
                          <input
                            ref={customDurationInputRef}
                            type="text"
                            inputMode="numeric"
                            value={customDurationText}
                            placeholder={String(estimateSeconds)}
                            onChange={(event) => updateCustomDuration(event.target.value)}
                            onBlur={commitCustomDuration}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitCustomDuration();
                                event.currentTarget.blur();
                              }
                            }}
                            className="h-12 w-full rounded-xl border border-mint/25 bg-black/25 px-4 pr-12 text-center text-lg font-bold tracking-wide text-white outline-none transition focus:border-mint/70 focus:ring-2 focus:ring-mint/15"
                            aria-label="Custom video duration in seconds"
                          />
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[.14em] text-text-dim">sec</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => nudgeCustomDuration(1)}
                          className="creator-icon-button flex h-11 w-11 items-center justify-center rounded-xl border border-mint/20 bg-mint/[.06] text-lg font-bold text-mint transition hover:border-mint/55 hover:bg-mint/[.14]"
                          aria-label="Increase duration by 1 second"
                        >
                          +
                        </button>
                      </div>
                      <p className="mt-2 text-[9px] leading-relaxed text-text-dim">Choose the exact whole-second duration you want. The credit quote above updates immediately.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <p className="mb-2 text-[11px] font-semibold text-text-primary">Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ["9:16", Smartphone, "Portrait"],
                    ["16:9", Monitor, "Wide"],
                    ["1:1", ImageIcon, "Square"],
                  ] as const).map(([ratio, Icon, label]) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, aspectRatio: ratio }))}
                      className={optionClass(settings.aspectRatio === ratio)}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-text-dim">
                  Portrait for Reels/TikTok · Wide for landscape · Square for 1:1 social posts.
                </p>
              </div>

              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <p className="mb-2 text-[11px] font-semibold text-text-primary">Quality</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["1080p", "4k"] as const).map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, outputQuality: quality }))}
                      className={optionClass(settings.outputQuality === quality)}
                    >
                      <span>{quality === "4k" ? (estimateSeconds > 8 ? "4K mastered" : "4K native") : (estimateSeconds > 8 ? "1080p master" : "1080p native")}</span>
                    </button>
                  ))}
                </div>
                {isVideoMode && <p className="mt-2 text-[9px] text-text-dim">{showCreditPricing ? <>At {durationLabel(estimateSeconds)}, {settings.outputQuality === "4k" ? `${estimateSeconds * 5} base video credits` : `${estimateSeconds * 4} base video credits`} before narration. </> : null}{estimateSeconds > 8 ? "Long films use a continuous provider source, then the final film is mastered to your selected delivery size." : "The 8-second provider generation can be native at the selected size."}</p>}
              </div>

              {isVideoMode && (
                <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                  <p className="mb-2 text-[11px] font-semibold text-text-primary">Audio</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, audioMode: "native_audio" }))}
                      className={optionClass(settings.audioMode === "native_audio")}
                    >
                      Scene audio
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, audioMode: "voice_music" }))}
                      className={optionClass(settings.audioMode === "voice_music")}
                    >
                      <Volume2 size={14} /> Narration
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, audioMode: "music_only" }))}
                      className={optionClass(settings.audioMode === "music_only")}
                    >
                      Music only
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, audioMode: "silent" }))}
                      className={optionClass(settings.audioMode === "silent")}
                    >
                      Silent
                    </button>
                  </div>
                  <p className="mt-2 text-[9px] text-text-dim">{showCreditPricing ? "Narration adds 6 credits. Scene audio, music only, and silent keep the base video price." : "Choose narration, scene audio, music only, or silent delivery."}</p>
                  {settings.audioMode === "voice_music" && (
                    <label className="mt-2 block">
                      <span className="mb-1.5 block text-[10px] font-semibold text-text-muted">Narration language</span>
                      <select
                        value={settings.narrationLanguage}
                        onChange={(event) => setSettings((current) => ({ ...current, narrationLanguage: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#151027] px-3 text-xs font-semibold text-white outline-none focus:border-mint/60"
                      >
                        {NARRATION_LANGUAGES.map(([code, label]) => (
                          <option key={code} value={code}>{label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={closeSettingsAndReturnToGenerate}
                className="creator-secondary-button min-h-11 rounded-xl border border-mint/25 bg-mint/[.07] px-4 text-xs font-semibold text-white transition hover:border-mint/55 hover:bg-mint/[.14]"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {!compactLayout && <p className="mt-4 text-center text-[9px] text-text-dim">Your generation stays in this conversation.</p>}
      </div>
    </div>
  );
}
