import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Film,
  Globe2,
  Image as ImageIcon,
  House,
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
import {
  getIdeasForIntent,
  referenceHintForIdea,
  type CreativeIdea,
  type IdeaContext,
} from "@/lib/creativeIdeas";
import { trackStudioEvent } from "@/lib/studio-api";
import type { AudioMode, JobMode } from "./types";

export type CreationIntent =
  | "website"
  | "video"
  | "photo"
  | "product-video"
  | "scenario"
  | "interior";

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
  studioKind: "product" | "idea" | "scenario" | "interior";
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
  { id: "interior" as const, label: "Interior Design", short: "Interior", icon: House },
] as const;

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DURATION_PRESETS = [8, 16, 24, 32] as const;

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

function normalizeDuration(value: number) {
  if (!Number.isFinite(value)) return 8;
  return Math.max(8, Math.min(144, Math.round(value)));
}

function intentFromSearch(): CreationIntent | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("create");
  if (value === "photo" || value === "product") return "photo";
  if (value === "product-video") return "product-video";
  if (value === "scenario" || value === "talking") return "scenario";
  if (value === "interior" || value === "interior-design" || value === "architecture") return "interior";
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

function optionClass(active: boolean) {
  return `flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition ${
    active
      ? "border-mint/55 bg-mint text-[#10231f]"
      : "border-white/10 bg-white/[.035] text-text-muted hover:border-mint/30 hover:bg-mint/[.07] hover:text-white"
  }`;
}

function controlClass(active: boolean) {
  return `creator-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition sm:text-[11px] ${
    active
      ? "border-violet/40 bg-violet/[.10] text-white"
      : "border-white/[.10] bg-white/[.035] text-text-muted hover:border-violet/30 hover:bg-violet/[.07] hover:text-white"
  }`;
}

function MasterIdeas({
  ideas,
  context,
  selectedId,
  onSelect,
}: {
  ideas: CreativeIdea[];
  context: IdeaContext;
  selectedId: string | null;
  onSelect: (idea: CreativeIdea) => void;
}) {
  return (
    <div className="chat-scroll flex gap-2 overflow-x-auto pb-1">
      {ideas.map((idea) => {
        const selected = selectedId === idea.id;
        const hint = referenceHintForIdea(idea, context);
        return (
          <button
            key={idea.id}
            type="button"
            onClick={() => onSelect(idea)}
            className={`group w-[188px] shrink-0 rounded-xl border px-3 py-2.5 text-left transition sm:w-[205px] ${
              selected
                ? "border-violet/55 bg-violet/[.14]"
                : "border-white/[.09] bg-black/15 hover:border-violet/35 hover:bg-violet/[.055]"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate rounded-full border border-violet/20 bg-violet/[.07] px-2 py-0.5 font-utility text-[7px] uppercase tracking-[.1em] text-violet">
                {idea.category}
              </span>
              {selected ? <Check size={12} className="shrink-0 text-mint" /> : <ArrowRight size={11} className="shrink-0 text-white/25 transition group-hover:text-violet" />}
            </span>
            <span className="mt-2 block min-h-8 text-[10px] font-semibold leading-4 text-white sm:text-[11px]">
              {idea.displayText}
            </span>
            {hint && <span className="mt-1 block text-[8px] leading-3.5 text-amber-200/70">Add a reference for best accuracy</span>}
          </button>
        );
      })}
    </div>
  );
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
  showCreditPricing?: boolean;
  landingWebsitePreview?: boolean;
  onIntentRequest?: (intent: CreationIntent) => boolean | void;
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
  const [selectedWebsiteRecipe, setSelectedWebsiteRecipe] = useState<WebsiteProductionMode | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<CreativeIdea | null>(null);
  const [interiorOutput, setInteriorOutput] = useState<"images" | "video">("images");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRootRef = useRef<HTMLDivElement>(null);
  const websiteBriefRef = useRef<HTMLTextAreaElement>(null);
  const studioPromptRef = useRef<HTMLTextAreaElement>(null);

  function applyIntent(intent: CreationIntent, userInitiated = false) {
    if (userInitiated && onIntentRequest?.(intent) === false) return;
    const previousIntent = activeModeRef.current;
    activeModeRef.current = intent;
    setActiveMode(intent);
    setSelectedIdea(null);
    setCompactPanel(null);
    setSettingsOpen(false);
    setError(null);
    setSettings((current) => {
      if (intent === "photo" || intent === "interior") return { ...current, aspectRatio: intent === "interior" ? "16:9" : "1:1", audioMode: "silent" };
      const leavingPhotoDefaults = (previousIntent === "photo" || previousIntent === "interior") && current.audioMode === "silent";
      return leavingPhotoDefaults ? { ...current, aspectRatio: "9:16", audioMode: "native_audio" } : current;
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
    const resetDrag = () => {
      dragDepthRef.current = 0;
      setDragging(false);
    };
    window.addEventListener("drop", resetDrag, true);
    window.addEventListener("dragend", resetDrag, true);
    window.addEventListener("blur", resetDrag);
    return () => {
      window.removeEventListener("drop", resetDrag, true);
      window.removeEventListener("dragend", resetDrag, true);
      window.removeEventListener("blur", resetDrag);
    };
  }, []);

  const ideaContext = useMemo<IdeaContext>(() => ({
    websiteUrl: activeMode === "website" ? url : undefined,
    prompt: activeMode === "video" || activeMode === "scenario" ? prompt : brief,
    referenceNames: files.map((file) => file.name),
    hasReferences: files.length > 0,
  }), [activeMode, brief, files, prompt, url]);

  const masterIdeas = useMemo(
    () => getIdeasForIntent(activeMode, ideaContext, 6),
    [activeMode, ideaContext],
  );

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
    dragDepthRef.current = 0;
    setDragging(false);
    if (!disabled) addFiles(event.dataTransfer.files);
  }

  function applyMasterIdea(idea: CreativeIdea) {
    setSelectedIdea(idea);
    if (activeMode === "video" || activeMode === "scenario") setPrompt(idea.masterPrompt);
    else setBrief(idea.masterPrompt);
    setCompactPanel(null);
    setError(null);
    void trackStudioEvent({ event: "idea_clicked", ideaId: idea.id, feature: idea.feature });
    window.requestAnimationFrame(() => {
      if (activeMode === "website") websiteBriefRef.current?.focus();
      else studioPromptRef.current?.focus();
    });
  }

  function toggleIdeas() {
    setSettingsOpen(false);
    setCompactPanel((current) => {
      const next = current === "ideas" ? null : "ideas";
      if (next === "ideas") void trackStudioEvent({ event: "ideas_opened", feature: masterIdeas[0]?.feature });
      return next;
    });
  }

  function submit() {
    if (disabled) return;
    if (selectedIdea) {
      void trackStudioEvent({
        event: "idea_to_generate_conversion",
        ideaId: selectedIdea.id,
        feature: selectedIdea.feature,
        metadata: { mode: activeMode },
      });
    }

    if (activeMode === "website") {
      if (!url.trim()) {
        setError("Enter the public website URL you want to turn into a video.");
        return;
      }
      if (!brief.trim()) {
        setError("Tell AiWebVideo what the video should communicate before generating.");
        websiteBriefRef.current?.focus();
        return;
      }
      try {
        setError(null);
        void onSubmit(normalizeWebsiteUrl(url), brief.trim(), settings, files);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Enter a valid public website URL.");
      }
      return;
    }

    const isProduct = activeMode === "photo" || activeMode === "product-video";
    const isInterior = activeMode === "interior";
    const activePrompt = isProduct || isInterior ? brief.trim() : prompt.trim();
    if (!activePrompt) {
      setError(
        activeMode === "scenario"
          ? "Describe the talking scene you want to create before generating."
          : activeMode === "interior"
            ? "Describe the space, measurements, design direction and output you want before generating."
          : activeMode === "photo"
            ? "Describe the product-photo campaign you want before generating."
            : activeMode === "product-video"
              ? "Describe how you want the product video to look and move before generating."
              : "Describe the video you want to create before generating.",
      );
      studioPromptRef.current?.focus();
      return;
    }
    if ((isProduct || isInterior) && files.length === 0) {
      setError(isInterior ? "Attach at least one clear photo, sketch, plan, elevation, or reference image of the space." : "Attach at least one real product or reference photo.");
      return;
    }

    const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
    setError(null);
    void onStudioSubmit({
      studioKind: isProduct ? "product" : activeMode === "scenario" ? "scenario" : "interior",
      prompt: activePrompt,
      files,
      mode: activeMode === "photo" ? "photos" : activeMode === "product-video" ? "video" : isInterior ? (interiorOutput === "video" ? "custom" : "photos") : "custom",
      durationSeconds: activeMode === "photo" ? 8 : durationSeconds,
      aspectRatio: settings.aspectRatio,
      outputQuality: settings.outputQuality,
      audioMode: activeMode === "photo" || isInterior ? "silent" : settings.audioMode,
    });
  }

  const isProductMode = activeMode === "photo" || activeMode === "product-video";
  const isInteriorMode = activeMode === "interior";
  const isVideoMode = activeMode !== "photo" && (activeMode !== "interior" || interiorOutput === "video");
  const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
  const formatSummary = settings.aspectRatio === "9:16" ? "Portrait" : settings.aspectRatio === "16:9" ? "Wide" : "Square";
  const audioSummary = settings.audioMode === "voice_music"
    ? `Narration · ${settings.narrationLanguage.toUpperCase()}`
    : settings.audioMode === "native_audio"
      ? "Scene audio"
      : settings.audioMode === "music_only"
        ? "Music only"
        : "Silent";
  const exactCredits = activeMode === "photo" || (activeMode === "interior" && interiorOutput === "images")
    ? estimateRenderCredits("photos", true, 8, "1080p")
    : estimateRenderCredits("video", settings.audioMode !== "voice_music", durationSeconds, settings.outputQuality);
  const submitDisabled = disabled || (
    activeMode === "website"
      ? !url.trim() || !brief.trim()
      : isProductMode
        ? files.length === 0 || !brief.trim()
        : isInteriorMode
          ? files.length === 0 || !brief.trim()
          : !prompt.trim()
  );
  const createLabel = activeMode === "website"
    ? "Create website campaign"
    : activeMode === "video"
      ? "Create AI video"
      : activeMode === "photo"
        ? "Create product photos"
        : activeMode === "product-video"
          ? "Create product video"
          : activeMode === "interior"
            ? "Create interior design"
            : "Create talking scene";

  return (
    <div
      ref={composerRootRef}
      className={`creator-composer relative overflow-hidden ${compactLayout ? "rounded-[22px]" : "rounded-[28px]"} border bg-[#151027]/95 shadow-[0_28px_90px_-48px_rgba(139,92,246,.72)] backdrop-blur-2xl transition ${dragging ? "border-mint/60 ring-2 ring-mint/15" : "border-white/10"}`}
      onPaste={(event) => {
        if (disabled) return;
        const pasted = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/"));
        if (!pasted.length) return;
        event.preventDefault();
        addFiles(pasted);
      }}
      onDragEnter={(event) => {
        if (disabled || !Array.from(event.dataTransfer.types ?? []).includes("Files")) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (disabled || !Array.from(event.dataTransfer.types ?? []).includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!dragging) return;
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="pointer-events-none absolute inset-x-16 -top-24 h-44 rounded-full bg-violet/20 blur-3xl" />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGES.join(",")}
        className="hidden"
        onChange={(event) => {
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#0b0818]/90 backdrop-blur-sm">
          <div className="rounded-2xl border border-mint/30 bg-panel px-6 py-5 text-center shadow-2xl">
            <Paperclip className="mx-auto text-mint" size={22} />
            <p className="mt-2 text-sm font-semibold text-white">Drop your references here</p>
            <p className="mt-1 text-[10px] text-text-dim">JPEG, PNG or WEBP · up to 10MB each</p>
          </div>
        </div>
      )}

      <div className={`relative border-b border-white/[.08] ${compactLayout ? "p-2" : "p-2.5 sm:p-3"}`}>
        <div className="chat-scroll flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Creation mode">
          {CREATION_MODES.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeMode === id}
              onClick={() => applyIntent(id, true)}
              className={`flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-semibold transition sm:px-4 sm:text-[11px] ${
                activeMode === id
                  ? "bg-mint text-[#10231f] shadow-[0_10px_26px_-18px_rgba(114,255,222,.9)]"
                  : "text-text-muted hover:bg-mint/[.08] hover:text-white"
              }`}
            >
              <Icon size={14} />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{short}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`relative ${compactLayout ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
        {activeMode === "interior" && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] p-3">
            <div>
              <p className="text-[11px] font-semibold text-white">Interior output</p>
              <p className="mt-0.5 text-[9px] text-text-dim">Images for design review or a continuous walkthrough video.</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
              <button type="button" onClick={() => setInteriorOutput("images")} className={optionClass(interiorOutput === "images")}>Design images</button>
              <button type="button" onClick={() => setInteriorOutput("video")} className={optionClass(interiorOutput === "video")}>Walkthrough video</button>
            </div>
          </div>
        )}

        {!compactLayout && (
          <div className="mb-4">
            <p className="font-display text-base font-semibold text-white">
              {activeMode === "website" ? "Create a video from your website" : activeMode === "video" ? "Create an AI video" : activeMode === "photo" ? "Create product photos" : activeMode === "product-video" ? "Create a product video" : activeMode === "interior" ? "Design an interior" : "Create a talking scene"}
            </p>
            <p className="mt-1 text-[11px] text-text-dim">Describe what you want, then use Ideas only when you want creative inspiration.</p>
          </div>
        )}

        <div className="space-y-3">
          {activeMode === "website" && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-white">Website URL</span>
              <div className="flex items-center gap-3 rounded-2xl border border-mint/30 bg-[#0b0818] px-3 transition focus-within:border-mint/60 focus-within:ring-2 focus-within:ring-mint/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint/[.08] text-mint"><Globe2 size={16} /></span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="Paste your website URL — example.com"
                  disabled={disabled}
                  className="h-13 min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-white/40"
                />
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-white">
              <span>{activeMode === "website" ? "What should the video highlight?" : activeMode === "video" ? "Describe your video" : activeMode === "photo" ? "Describe the product photos" : activeMode === "product-video" ? "Describe the product video" : activeMode === "interior" ? "Describe the space, measurements and design" : "Describe the talking scene"}</span>
              <span className="text-[9px] font-normal text-text-dim">Required</span>
            </span>
            <textarea
              ref={activeMode === "website" ? websiteBriefRef : studioPromptRef}
              value={activeMode === "video" || activeMode === "scenario" ? prompt : brief}
              onChange={(event) => {
                if (activeMode === "video" || activeMode === "scenario") setPrompt(event.currentTarget.value);
                else setBrief(event.currentTarget.value);
              }}
              placeholder={
                activeMode === "website"
                  ? "Example: Show the best products, main benefits, and finish with a strong CTA."
                  : activeMode === "video"
                    ? "Example: A cinematic drone reveal that moves from the city into the location."
                    : activeMode === "photo"
                      ? "Example: Premium ecommerce product photos with soft studio light."
                      : activeMode === "product-video"
                        ? "Example: Slow premium reveal, macro details, strong hero ending."
                        : "Example: Two founders explain the product naturally in a bright studio."
              }
              rows={compactLayout ? 3 : 4}
              disabled={disabled}
              className="creator-field w-full resize-none rounded-2xl border border-white/[.14] bg-[#0b0818] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-violet/55 focus:ring-2 focus:ring-violet/10"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeMode === "website" && (
            <button
              type="button"
              onClick={() => {
                setSettingsOpen(false);
                setCompactPanel((current) => current === "style" ? null : "style");
              }}
              aria-expanded={compactPanel === "style"}
              className={controlClass(compactPanel === "style")}
            >
              <Film size={13} className="text-mint" />
              Style: {selectedWebsiteRecipe ? WEBSITE_RECIPES.find((recipe) => recipe.mode === selectedWebsiteRecipe)?.label : "Auto"}
              <ChevronDown size={12} className={compactPanel === "style" ? "rotate-180" : ""} />
            </button>
          )}

          <button type="button" onClick={toggleIdeas} aria-expanded={compactPanel === "ideas"} className={controlClass(compactPanel === "ideas")}>
            <Sparkles size={13} className="text-violet" />
            Ideas
            {selectedIdea && <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[8px] text-mint">Added</span>}
            <ChevronDown size={12} className={compactPanel === "ideas" ? "rotate-180" : ""} />
          </button>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || files.length >= 10}
            className={controlClass(false)}
          >
            <Paperclip size={13} className="text-mint" />
            {files.length ? `References ${files.length}` : isProductMode ? "Add product photo" : activeMode === "interior" ? "Add space references" : "References"}
          </button>

          <button
            type="button"
            onClick={() => {
              setCompactPanel(null);
              setSettingsOpen((current) => !current);
            }}
            aria-expanded={settingsOpen}
            className={controlClass(settingsOpen)}
          >
            <Settings2 size={13} />
            {isVideoMode ? `${durationSeconds}s · ${formatSummary} · ${settings.outputQuality}` : `${formatSummary} · ${settings.outputQuality}`}
            <ChevronDown size={12} className={settingsOpen ? "rotate-180" : ""} />
          </button>
        </div>

        {compactPanel === "style" && activeMode === "website" && (
          <div className="mt-2 rounded-2xl border border-mint/15 bg-mint/[.035] p-2.5">
            <div className="chat-scroll flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedWebsiteRecipe(null);
                  setSettings((current) => ({ ...current, mode: "video" }));
                  setCompactPanel(null);
                }}
                className={optionClass(!selectedWebsiteRecipe)}
              >
                Auto
              </button>
              {WEBSITE_RECIPES.map((recipe) => (
                <button
                  key={recipe.mode}
                  type="button"
                  title={recipe.helper}
                  onClick={() => {
                    setSelectedWebsiteRecipe(recipe.mode);
                    setSettings((current) => ({ ...current, mode: recipe.mode }));
                    setCompactPanel(null);
                  }}
                  className={optionClass(selectedWebsiteRecipe === recipe.mode)}
                >
                  {recipe.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {compactPanel === "ideas" && (
          <div className="mt-2 rounded-2xl border border-violet/15 bg-violet/[.035] p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-white">Pick a creative direction</p>
                <p className="mt-0.5 text-[8px] text-text-dim">It only fills your prompt. You can change anything before generating.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-mint/15 bg-mint/[.06] px-2 py-1 text-[7px] font-semibold text-mint">FREE</span>
                <button type="button" onClick={() => setCompactPanel(null)} aria-label="Close ideas" className="grid h-7 w-7 place-items-center rounded-lg text-text-dim hover:bg-white/5 hover:text-white"><X size={12} /></button>
              </div>
            </div>
            <MasterIdeas ideas={masterIdeas} context={ideaContext} selectedId={selectedIdea?.id ?? null} onSelect={applyMasterIdea} />
          </div>
        )}

        {previews.length > 0 && (
          <div className="chat-scroll mt-3 flex gap-2 overflow-x-auto pb-1">
            {previews.map((preview, index) => (
              <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="group relative w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black sm:w-24">
                <div className="relative h-14 overflow-hidden sm:h-16">
                  <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-white hover:bg-pink" aria-label={`Remove ${preview.file.name}`}><X size={11} /></button>
                </div>
                <div className="px-2 py-1.5">
                  <p className="truncate text-[8px] text-white/70" title={preview.file.name}>{preview.file.name}</p>
                  <p className="mt-0.5 text-[7px] text-text-dim">{fileSize(preview.file.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {settingsOpen && (
          <div className="mt-3 rounded-2xl border border-white/[.08] bg-[#0f0b1d]/95 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">Generation settings</p>
                <p className="mt-0.5 text-[9px] text-text-dim">Choose the exact delivery format before generation.</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-text-dim hover:bg-white/5 hover:text-white" aria-label="Close settings"><X size={13} /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {isVideoMode && (
                <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-white">Duration</span><span className="text-[8px] text-text-dim">8–144 sec</span></div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {DURATION_PRESETS.map((duration) => (
                      <button key={duration} type="button" onClick={() => setSettings((current) => ({ ...current, durationSeconds: duration }))} className={optionClass(settings.durationSeconds === duration)}>{duration}s</button>
                    ))}
                    <label className="relative">
                      <input
                        type="number"
                        min={8}
                        max={144}
                        step={1}
                        value={durationSeconds}
                        onChange={(event) => setSettings((current) => ({ ...current, durationSeconds: normalizeDuration(Number(event.currentTarget.value)) }))}
                        className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-1 text-center text-[10px] font-semibold text-white outline-none focus:border-violet/45"
                        aria-label="Custom duration in seconds"
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-[8px] text-text-dim">Current: {durationLabel(durationSeconds)}</p>
                </div>
              )}

              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <p className="mb-2 text-[11px] font-semibold text-white">Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ["9:16", Smartphone, "Portrait"],
                    ["16:9", Monitor, "Wide"],
                    ["1:1", ImageIcon, "Square"],
                  ] as const).map(([ratio, Icon, label]) => (
                    <button key={ratio} type="button" onClick={() => setSettings((current) => ({ ...current, aspectRatio: ratio }))} className={optionClass(settings.aspectRatio === ratio)}><Icon size={13} />{label}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                <p className="mb-2 text-[11px] font-semibold text-white">Quality</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["1080p", "4k"] as const).map((quality) => (
                    <button key={quality} type="button" onClick={() => setSettings((current) => ({ ...current, outputQuality: quality }))} className={optionClass(settings.outputQuality === quality)}>{quality === "4k" ? "4K" : "1080p"}</button>
                  ))}
                </div>
              </div>

              {isVideoMode && (
                <div className="rounded-xl border border-white/[.07] bg-white/[.02] p-3">
                  <p className="mb-2 text-[11px] font-semibold text-white">Audio</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={() => setSettings((current) => ({ ...current, audioMode: "native_audio" }))} className={optionClass(settings.audioMode === "native_audio")}>Scene audio</button>
                    <button type="button" onClick={() => setSettings((current) => ({ ...current, audioMode: "voice_music" }))} className={optionClass(settings.audioMode === "voice_music")}><Volume2 size={12} />Narration</button>
                    <button type="button" onClick={() => setSettings((current) => ({ ...current, audioMode: "music_only" }))} className={optionClass(settings.audioMode === "music_only")}>Music only</button>
                    <button type="button" onClick={() => setSettings((current) => ({ ...current, audioMode: "silent" }))} className={optionClass(settings.audioMode === "silent")}>Silent</button>
                  </div>
                  {settings.audioMode === "voice_music" && (
                    <select
                      value={settings.narrationLanguage}
                      onChange={(event) => setSettings((current) => ({ ...current, narrationLanguage: event.currentTarget.value }))}
                      className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#151027] px-3 text-[10px] font-semibold text-white outline-none focus:border-violet/45"
                    >
                      {NARRATION_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  )}
                  <p className="mt-2 text-[8px] text-text-dim">{audioSummary}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl border border-pink/20 bg-pink/5 px-3 py-2 text-xs text-pink">{error}</p>}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {!compactLayout && (
            <div className="flex-1 text-[9px] text-text-dim">
              {isProductMode && !files.length ? "Add a real product photo before generating." : activeMode === "interior" && !files.length ? "Add space references before generating." : `Your setup: ${isVideoMode ? `${durationSeconds}s · ` : ""}${formatSummary} · ${settings.outputQuality}`}
            </div>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="premium-button creator-primary-button flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-signature px-5 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none sm:min-w-[260px]"
          >
            <span>{landingWebsitePreview && activeMode === "website" ? "Continue to video" : createLabel}</span>
            {showCreditPricing && <span className="rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[9px] font-semibold text-white/90">{exactCredits} credits</span>}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
