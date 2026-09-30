import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Film,
  Globe2,
  Image as ImageIcon,
  House,
  Building2,
  Languages,
  Minus,
  Maximize2,
  MessageCircleMore,
  Mic,
  Monitor,
  Music,
  PackageOpen,
  Paperclip,
  Plus,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { normalizeWebsiteUrl } from "@/lib/websiteUrl";
import { CreatorPopover } from "./CreatorPopover";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import { defaultModelFor, modelsFor, publicModel, type PublicModelId } from "@/lib/generationModels";
import {
  getIdeasForIntent,
  referenceHintForIdea,
  type CreativeIdea,
  type IdeaContext,
} from "@/lib/creativeIdeas";
import { trackStudioEvent } from "@/lib/studio-api";
import { extractProductReference, resolveArchitectureLocation } from "@/lib/api-client";
import type { AudioMode, JobMode } from "./types";

export type CreationIntent =
  | "website"
  | "video"
  | "photo"
  | "product-video"
  | "scenario"
  | "interior"
  | "architecture";

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
  modelId: PublicModelId;
}

export interface StudioGenerationRequest {
  studioKind: "product" | "idea" | "scenario" | "interior" | "architecture";
  prompt: string;
  files: File[];
  mode: "photos" | "video" | "custom";
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  audioMode: AudioMode;
  modelId: PublicModelId;
  productUrl?: string;
  productImageUrls?: string[];
  architecture?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_SETTINGS: WebsiteGenerationSettings = {
  mode: "video",
  durationSeconds: 8,
  aspectRatio: "9:16",
  outputQuality: "1080p",
  audioMode: "native_audio",
  narrationLanguage: "en",
  modelId: "cinema-2",
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
  { id: "architecture" as const, label: "Architecture", short: "Architecture", icon: Building2 },
] as const;

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIN_CREATOR_DURATION_SECONDS = 8;
const MAX_CREATOR_DURATION_SECONDS = 60;
const DURATION_PRESETS = [8, 16, 24, 32, 40, 48, 56, 60] as const;
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
  if (!Number.isFinite(value)) return MIN_CREATOR_DURATION_SECONDS;
  return Math.max(MIN_CREATOR_DURATION_SECONDS, Math.min(MAX_CREATOR_DURATION_SECONDS, Math.round(value)));
}

function SiteMeasure({ label, value, onChange, step, min, max = 10000, unit }: {
  label: string; value: string; onChange: (value: string) => void; step: number; min: number; max?: number; unit?: string;
}) {
  const adjust = (direction: -1 | 1) => {
    const current = Number(value.replace(',', '.'));
    const next = Math.min(max, Math.max(min, Number.isFinite(current) && value ? current + direction * step : min));
    onChange(String(Math.round(next * 100) / 100));
  };
  const normalize = () => {
    if (!value) return;
    const parsed = Number(value.replace(',', '.'));
    const rounded = step === 1 ? Math.round(parsed) : Math.round(parsed * 100) / 100;
    onChange(Number.isFinite(parsed) ? String(Math.min(max, Math.max(min, rounded))) : '');
  };
  return <label className="min-w-0 space-y-1.5">
    <span className="block text-[11px] font-medium text-text-muted">{label}</span>
    <span className="flex h-11 min-w-0 items-center rounded-xl border border-white/12 bg-[#0b0818] focus-within:border-violet/60 focus-within:ring-2 focus-within:ring-violet/15">
      <button type="button" onClick={() => adjust(-1)} aria-label={`Decrease ${label}`} disabled={!!value && Number(value) <= min}
        className="grid h-full w-9 shrink-0 place-items-center rounded-l-xl text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-30"><Minus size={13} /></button>
      <input type="text" inputMode={step === 1 ? 'numeric' : 'decimal'} value={value} onBlur={normalize}
        onChange={(event) => { const next = event.target.value.replace(',', '.');
          if ((step === 1 ? /^\d{0,3}$/ : /^\d{0,5}(?:\.\d{0,2})?$/).test(next)) onChange(next); }}
        aria-label={label} placeholder="—" className="w-full min-w-0 bg-transparent text-center text-sm font-medium text-white outline-none placeholder:text-white/25" />
      {unit && <span className="text-[10px] text-text-dim">{unit}</span>}
      <button type="button" onClick={() => adjust(1)} aria-label={`Increase ${label}`} disabled={!!value && Number(value) >= max}
        className="grid h-full w-9 shrink-0 place-items-center rounded-r-xl text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-30"><Plus size={13} /></button>
    </span>
  </label>;
}

function intentFromSearch(): CreationIntent | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("create");
  if (value === "photo" || value === "product") return "photo";
  if (value === "product-video") return "product-video";
  if (value === "scenario" || value === "talking") return "scenario";
  if (value === "interior" || value === "interior-design") return "interior";
  if (value === "architecture") return "architecture";
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
      ? "border-violet/45 bg-violet/[.12] text-white shadow-[0_12px_30px_-24px_rgba(139,92,246,.95)]"
      : "border-white/[.10] bg-white/[.035] text-text-muted hover:border-violet/30 hover:bg-violet/[.07] hover:text-white"
  }`;
}

type CompactDropdownOption = {
  value: string;
  label: string;
  helper?: string;
  icon?: ReactNode;
};

function CompactDropdown({
  value,
  options,
  open,
  onToggle,
  onChange,
  icon,
  ariaLabel,
  align = "left",
}: {
  value: string;
  options: CompactDropdownOption[];
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  icon: ReactNode;
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
      <button
        ref={anchor}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={controlClass(open)}
      >
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.045] text-mint">
          {selected?.icon ?? icon}
        </span>
        <span className="whitespace-nowrap">{selected?.label ?? value}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <CreatorPopover anchor={anchor} onClose={onToggle} label={ariaLabel} width={230}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onChange(option.value)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  active ? "bg-violet/[.14] text-white" : "text-white/70 hover:bg-white/[.055] hover:text-white"
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  active ? "border-mint/25 bg-mint/[.10] text-mint" : "border-white/[.08] bg-white/[.035] text-white/55"
                }`}>
                  {option.icon ?? icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold">{option.label}</span>
                  {option.helper && <span className="mt-0.5 block text-[8px] leading-3.5 text-white/38">{option.helper}</span>}
                </span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                  active ? "border-mint/35 bg-mint/10 text-mint" : "border-white/[.08] text-transparent"
                }`}>
                  {active && <Check size={11} />}
                </span>
              </button>
            );
          })}
        </CreatorPopover>
      )}
    </div>
  );
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
  const [productLink, setProductLink] = useState("");
  const [productData, setProductData] = useState<{ title: string; url: string; images: string[] } | null>(null);
  const [chosenProductImages, setChosenProductImages] = useState<string[]>([]);
  const [readingProduct, setReadingProduct] = useState(false);
  const [mapLink, setMapLink] = useState("");
  const [site, setSite] = useState<{ latitude?: number; longitude?: number; label: string | null; resolvedUrl: string } | null>(null);
  const [resolvingSite, setResolvingSite] = useState(false);
  const [plotWidth, setPlotWidth] = useState("");
  const [plotDepth, setPlotDepth] = useState("");
  const [buildingWidth, setBuildingWidth] = useState("");
  const [buildingHeight, setBuildingHeight] = useState("");
  const [floorCount, setFloorCount] = useState("");
  const [setback, setSetback] = useState("");
  const [estimatedScale, setEstimatedScale] = useState(false);
  const [compactPanel, setCompactPanel] = useState<"style" | "ideas" | "model" | null>(null);
  const [openSettingMenu, setOpenSettingMenu] = useState<"duration" | "aspect" | "quality" | "audio" | "language" | null>(null);
  const [customDurationInput, setCustomDurationInput] = useState(String(DEFAULT_SETTINGS.durationSeconds));
  const [usingCustomDuration, setUsingCustomDuration] = useState(false);
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
  const modelAnchor = useRef<HTMLButtonElement>(null);
  const durationAnchor = useRef<HTMLButtonElement>(null);
  const websiteBriefRef = useRef<HTMLTextAreaElement>(null);
  const studioPromptRef = useRef<HTMLTextAreaElement>(null);

  function applyIntent(intent: CreationIntent, userInitiated = false) {
    if (userInitiated && onIntentRequest?.(intent) === false) return;
    const previousIntent = activeModeRef.current;
    activeModeRef.current = intent;
    setActiveMode(intent);
    setSelectedIdea(null);
    setCompactPanel(null);
    setOpenSettingMenu(null);
    setError(null);
    setSettings((current) => {
      if (intent === "photo") {
        return { ...current, aspectRatio: "1:1", audioMode: "silent", outputQuality: "1080p", modelId: defaultModelFor("image") };
      }
      if (intent === "interior" || intent === "architecture") {
        return { ...current, aspectRatio: "16:9", audioMode: "silent", outputQuality: "1080p", modelId: defaultModelFor("interior") };
      }
      const leavingPhotoDefaults = (previousIntent === "photo" || previousIntent === "interior" || previousIntent === "architecture") && current.audioMode === "silent";
      return {
        ...current,
        ...(leavingPhotoDefaults ? { aspectRatio: "9:16" as const, audioMode: "native_audio" as const } : {}),
        outputQuality: "1080p",
        modelId: defaultModelFor("video"),
      };
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
    () => getIdeasForIntent(activeMode === "architecture" ? "interior" : activeMode, ideaContext, 6),
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
    setCompactPanel((current) => {
      const next = current === "ideas" ? null : "ideas";
      if (next === "ideas") void trackStudioEvent({ event: "ideas_opened", feature: masterIdeas[0]?.feature });
      return next;
    });
  }

  function chooseModel(modelId: PublicModelId) {
    const model = publicModel(modelId);
    setSettings((current) => {
      const quality = model.supportedQualities.includes(current.outputQuality)
        ? current.outputQuality
        : model.supportedQualities[0] ?? "1080p";
      const audioMode = model.audioModes.includes(current.audioMode)
        ? current.audioMode
        : (model.audioModes[0] ?? "silent");
      return {
        ...current,
        modelId,
        outputQuality: quality,
        audioMode,
      };
    });
    setCompactPanel(null);
    setOpenSettingMenu(null);
  }

  function applyDurationPreset(seconds: number) {
    const safe = normalizeDuration(seconds);
    setUsingCustomDuration(false);
    setCustomDurationInput(String(safe));
    setSettings((current) => ({ ...current, durationSeconds: safe }));
    setOpenSettingMenu(null);
  }

  function commitCustomDuration(raw = customDurationInput) {
    const parsed = Number.parseInt(raw.trim(), 10);
    const currentDuration = typeof settings.durationSeconds === "number"
      ? settings.durationSeconds
      : MIN_CREATOR_DURATION_SECONDS;
    const safe = normalizeDuration(Number.isFinite(parsed) ? parsed : currentDuration);
    setUsingCustomDuration(true);
    setCustomDurationInput(String(safe));
    setSettings((current) => ({ ...current, durationSeconds: safe }));
    return safe;
  }

  useEffect(() => {
    if (!openSettingMenu && compactPanel !== "model") return;
    const closeFloatingMenus = (event: PointerEvent) => {
      const root = composerRootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (root.contains(event.target) || document.querySelector("[data-creator-popover]")?.contains(event.target)) return;
      setOpenSettingMenu(null);
      setCompactPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpenSettingMenu(null); setCompactPanel(null); }
    };
    document.addEventListener("pointerdown", closeFloatingMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeFloatingMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [compactPanel, openSettingMenu]);

  function submit() {
    if (disabled) return;
    setOpenSettingMenu(null);
    setCompactPanel(null);
    if (selectedIdea) {
      void trackStudioEvent({
        event: "idea_to_generate_conversion",
        ideaId: selectedIdea.id,
        feature: selectedIdea.feature,
        metadata: { mode: activeMode },
      });
    }

    const activeModel = publicModel(settings.modelId);
    const safeQuality = activeModel.supportedQualities.includes(settings.outputQuality)
      ? settings.outputQuality
      : (activeModel.supportedQualities[0] ?? "1080p");
    const safeAudioMode = activeModel.audioModes.includes(settings.audioMode)
      ? settings.audioMode
      : (activeModel.audioModes[0] ?? "silent");

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
        void onSubmit(
          normalizeWebsiteUrl(url),
          brief.trim(),
          { ...settings, outputQuality: safeQuality, audioMode: safeAudioMode },
          files,
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Enter a valid public website URL.");
      }
      return;
    }

    const isProduct = activeMode === "photo" || activeMode === "product-video";
    const isInterior = activeMode === "interior" || activeMode === "architecture";
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
    if (activeMode === "architecture" && (!site || (!estimatedScale && (!Number(plotWidth) || !Number(plotDepth))))) {
      setError("Add a Maps location and plot width/depth, or choose estimated site scale.");
      return;
    }
    if ((isProduct || isInterior) && files.length === 0 && (!isProduct || chosenProductImages.length === 0)) {
      setError(isInterior ? "Attach at least one clear site/space photo, plan, sketch, elevation, or reference image." : "Attach at least one real product image or use a product link.");
      return;
    }

    const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
    setError(null);
    void onStudioSubmit({
      studioKind: isProduct
        ? "product"
        : activeMode === "scenario"
          ? "scenario"
          : activeMode === "interior"
            ? "interior"
            : activeMode === "architecture"
              ? "architecture"
              : "idea",
      prompt: activePrompt,
      files,
      mode: activeMode === "photo" ? "photos" : activeMode === "product-video" ? "video" : isInterior ? (interiorOutput === "video" ? "custom" : "photos") : "custom",
      durationSeconds: activeMode === "photo" ? 8 : durationSeconds,
      aspectRatio: settings.aspectRatio,
      outputQuality: safeQuality,
      audioMode: activeMode === "photo" || (isInterior && interiorOutput === "images") ? "silent" : safeAudioMode,
      modelId: settings.modelId,
      productUrl: productData?.url,
      productImageUrls: chosenProductImages,
      architecture: activeMode === "architecture" ? {
        location: site?.label || site?.resolvedUrl,
        latitude: site?.latitude,
        longitude: site?.longitude,
        mapUrl: site?.resolvedUrl || undefined,
        plotWidth: Number(plotWidth) || undefined,
        plotDepth: Number(plotDepth) || undefined,
        buildingWidth: Number(buildingWidth) || undefined,
        buildingHeight: Number(buildingHeight) || undefined,
        floors: Number(floorCount) || undefined,
        setback: Number(setback) || undefined,
        estimatedScale,
      } : undefined,
    });
  }

  const isProductMode = activeMode === "photo" || activeMode === "product-video";
  const isInteriorMode = activeMode === "interior" || activeMode === "architecture";
  const isVideoMode = activeMode !== "photo" && (!isInteriorMode || interiorOutput === "video");
  const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
  const formatSummary = settings.aspectRatio === "9:16" ? "Portrait" : settings.aspectRatio === "16:9" ? "Wide" : "Square";
  const modelFamily = isVideoMode ? "video" : isInteriorMode ? "interior" : "image";
  const availableModels = modelsFor(modelFamily).filter((model) => model.id !== "cinema-1" || activeMode !== "architecture");
  const selectedModel = publicModel(settings.modelId);
  const exactCredits = activeMode === "photo" || (isInteriorMode && interiorOutput === "images")
    ? estimateRenderCredits("photos", true, 8, settings.outputQuality, settings.modelId)
    : estimateRenderCredits("video", settings.audioMode !== "voice_music", durationSeconds, settings.outputQuality, settings.modelId);
  const submitDisabled = disabled || (
    activeMode === "website"
      ? !url.trim() || !brief.trim()
      : isProductMode
        ? (files.length === 0 && chosenProductImages.length === 0) || !brief.trim()
        : isInteriorMode
          ? files.length === 0 || !brief.trim() || (activeMode === "architecture" && (!site || (!estimatedScale && (!Number(plotWidth) || !Number(plotDepth)))))
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
            : activeMode === "architecture"
              ? "Create architecture"
              : "Create talking scene";

  return (
    <div
      ref={composerRootRef}
      className={`creator-composer relative overflow-visible ${compactLayout ? "rounded-[22px]" : "rounded-[28px]"} border bg-[#151027]/95 shadow-[0_28px_90px_-48px_rgba(139,92,246,.72)] backdrop-blur-2xl transition ${dragging ? "border-mint/60 ring-2 ring-mint/15" : "border-white/10"}`}
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
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-[inherit] bg-[#0b0818]/90 backdrop-blur-sm">
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
        {activeMode === 'architecture' && <div className="mb-3 space-y-3 rounded-xl border border-white/10 bg-white/[.015] p-3 sm:p-4">
          <div className="flex gap-2">
            <input type="text" value={mapLink} onChange={(event) => { setMapLink(event.target.value); setSite(null); }}
              placeholder="Google Maps link or address" aria-label="Google Maps link or address"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0b0818] px-3 text-xs text-white outline-none focus:border-violet/50" />
            <button type="button" disabled={!mapLink.trim() || resolvingSite}
              onClick={() => { setResolvingSite(true); setError(null);
                void resolveArchitectureLocation(mapLink).then(setSite).catch(() => setError("Couldn't identify this location. Paste another Maps link or add the address.")).finally(() => setResolvingSite(false)); }}
              className="min-h-11 rounded-xl border border-white/15 px-3 text-xs text-white hover:bg-white/5 disabled:opacity-40">
              {resolvingSite ? 'Resolving…' : 'Locate'}
            </button>
          </div>
          {site && <p className="text-[11px] text-mint">{site.label || `${site.latitude}, ${site.longitude}`} · Add a site photo or screenshot{site.latitude === undefined ? ' · Location not geocoded' : ''}</p>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SiteMeasure label="Plot width" value={plotWidth} onChange={setPlotWidth} min={0.5} step={0.5} unit="m" />
            <SiteMeasure label="Plot depth" value={plotDepth} onChange={setPlotDepth} min={0.5} step={0.5} unit="m" />
            <SiteMeasure label="Building width" value={buildingWidth} onChange={setBuildingWidth} min={0.5} step={0.5} unit="m" />
            <SiteMeasure label="Building height" value={buildingHeight} onChange={setBuildingHeight} min={0.5} step={0.5} unit="m" />
            <SiteMeasure label="Floors" value={floorCount} onChange={setFloorCount} min={1} max={200} step={1} />
            <SiteMeasure label="Road setback" value={setback} onChange={setSetback} min={0} max={1000} step={0.5} unit="m" />
          </div>
          <button type="button" role="checkbox" aria-checked={estimatedScale} onClick={() => setEstimatedScale((current) => !current)}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-1 text-left text-xs text-text-muted hover:text-white">
            <span aria-hidden="true" className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition ${estimatedScale ? 'border-violet bg-violet text-white' : 'border-white/35 bg-white/[.03]'}`}>
              {estimatedScale && <Check size={13} strokeWidth={3} />}
            </span>
            Use estimated site scale when measurements are unavailable
          </button>
        </div>}
        {isProductMode && <div className="mb-3"><div className="flex gap-2"><input type="url" value={productLink} onChange={(event) => { setProductLink(event.target.value); setProductData(null); setChosenProductImages([]); }} placeholder="Product link" aria-label="Product link" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0b0818] px-3 py-2 text-xs text-white outline-none focus:border-violet" /><button type="button" disabled={!productLink.trim() || readingProduct} onClick={() => { setReadingProduct(true); setError(null); void extractProductReference(productLink).then((data) => { setProductData(data); setChosenProductImages(data.images.slice(0, 1)); }).catch(() => { setProductData(null); setChosenProductImages([]); setError("Couldn't load this product. Upload product images instead."); }).finally(() => setReadingProduct(false)); }} className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white disabled:opacity-40">{readingProduct ? 'Reading product…' : 'Use link'}</button></div>{productData && <div className="mt-2"><p className="mb-2 truncate text-xs text-text-muted">{productData.title || 'Choose product images'}</p><div className="flex gap-2 overflow-x-auto">{productData.images.map((image) => <button key={image} type="button" aria-label="Use product image" aria-pressed={chosenProductImages.includes(image)} onClick={() => setChosenProductImages((current) => current.includes(image) ? current.filter((url) => url !== image) : [...current, image])} className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${chosenProductImages.includes(image) ? 'border-mint' : 'border-transparent'}`}><img src={image} alt="Product reference" loading="lazy" className="h-full w-full object-contain" /></button>)}</div></div>}</div>}
        {isInteriorMode && (
          <div className="mb-3 inline-flex rounded-xl border border-white/[.10] bg-white/[.025] p-1">
            <button
              type="button"
              onClick={() => {
                setInteriorOutput("images");
                setSettings((current) => ({ ...current, modelId: defaultModelFor("interior"), outputQuality: "1080p", audioMode: "silent" }));
              }}
              className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${interiorOutput === "images" ? "bg-white/[.10] text-white" : "text-white/45 hover:text-white"}`}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => {
                setInteriorOutput("video");
                setSettings((current) => ({ ...current, modelId: defaultModelFor("video"), outputQuality: "1080p", audioMode: "native_audio" }));
              }}
              className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${interiorOutput === "video" ? "bg-white/[.10] text-white" : "text-white/45 hover:text-white"}`}
            >
              Video
            </button>
          </div>
        )}

        {!compactLayout && (
          <div className="mb-4">
            <p className="font-display text-base font-semibold text-white">
              {activeMode === "website" ? "Create a video from your website" : activeMode === "video" ? "Create an AI video" : activeMode === "photo" ? "Create product photos" : activeMode === "product-video" ? "Create a product video" : activeMode === "interior" ? "Design an interior" : activeMode === "architecture" ? "Place architecture on a site" : "Create a talking scene"}
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
              <span>{activeMode === "website" ? "What should the video highlight?" : activeMode === "video" ? "Describe your video" : activeMode === "photo" ? "Describe the product photos" : activeMode === "product-video" ? "Describe the product video" : activeMode === "interior" ? "Describe the space, measurements and design" : activeMode === "architecture" ? "Describe the building and placement" : "Describe the talking scene"}</span>
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
                setOpenSettingMenu(null);
                setCompactPanel((current) => current === "style" ? null : "style");
              }}
              aria-expanded={compactPanel === "style"}
              className={controlClass(compactPanel === "style")}
            >
              <Film size={13} className="text-mint" />
              Style: {selectedWebsiteRecipe ? WEBSITE_RECIPES.find((recipe) => recipe.mode === selectedWebsiteRecipe)?.label : "Auto"}
              <ChevronDown size={12} className={`transition-transform ${compactPanel === "style" ? "rotate-180" : ""}`} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpenSettingMenu(null);
              toggleIdeas();
            }}
            aria-expanded={compactPanel === "ideas"}
            className={controlClass(compactPanel === "ideas")}
          >
            <Sparkles size={13} className="text-violet" />
            Ideas
            {selectedIdea && <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[8px] text-mint">Added</span>}
            <ChevronDown size={12} className={`transition-transform ${compactPanel === "ideas" ? "rotate-180" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setOpenSettingMenu(null);
              inputRef.current?.click();
            }}
            disabled={disabled || files.length >= 10}
            className={controlClass(false)}
          >
            <Paperclip size={13} className="text-mint" />
            {files.length ? `References ${files.length}` : isProductMode ? (chosenProductImages.length ? `Product images ${chosenProductImages.length}` : "Add product photo") : isInteriorMode ? "Add site / space references" : "References"}
          </button>

          <div className="relative">
            <button
              ref={modelAnchor}
              type="button"
              onClick={() => {
                setOpenSettingMenu(null);
                setCompactPanel((current) => current === "model" ? null : "model");
              }}
              aria-expanded={compactPanel === "model"}
              aria-haspopup="listbox"
              className={controlClass(compactPanel === "model")}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-mint/[.08] text-mint">
                {modelFamily === "video" ? <Video size={13} /> : modelFamily === "interior" ? <House size={13} /> : <ImageIcon size={13} />}
              </span>
              <span className="max-w-[150px] truncate">{selectedModel.name.replace("AiWebVideo ", "")}</span>
              <ChevronDown size={12} className={`transition-transform ${compactPanel === "model" ? "rotate-180" : ""}`} />
            </button>

            {compactPanel === "model" && (
              <CreatorPopover anchor={modelAnchor} onClose={() => setCompactPanel(null)} label="Generation model" width={312}>
                <div className="flex items-center justify-between gap-3 px-2.5 pb-1.5 pt-1">
                  <div>
                    <p className="text-[10px] font-semibold text-white">Choose model</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompactPanel(null)}
                    aria-label="Close model menu"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[.06] hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>

                {availableModels.map((model) => {
                  const selected = settings.modelId === model.id;
                  const effectiveQuality = model.supportedQualities.includes(settings.outputQuality)
                    ? settings.outputQuality
                    : (model.supportedQualities[0] ?? "1080p");
                  const modelPrice = model.family === "video"
                    ? displayCredits(effectiveQuality === "4k"
                        ? (model.internalCredits4k ?? model.internalCredits1080p ?? 1)
                        : (model.internalCredits1080p ?? 1))
                    : displayCredits(effectiveQuality === "4k"
                        ? (model.internalCredits4k ?? model.internalCreditsPerImage ?? 1)
                        : (model.internalCreditsPerImage ?? 1));
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => chooseModel(model.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        selected ? "bg-violet/[.13]" : "hover:bg-white/[.055]"
                      }`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                        selected ? "border-mint/30 bg-mint/10 text-mint" : "border-white/10 bg-white/[.035] text-white/55"
                      }`}>
                        {model.family === "video" ? <Video size={16} /> : model.family === "interior" ? <House size={16} /> : <ImageIcon size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[11px] font-semibold text-white">{model.name}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1 text-[8px] text-white/42">
                          <span>{model.speed}</span>
                          <span>·</span>
                          <span>{model.quality}</span>
                          {model.nativeAudio && <><span>·</span><span>Sound</span></>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[9px] font-semibold text-white/75">{modelPrice}</span>
                        <span className="block text-[7px] text-white/35">{model.family === "video" ? "cr/sec" : "cr/image"}</span>
                      </span>
                      <span className="grid h-5 w-5 shrink-0 place-items-center">
                        {selected && <Check size={13} className="text-mint" />}
                      </span>
                    </button>
                  );
                })}
              </CreatorPopover>
            )}
          </div>

          {selectedModel.supportsDuration && (
            <div className="relative">
              <button
                ref={durationAnchor}
                type="button"
                onClick={() => {
                  setCompactPanel(null);
                  setOpenSettingMenu((current) => current === "duration" ? null : "duration");
                }}
                aria-expanded={openSettingMenu === "duration"}
                aria-haspopup="dialog"
                className={controlClass(openSettingMenu === "duration")}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.045] text-mint">
                  <Clock size={12} />
                </span>
                <span>{durationSeconds}s</span>
                <ChevronDown size={12} className={`transition-transform ${openSettingMenu === "duration" ? "rotate-180" : ""}`} />
              </button>

              {openSettingMenu === "duration" && (
                <CreatorPopover anchor={durationAnchor} onClose={() => setOpenSettingMenu(null)} label="Video duration" width={280}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-white">Video duration</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenSettingMenu(null)}
                      aria-label="Close duration menu"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[.06] hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {DURATION_PRESETS.map((seconds) => {
                      const active = !usingCustomDuration && durationSeconds === seconds;
                      return (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => applyDurationPreset(seconds)}
                          className={`flex min-h-10 items-center justify-center rounded-lg border px-2 py-1 transition ${
                            active
                              ? "border-mint/35 bg-mint/[.10] text-mint"
                              : "border-white/[.08] bg-white/[.035] text-white/70 hover:border-violet/30 hover:bg-white/[.055] hover:text-white"
                          }`}
                        >
                          <span className="text-xs font-semibold">{seconds}s</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className={`mt-3 rounded-xl border p-2.5 transition ${
                    usingCustomDuration ? "border-violet/35 bg-violet/[.07]" : "border-white/[.08] bg-white/[.025]"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white">
                        <Clock size={12} className="text-violet" />
                        Custom
                      </span>
                      <span className="text-[8px] text-white/35">8–60 sec</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative min-w-0 flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={customDurationInput}
                          onFocus={() => setUsingCustomDuration(true)}
                          onChange={(event) => {
                            const digits = event.currentTarget.value.replace(/\D/g, "").slice(0, 3);
                            setUsingCustomDuration(true);
                            setCustomDurationInput(digits);
                          }}
                          onBlur={() => commitCustomDuration()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              commitCustomDuration();
                              setOpenSettingMenu(null);
                            }
                            if (event.key === "Escape") {
                              setCustomDurationInput(String(durationSeconds));
                              setOpenSettingMenu(null);
                            }
                          }}
                          placeholder="8–60"
                          className="h-10 w-full rounded-xl border border-white/[.10] bg-[#0b0818] px-3 pr-10 text-center text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-violet/55 focus:ring-2 focus:ring-violet/10"
                          aria-label="Custom video duration in seconds"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-semibold uppercase tracking-[.12em] text-white/30">sec</span>
                      </div>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          commitCustomDuration();
                          setOpenSettingMenu(null);
                        }}
                        className="h-10 rounded-xl border border-violet/30 bg-violet/[.12] px-3 text-[10px] font-semibold text-white transition hover:bg-violet/[.18]"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                </CreatorPopover>
              )}
            </div>
          )}

          <CompactDropdown
            value={settings.aspectRatio}
            options={[
              { value: "9:16", label: "9:16", helper: "Portrait", icon: <span className="h-4 w-2.5 rounded-[3px] border border-current/80" /> },
              { value: "16:9", label: "16:9", helper: "Landscape", icon: <span className="h-2.5 w-4 rounded-[3px] border border-current/80" /> },
              { value: "1:1", label: "1:1", helper: "Square", icon: <span className="h-3.5 w-3.5 rounded-[3px] border border-current/80" /> },
            ]}
            open={openSettingMenu === "aspect"}
            onToggle={() => {
              setCompactPanel(null);
              setOpenSettingMenu((current) => current === "aspect" ? null : "aspect");
            }}
            onChange={(value) => {
              setSettings((current) => ({ ...current, aspectRatio: value as "16:9" | "9:16" | "1:1" }));
              setOpenSettingMenu(null);
            }}
            icon={<Maximize2 size={12} />}
            ariaLabel="Aspect ratio"
          />

          {selectedModel.supportedQualities.length > 1 ? (
            <CompactDropdown
              value={settings.outputQuality}
              options={selectedModel.supportedQualities.map((quality) => ({
                value: quality,
                label: quality === "4k" ? "4K" : "1080p",
                helper: quality === "4k" ? "Maximum detail" : "Standard HD",
                icon: quality === "4k" ? <Sparkles size={13} /> : <Monitor size={13} />,
              }))}
              open={openSettingMenu === "quality"}
              onToggle={() => {
                setCompactPanel(null);
                setOpenSettingMenu((current) => current === "quality" ? null : "quality");
              }}
              onChange={(value) => {
                setSettings((current) => ({ ...current, outputQuality: value as "1080p" | "4k" }));
                setOpenSettingMenu(null);
              }}
              icon={<Monitor size={12} />}
              ariaLabel="Quality"
            />
          ) : (
            <span className="creator-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.025] px-3 text-[10px] font-semibold text-white/55 sm:text-[11px]">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-white/[.04] text-mint"><Monitor size={12} /></span>
              {selectedModel.quality}
            </span>
          )}

          {selectedModel.audioModes.length > 0 && (
            <CompactDropdown
              value={settings.audioMode}
              options={[
                ...(selectedModel.audioModes.includes("native_audio") ? [{ value: "native_audio", label: "Sound", helper: "Native scene audio", icon: <Volume2 size={13} /> }] : []),
                ...(selectedModel.audioModes.includes("voice_music") ? [{ value: "voice_music", label: "Narration", helper: "Voice + soundtrack", icon: <Mic size={13} /> }] : []),
                ...(selectedModel.audioModes.includes("music_only") ? [{ value: "music_only", label: "Music", helper: "Soundtrack only", icon: <Music size={13} /> }] : []),
                ...(selectedModel.audioModes.includes("silent") ? [{ value: "silent", label: "Silent", helper: "No audio", icon: <VolumeX size={13} /> }] : []),
              ]}
              open={openSettingMenu === "audio"}
              onToggle={() => {
                setCompactPanel(null);
                setOpenSettingMenu((current) => current === "audio" ? null : "audio");
              }}
              onChange={(value) => {
                setSettings((current) => ({ ...current, audioMode: value as AudioMode }));
                setOpenSettingMenu(null);
              }}
              icon={<Volume2 size={12} />}
              ariaLabel="Audio"
              align="right"
            />
          )}
        </div>

        {selectedModel.audioModes.includes("voice_music") && settings.audioMode === "voice_music" && (
          <div className="mt-2 flex justify-end">
            <CompactDropdown
              value={settings.narrationLanguage}
              options={NARRATION_LANGUAGES.map(([code, label]) => ({ value: code, label, icon: <Languages size={13} /> }))}
              open={openSettingMenu === "language"}
              onToggle={() => {
                setCompactPanel(null);
                setOpenSettingMenu((current) => current === "language" ? null : "language");
              }}
              onChange={(value) => {
                setSettings((current) => ({ ...current, narrationLanguage: value }));
                setOpenSettingMenu(null);
              }}
              icon={<Languages size={12} />}
              ariaLabel="Narration language"
              align="right"
            />
          </div>
        )}

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

        {error && <p role="alert" className="mt-3 rounded-xl border border-pink/20 bg-pink/5 px-3 py-2 text-xs text-pink">{error}</p>}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          {!compactLayout && (
            <div className="flex-1 text-[9px] text-text-dim">
              {isProductMode && !files.length && !chosenProductImages.length ? "Add your product to continue." : isInteriorMode && !files.length ? "Add site or space references." : `Your setup: ${isVideoMode ? `${durationSeconds}s · ` : ""}${formatSummary} · ${selectedModel.supportedQualities.length === 1 ? selectedModel.quality : (settings.outputQuality === "4k" ? "4K" : "1080p")}`}
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
