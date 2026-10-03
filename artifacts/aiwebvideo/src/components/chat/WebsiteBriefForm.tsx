import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Film,
  BriefcaseBusiness,
  Clapperboard,
  Compass,
  GraduationCap,
  Megaphone,
  ShoppingCart,
  type LucideIcon,
  Globe2,
  Image as ImageIcon,
  House,
  Building2,
  Languages,
  Maximize2,
  MapPin,
  MessageCircleMore,
  Mic,
  Monitor,
  Music,
  PackageOpen,
  Paperclip,
  Video,
  Volume2,
  VolumeX,
  X,
  SlidersHorizontal,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { normalizeWebsiteUrl } from "@/lib/websiteUrl";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import { defaultModelFor, modelsFor, publicModel, type PublicModelId } from "@/lib/generationModels";
import {
  getIdeasForIntent,
  referenceHintForIdea,
  type CreativeIdea,
  type IdeaContext,
} from "@/lib/creativeIdeas";
import { trackStudioEvent } from "@/lib/studio-api";
import { withHiddenDirection } from "@/lib/hiddenDirection";
import { clearPromptDraft, loadPromptDraft, savePromptDraft } from "@/lib/promptDraft";
import { useAutoGrow } from "@/lib/useAutoGrow";
import { looksLikeLink, withScheme } from "@/lib/linkStatus";
import { LinkStatus } from "./LinkStatus";
import { CREATION_FEATURES } from "@/lib/creationFeatures";
import { CREATION_INTENT_EVENT, publishCreationMode } from "@/lib/creationMode";
import { ScrollRow } from "@/components/ui/scroll-row";
import { NumberStepper } from "@/components/ui/number-stepper";
import { ToggleRow } from "@/components/ui/toggle-row";
import { SampleStrip } from "./SampleStrip";
import { USE_SAMPLE_EVENT, clearPendingSample, peekPendingSample, rememberPendingSample, useSamples, type Sample, type UseSampleDetail } from "@/lib/showcase";
import { ComposerPlusMenu } from "./ComposerPlusMenu";
import { FormatIcon } from "./FormatIcon";
import { ModelPicker } from "./ModelPicker";
import { QualityGlyph } from "./QualityGlyph";
import { fileKey, rememberFiles } from "@/lib/recentFiles";
import { ApiError, extractProductReference, resolveArchitectureLocation, type ProductReference } from "@/lib/api-client";
import { looksLikeCoordinates, mapPreviewUrl } from "@/lib/mapPreview";
import type { AudioMode, JobMode } from "./types";

import type { CreationIntent } from "@/lib/creationFeatures";
export type { CreationIntent };

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
  /** Hidden creative direction from an Idea chip (applied on the server). */
  studioDirection?: string;
  /** A showcase sample to recreate with the customer's own references. */
  templateId?: string;
  /** What the product page says, to brief the AI accurately. */
  productFacts?: { title?: string; description?: string; facts?: Record<string, string> };
}

const TEMPLATE_PROMPTS: Partial<Record<CreationIntent, string>> = {
  photo: "Recreate this style with my product.",
  "product-video": "Recreate this style with my product.",
  video: "Make a video in the style of this example.",
  scenario: "Recreate this scene with my references.",
  interior: "Redesign my space in the style of this example.",
  architecture: "Place my building on my site in the style of this example.",
};

const DEFAULT_SETTINGS: WebsiteGenerationSettings = {
  mode: "video",
  durationSeconds: 8,
  aspectRatio: "9:16",
  outputQuality: "1080p",
  audioMode: "native_audio",
  narrationLanguage: "auto",
  modelId: "cinema-2",
};

const WEBSITE_RECIPES: Array<{
  mode: WebsiteProductionMode;
  label: string;
  helper: string;
  icon: LucideIcon;
  /** Gradient for the icon tile. */
  tint: string;
}> = [
  { mode: "video", label: "Promo", helper: "A punchy brand campaign", icon: Megaphone, tint: "from-violet to-pink" },
  { mode: "demo", label: "Cinematic", helper: "A generated brand film", icon: Clapperboard, tint: "from-amber-400 to-pink" },
  { mode: "tutorial", label: "Tutorial", helper: "Teach how it works", icon: GraduationCap, tint: "from-sky-400 to-violet" },
  { mode: "tour", label: "Feature tour", helper: "Walk through the product", icon: Compass, tint: "from-mint to-sky-400" },
  { mode: "buy", label: "How to buy", helper: "Guide visitors to checkout", icon: ShoppingCart, tint: "from-emerald-400 to-mint" },
  { mode: "linkedin", label: "LinkedIn", helper: "Polished and professional", icon: BriefcaseBusiness, tint: "from-blue-500 to-sky-400" },
];

const CREATION_MODES = CREATION_FEATURES;

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
  return `creator-secondary-button generation-control ${active ? "generation-control-active" : ""}`;
}

// The trigger retains the compact button's layout; Radix handles viewport
// collisions, Escape, outside interactions, and focus restoration.
function ControlMenu({ open, onClose, trigger, children, label, wide = false, align = "start" }: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  label: string;
  wide?: boolean;
  align?: "start" | "end";
}) {
  return (
    <Popover.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          side="top"
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={`generation-control-menu ${wide ? "generation-control-menu-wide" : ""}`}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type CompactDropdownOption = {
  value: string;
  label: string;
  helper?: string;
  icon?: ReactNode;
  /** The icon already has its own shape (for example the HD / 4K badge): no extra tile around it. */
  iconBare?: boolean;
};

function CompactDropdown({
  value,
  options,
  open,
  onToggle,
  onClose,
  onChange,
  icon,
  ariaLabel,
  align = "left",
}: {
  value: string;
  options: CompactDropdownOption[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  icon: ReactNode;
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <ControlMenu open={open} onClose={onClose} label={ariaLabel} align={align === "right" ? "end" : "start"} trigger={
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${ariaLabel}: ${selected?.label ?? value}`}
        className={controlClass(open)}
      >
        {selected?.iconBare
          ? selected.icon
          : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.045] text-mint">{selected?.icon ?? icon}</span>}
        <span className="whitespace-nowrap">{selected?.label ?? value}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>}>

      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="p-1"
        >
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
                {option.iconBare
                  ? <span className="grid h-8 w-10 shrink-0 place-items-center">{option.icon}</span>
                  : <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                      active ? "border-mint/25 bg-mint/[.10] text-mint" : "border-white/[.08] bg-white/[.035] text-white/55"
                    }`}>
                      {option.icon ?? icon}
                    </span>}
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
        </div>
      )}
    </ControlMenu>
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
            <span className="flex items-center justify-end gap-2">
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
  recentFilesOwner = null,
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
  /** Email of the signed-in account. Recent files are remembered and offered only when this is set. */
  recentFilesOwner?: string | null;
  compactLayout?: boolean;
}) {
  const [activeMode, setActiveMode] = useState<CreationIntent>("website");
  const activeModeRef = useRef<CreationIntent>("website");
  const [url, setUrl] = useState("");
  // ONE text for every feature: typing it once and then switching feature (or page) keeps it, so nobody has to
  // retype or paste it. It is also kept for this browser session and cleared when a production is submitted.
  const [brief, setBrief] = useState(() => loadPromptDraft());
  const prompt = brief;
  const setPrompt = setBrief;
  useEffect(() => { savePromptDraft(brief); }, [brief]);
  const [productLink, setProductLink] = useState("");
  const [productData, setProductData] = useState<ProductReference | null>(null);
  const [chosenProductImages, setChosenProductImages] = useState<string[]>([]);
  const [readingProduct, setReadingProduct] = useState(false);
  const [mapLink, setMapLink] = useState("");
  const [site, setSite] = useState<{ latitude?: number; longitude?: number; label: string | null; resolvedUrl: string; precision?: "pin" | "view" | "none"; imageryAvailable?: boolean } | null>(null);
  const [resolvingSite, setResolvingSite] = useState(false);
  const [plotWidth, setPlotWidth] = useState("");
  const [plotDepth, setPlotDepth] = useState("");
  const [floorCount, setFloorCount] = useState("");
  const [setback, setSetback] = useState("");
  const [estimatedScale, setEstimatedScale] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [languageShake, setLanguageShake] = useState(false);
  const languageShakeTimer = useRef<number | null>(null);
  const lastReadLinkRef = useRef("");
  const productReadId = useRef(0);
  const siteReadId = useRef(0);
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
  const websiteBriefRef = useRef<HTMLTextAreaElement>(null);
  const studioPromptRef = useRef<HTMLTextAreaElement>(null);

  function applyIntent(intent: CreationIntent, userInitiated = false) {
    if (userInitiated && onIntentRequest?.(intent) === false) return;
    const previousIntent = activeModeRef.current;
    activeModeRef.current = intent;
    setActiveMode(intent);
    setSelectedIdea(null);
    setSelectedSample(null);
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

  // Listeners below are registered once, but they must always call the LATEST applyIntent: that one knows whether
  // the person is signed in NOW. The first render's version still thinks everyone is signed out (the sign-in check
  // has not finished yet), which sent signed-in people to the sign-in window when they chose a feature or tapped an
  // example on the landing page.
  const applyIntentRef = useRef(applyIntent);
  applyIntentRef.current = applyIntent;

  useEffect(() => {
    applyIntent(initialCreationIntent ?? intentFromSearch() ?? "website");
    const handleIntent = (event: Event) => {
      const intent = (event as CustomEvent<CreationIntent>).detail;
      if (intent) applyIntentRef.current(intent, true);
    };
    const handleHistoryIntent = () => {
      if (initialCreationIntent) return;
      applyIntent(intentFromSearch() ?? "website");
    };
    window.addEventListener(CREATION_INTENT_EVENT, handleIntent);
    window.addEventListener("popstate", handleHistoryIntent);
    return () => {
      window.removeEventListener(CREATION_INTENT_EVENT, handleIntent);
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

  // Tell the navbar which feature is open, so its menu can highlight it.
  useEffect(() => { publishCreationMode(activeMode); }, [activeMode]);

  // Another account (or a sign-out) took over this browser: what the previous person attached or picked must not
  // follow into the next account. Going from signed-out to signed-in keeps it (a guest's request is carried over).
  const previousOwnerRef = useRef(recentFilesOwner);
  useEffect(() => {
    const previous = previousOwnerRef.current;
    previousOwnerRef.current = recentFilesOwner;
    if (previous && previous !== recentFilesOwner) {
      setFiles([]);
      setSelectedSample(null);
      setProductData(null);
      setChosenProductImages([]);
      setProductLink("");
    }
  }, [recentFilesOwner]);

  // The prompt box grows with the text (up to ~40% of the screen) and scrolls inside after that.
  useAutoGrow(activeMode === "website" ? websiteBriefRef : studioPromptRef, activeMode === "video" || activeMode === "scenario" ? prompt : brief, { minPx: compactLayout ? 96 : 120, maxPx: 260 });

  // A visitor tapped an example ("make one like this"): open that feature with the example attached.
  useEffect(() => {
    const handleSample = (event: Event) => {
      const sample = (event as CustomEvent<UseSampleDetail>).detail?.sample;
      if (!sample) return;
      // On the public landing page this may first send the visitor through sign-in to the workspace.
      // Remember the pick so it is selected again when they arrive.
      if (sample.feature !== "website") rememberPendingSample(sample);
      applyIntentRef.current(sample.feature, true);
      if (sample.feature !== "website") setSelectedSample(sample);
      window.requestAnimationFrame(() => studioPromptRef.current?.focus());
    };
    window.addEventListener(USE_SAMPLE_EVENT, handleSample);
    return () => window.removeEventListener(USE_SAMPLE_EVENT, handleSample);
  }, []);

  // Arrived in the workspace after picking an example on the landing page: select it again.
  const { samples: publishedSamples } = useSamples();
  useEffect(() => {
    if (!window.location.pathname.startsWith("/dashboard")) return;
    const pending = peekPendingSample();
    if (!pending) return;
    const match = publishedSamples.find((sample) => sample.id === pending.id);
    if (!match) return;
    clearPendingSample();
    if (activeModeRef.current !== match.feature) applyIntentRef.current(match.feature);
    setSelectedSample(match);
  }, [publishedSamples]);

  /** Draw the eye to the narration-language button (it shakes) right after Narration is chosen. */
  function pulseLanguage() {
    setLanguageShake(false);
    window.requestAnimationFrame(() => {
      setLanguageShake(true);
      if (languageShakeTimer.current) window.clearTimeout(languageShakeTimer.current);
      languageShakeTimer.current = window.setTimeout(() => setLanguageShake(false), 1500);
    });
  }
  useEffect(() => () => { if (languageShakeTimer.current) window.clearTimeout(languageShakeTimer.current); }, []);

  const attachedKeys = useMemo(() => new Set(files.map((file) => fileKey(file))), [files]);

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
    setFiles((current) => {
      const known = new Set(current.map((file) => fileKey(file)));
      return [...current, ...accepted.filter((file) => !known.has(fileKey(file)))].slice(0, 10);
    });
    // Remember them on this device so they can be reused later from the "+" menu.
    void rememberFiles(accepted, recentFilesOwner);
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
    // Every mode shows only the short idea text. The full direction stays hidden: studio modes send it as a
    // separate field, website mode sends it behind a marker the server splits off.
    if (activeMode === "video" || activeMode === "scenario") setPrompt(idea.displayText);
    else setBrief(idea.displayText);
    setCompactPanel(null);
    setError(null);
    void trackStudioEvent({ event: "idea_clicked", ideaId: idea.id, feature: idea.feature });
    window.requestAnimationFrame(() => {
      if (activeMode === "website") websiteBriefRef.current?.focus();
      else studioPromptRef.current?.focus();
    });
  }

  async function loadProductLink(link = productLink) {
    const typed = link.trim();
    if (!typed) return null;
    const value = looksLikeLink(typed) ? withScheme(typed) : typed;
    if (lastReadLinkRef.current === value && productData) return productData;
    // A newer link replaces an older one that is still being read; the older answer is then ignored.
    const readId = ++productReadId.current;
    setReadingProduct(true);
    setError(null);
    try {
      const data = await extractProductReference(value);
      if (readId !== productReadId.current) return null;
      lastReadLinkRef.current = value;
      setProductData(data);
      setChosenProductImages(data.images.slice(0, 1));
      if (!brief.trim() && data.description) setBrief(data.description.slice(0, 1200));
      return data;
    } catch (error) {
      if (readId !== productReadId.current) return null;
      lastReadLinkRef.current = "";
      setProductData(null);
      setChosenProductImages([]);
      setError(error instanceof ApiError && error.message
        ? error.message
        : "We couldn't read photos from that link. Upload a photo of the product instead.");
      return null;
    } finally {
      if (readId === productReadId.current) setReadingProduct(false);
    }
  }

  async function resolveSite(link = mapLink) {
    const value = link.trim();
    if (!value) return null;
    const readId = ++siteReadId.current;
    setResolvingSite(true);
    setError(null);
    try {
      const resolved = await resolveArchitectureLocation(value);
      if (readId !== siteReadId.current) return null;
      setSite(resolved);
      return resolved;
    } catch {
      if (readId !== siteReadId.current) return null;
      // An address that the server could not turn into a point is still kept as text.
      if (!/^https?:\/\//i.test(value) && !looksLikeCoordinates(value)) {
        const plain = { label: value, resolvedUrl: "" };
        setSite(plain);
        return plain;
      }
      setSite(null);
      setError("Couldn't identify this location. Paste a Google Maps link, type the address, or type coordinates like 31.5321, 35.0912.");
      return null;
    } finally {
      if (readId === siteReadId.current) setResolvingSite(false);
    }
  }

  // Links are read AS SOON AS they look valid (a short pause after typing, immediately on paste): nobody has to press
  // anything, and Generate simply waits until the reading is done.
  useEffect(() => {
    if (activeMode !== "photo" && activeMode !== "product-video") return;
    const typed = productLink.trim();
    if (!looksLikeLink(typed) || withScheme(typed) === lastReadLinkRef.current) return;
    const timer = window.setTimeout(() => { void loadProductLink(typed); }, 700);
    return () => window.clearTimeout(timer);
  }, [productLink, activeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeMode !== "architecture") return;
    const typed = mapLink.trim();
    if (!/^https?:\/\//i.test(typed) || site) return;
    const timer = window.setTimeout(() => { void resolveSite(typed); }, 500);
    return () => window.clearTimeout(timer);
  }, [mapLink, activeMode, site]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (compactPanel !== "style" && compactPanel !== "ideas") return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerRootRef.current?.contains(event.target)) setCompactPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompactPanel(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [compactPanel]);

  async function submit() {
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
        // The request is on its way (and saved for after sign-in), so the draft has done its job.
        clearPromptDraft();
        void onSubmit(
          normalizeWebsiteUrl(url),
          withHiddenDirection(brief.trim(), selectedIdea?.masterPrompt),
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
    const typedPrompt = isProduct || isInterior ? brief.trim() : prompt.trim();
    // Picking an example is enough of a brief on its own.
    const activePrompt = typedPrompt || (selectedSample ? (TEMPLATE_PROMPTS[activeMode] ?? "") : "");
    if (!activePrompt) {
      setError(
        activeMode === "scenario"
          ? "Describe the talking scene you want to create before generating."
          : activeMode === "interior"
            ? "Describe the space, measurements, design direction and output you want before generating."
          : activeMode === "architecture"
            ? "Describe the building, site placement and architectural direction before generating."
          : activeMode === "photo"
            ? "Describe the product-photo campaign you want before generating."
            : activeMode === "product-video"
              ? "Describe how you want the product video to look and move before generating."
              : "Describe the video you want to create before generating.",
      );
      studioPromptRef.current?.focus();
      return;
    }
    // Read a pasted-but-not-yet-read map link or product link automatically instead of ignoring it.
    let resolvedSite = site;
    if (activeMode === "architecture" && !resolvedSite && mapLink.trim()) resolvedSite = await resolveSite();
    if (activeMode === "architecture") {
      if (!resolvedSite) {
        setError("Add the plot's location: paste a Google Maps link or type the address.");
        return;
      }
      // Plot size and a site image are optional: the location and your words are enough to start.
    }
    let productUrl = productData?.url;
    let productReference = productData;
    let productImages = chosenProductImages;
    if (isProduct && files.length === 0 && productImages.length === 0 && productLink.trim()) {
      const data = await loadProductLink();
      if (!data) return;
      productUrl = data.url;
      productReference = data;
      productImages = data.images.slice(0, 1);
    }
    if (isInterior && activeMode === "interior" && files.length === 0) {
      setError("Attach at least one photo of the space, a plan, a sketch or an elevation.");
      return;
    }
    if (isProduct && files.length === 0 && productImages.length === 0) {
      setError("Paste a product link or upload a photo of the product. You only need one of the two.");
      return;
    }

    const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
    setError(null);
    clearPromptDraft();
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
      productUrl,
      productImageUrls: productImages,
      studioDirection: selectedIdea ? selectedIdea.masterPrompt : undefined,
      templateId: selectedSample?.id,
      productFacts: isProduct && productReference ? { title: productReference.title, description: productReference.description, facts: productReference.facts } : undefined,
      architecture: activeMode === "architecture" ? {
        location: resolvedSite?.label || resolvedSite?.resolvedUrl,
        latitude: resolvedSite?.latitude,
        longitude: resolvedSite?.longitude,
        mapUrl: resolvedSite?.resolvedUrl || undefined,
        plotWidth: Number(plotWidth) || undefined,
        plotDepth: Number(plotDepth) || undefined,
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
  const availableModels = modelsFor(modelFamily);
  const selectedModel = publicModel(settings.modelId);
  const exactCredits = activeMode === "photo" || (isInteriorMode && interiorOutput === "images")
    ? estimateRenderCredits("photos", true, 8, settings.outputQuality, settings.modelId)
    : estimateRenderCredits("video", settings.audioMode !== "voice_music", durationSeconds, settings.outputQuality, settings.modelId);
  const hasBrief = Boolean(selectedSample) && activeMode !== "website";
  // Studio modes stay clickable once there is a brief: a click that is missing something explains exactly
  // what (link, photo, location, size) instead of leaving a silently disabled button.
  // While a pasted link is being read the button waits; it never asks the person to click anything to continue.
  const linkBusy = readingProduct || resolvingSite;
  const submitDisabled = disabled || linkBusy || (
    activeMode === "website"
      ? !url.trim() || !brief.trim()
      : isProductMode || isInteriorMode
        ? !brief.trim() && !hasBrief
        : !prompt.trim() && !hasBrief
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

  // The Generate button. On wide screens it sits at the end of the settings row (like a command bar); on small
  // screens it keeps its own full-width row below.
  const submitButton = (extraClass: string) => (
    <button
      type="button"
      onClick={submit}
      disabled={submitDisabled}
      className={`premium-button creator-primary-button flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-signature px-5 text-sm font-bold text-white shadow-violet transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${extraClass}`}
    >
      {/* an <i>, not a <span>: the button's sizing rule treats the SECOND span as the credits badge */}
      {linkBusy && <i className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" aria-hidden="true" />}
      <span>{linkBusy ? "Reading your link…" : landingWebsitePreview && activeMode === "website" ? "Continue to video" : createLabel}</span>
      {showCreditPricing && !linkBusy && <span className="rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[9px] font-semibold text-white/90">{exactCredits} credits</span>}
      <ArrowRight size={15} />
    </button>
  );

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

      {/* On the landing page the features live in the navbar, so the box starts straight at its fields. */}
      {!landingWebsitePreview && (
      <div className={`relative border-b border-white/[.08] ${compactLayout ? "p-2" : "p-2.5 sm:p-3"}`}>
        {/* The workspace keeps the feature tabs here. */}
        <ScrollRow drag className="gap-1 pb-0.5 max-sm:grid max-sm:grid-cols-4 max-sm:gap-1.5 max-sm:overflow-visible" role="tablist" ariaLabel="Creation mode" activeKey={activeMode}>
          {CREATION_MODES.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeMode === id}
              onClick={() => applyIntent(id, true)}
              className={`flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-semibold transition max-sm:min-h-[60px] max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:text-[10.5px] sm:px-4 sm:text-[11px] ${
                activeMode === id
                  ? "bg-mint text-[#10231f] shadow-[0_10px_26px_-18px_rgba(114,255,222,.9)]"
                  : "text-text-muted hover:bg-mint/[.08] hover:text-white"
              }`}
            >
              <Icon size={14} className="max-sm:h-[19px] max-sm:w-[19px]" />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{short}</span>
            </button>
          ))}
        </ScrollRow>
      </div>
      )}

      <div className={`relative ${compactLayout ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
        {landingWebsitePreview && selectedSample && (
          // The landing page hides the examples strip, so say clearly when an example from the row below is attached.
          <button
            type="button"
            onClick={() => setSelectedSample(null)}
            aria-label="Remove the attached example"
            className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 text-[11px] font-semibold text-mint transition hover:bg-mint/20"
          >
            Example attached <X size={12} />
          </button>
        )}
        {isProductMode && (
          <div className="mb-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-3.5">
            <p className="text-xs font-semibold text-white">Product link <span className="font-normal text-white/45">· optional</span></p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[.10] bg-[#0b0818] px-3 transition focus-within:border-violet/50">
                <PackageOpen size={14} className="shrink-0 text-violet" />
                <input
                  type="url"
                  value={productLink}
                  onChange={(event) => {
                    setProductLink(event.target.value);
                    // Photos read from the previous link must never be used with a different one.
                    if (withScheme(event.target.value) !== lastReadLinkRef.current) { setProductData(null); setChosenProductImages([]); }
                  }}
                  onBlur={() => { if (productLink.trim()) void loadProductLink(); }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text").trim();
                    if (!/^https?:\/\//i.test(pasted)) return;
                    event.preventDefault();
                    setProductLink(pasted);
                    void loadProductLink(pasted);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void loadProductLink();
                  }}
                  placeholder="Paste a link to the product page"
                  aria-label="Product link (optional)"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-white/35 sm:text-xs"
                />
              </div>
            </div>
            <LinkStatus active={readingProduct} skeleton messages={["Reading the product page…", "Still working: some shops load slowly…", "Trying a deeper read of this page. Almost there…"]} />
            <p className="mt-2 text-[11px] leading-4 text-white/45">
              {productData
                ? "Choose the photos to use below. You don't need to upload anything else."
                : "We'll use the photos on that page. Or skip the link and upload your own product photos. You only need one of the two."}
            </p>
            {productData && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-[12px] font-semibold text-white">{productData.title || "Product photos"}</p>
                  <span className="shrink-0 text-[11px] text-white/45">{chosenProductImages.length} selected</span>
                </div>
                <ScrollRow className="mt-2 gap-2 pb-1" nudge={false}>
                  {productData.images.map((image) => {
                    const selected = chosenProductImages.includes(image);
                    return (
                      <button key={image} type="button" aria-label="Use product image" aria-pressed={selected}
                        onClick={() => setChosenProductImages((current) => current.includes(image) ? current.filter((url) => url !== image) : [...current, image].slice(0, 6))}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${selected ? "border-mint" : "border-transparent opacity-65 hover:opacity-100"}`}>
                        <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />
                        {selected && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-mint text-[9px] font-bold text-[#10231f]">✓</span>}
                      </button>
                    );
                  })}
                </ScrollRow>
              </div>
            )}
          </div>
        )}

        {activeMode === "architecture" && (
          <div className="mb-3 space-y-3 rounded-2xl border border-white/[.08] bg-white/[.025] p-3.5">
            <div>
              <p className="text-xs font-semibold text-white">Where will it be built?</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[.10] bg-[#0b0818] px-3 transition focus-within:border-violet/50">
                  <MapPin size={14} className="shrink-0 text-mint" />
                  <input
                    type="text"
                    value={mapLink}
                    onChange={(event) => { setMapLink(event.target.value); setSite(null); }}
                    onBlur={() => { if (mapLink.trim() && !site) void resolveSite(); }}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData("text").trim();
                      if (!/^https?:\/\//i.test(pasted) && !looksLikeCoordinates(pasted)) return;
                      event.preventDefault();
                      setMapLink(pasted);
                      setSite(null);
                      void resolveSite(pasted);
                    }}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void resolveSite(); } }}
                    placeholder="Google Maps link, address or coordinates"
                    aria-label="Google Maps link, address or coordinates"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-white/35 sm:text-xs"
                  />
                </div>
              </div>
              <LinkStatus active={resolvingSite} messages={["Finding the exact place on the map…", "Still working on the location…", "This map link is slow to open. Almost there…"]} />
              {site && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-mint"><Check size={13} /> {site.label || `${site.latitude}, ${site.longitude}`}</p>}
              {site && typeof site.latitude === "number" && typeof site.longitude === "number" && (
                <div className="mt-2.5 overflow-hidden rounded-xl border border-white/[.10] bg-[#0b0818]" data-testid="site-preview">
                  <iframe title="The exact spot on the map" src={mapPreviewUrl(site.latitude, site.longitude)} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full border-0" />
                  <div className="space-y-1 px-3 py-2 text-[11px] leading-4 text-white/60">
                    <p><span className="font-semibold text-white">Is this the right spot?</span> The design is placed exactly here: <span className="font-mono text-white/80">{site.latitude.toFixed(6)}, {site.longitude.toFixed(6)}</span></p>
                    <p>{site.imageryAvailable ? "Satellite and street views of this spot are used for the design." : "For a design that matches your plot exactly, add a screenshot of it (satellite view) below."}</p>
                    <p><a href={`https://www.google.com/maps?q=${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`} target="_blank" rel="noreferrer" className="font-semibold text-mint hover:underline">Open this spot in Google Maps</a></p>
                  </div>
                </div>
              )}
              {site && site.precision !== "pin" && site.precision !== "view" && typeof site.latitude !== "number" && (
                <p className="mt-1.5 text-[11px] leading-4 text-amber-200">
                  We couldn&apos;t find exact coordinates for this address. For the exact place, paste the Google Maps share link or type coordinates like 31.5321, 35.0912.
                </p>
              )}
              {site?.precision === "view" && (
                <p className="mt-1.5 text-[11px] leading-4 text-amber-200">
                  This link shows the map view, not an exact pin, so the spot may be a little off. For the exact place, open it in Google Maps, tap Share and paste that link.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <NumberStepper label="Plot width" unit="m" value={plotWidth} onChange={setPlotWidth} min={1} max={5000} step={1} decimal placeholder="0" disabled={estimatedScale} />
              <NumberStepper label="Plot depth" unit="m" value={plotDepth} onChange={setPlotDepth} min={1} max={5000} step={1} decimal placeholder="0" disabled={estimatedScale} />
              <NumberStepper label="Floors" value={floorCount} onChange={setFloorCount} min={1} max={200} step={1} placeholder="Any" />
              <NumberStepper label="Setback" unit="m" value={setback} onChange={setSetback} min={0} max={500} step={0.5} decimal placeholder="0" />
            </div>

            <ToggleRow
              checked={estimatedScale}
              onChange={setEstimatedScale}
              label="Estimate the plot size"
              hint="Turn on if you don't know the exact width and depth."
            />

            <p className="text-[11px] leading-4 text-white/45">
              Paste the link and say what you want, for example “a clothes shop here”. A screenshot of the plot or the building to place (via “Add site / building”) is optional but makes it more exact.
            </p>
          </div>
        )}

        {(activeMode === "interior" || activeMode === "architecture") && (
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
              {activeMode === "website" ? "Create a video from your website" : activeMode === "video" ? "Create an AI video" : activeMode === "photo" ? "Create product photos" : activeMode === "product-video" ? "Create a product video" : activeMode === "interior" ? "Design an interior" : activeMode === "architecture" ? "Place architecture on a real site" : "Create a talking scene"}
            </p>
            <p className="mt-1 text-[11px] text-text-dim">Describe what you want, then use Ideas only when you want creative inspiration.</p>
          </div>
        )}

        <div className="space-y-3">
          {activeMode === "website" && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-white">Website URL</span>
              <div className="flex items-center gap-3 rounded-2xl border border-mint/30 bg-[#0b0818] px-3 transition focus-within:border-mint/60 focus-within:ring-2 focus-within:ring-mint/10">
                <span className="globe-orbit flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-mint/20 bg-mint/[.08] text-mint" aria-hidden="true"><Globe2 size={17} /></span>
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
              <span>{activeMode === "website" ? "What should the video highlight?" : activeMode === "video" ? "Describe your video" : activeMode === "photo" ? "Describe the product photos" : activeMode === "product-video" ? "Describe the product video" : activeMode === "interior" ? "Describe the space, measurements and design" : activeMode === "architecture" ? "Describe the building and site placement" : "Describe the talking scene"}</span>
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
                        : activeMode === "interior"
                          ? "Example: Redesign this shop using the supplied measurements, white shelving and magnetic lighting."
                          : activeMode === "architecture"
                            ? "Example: Place a modern two-floor commercial building on this exact site while respecting the plot dimensions and road setback."
                            : "Example: Two founders explain the product naturally in a bright studio."
              }
              rows={compactLayout ? 3 : 4}
              disabled={disabled}
              className="creator-field w-full resize-none rounded-2xl border border-white/[.14] bg-[#0b0818] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-violet/55 focus:ring-2 focus:ring-violet/10"
            />
          </label>
        </div>

        <div className="generation-toolbar" role="group" aria-label="Generation settings">
          <div className="generation-creative-actions" role="group" aria-label="Creative tools">
            <ComposerPlusMenu
              disabled={disabled}
              addLabel={isProductMode ? "Upload product photo" : activeMode === "interior" ? "Add space photos or plans" : activeMode === "architecture" ? "Add site or building reference" : "Add photos"}
              attachedCount={files.length}
              attachedKeys={attachedKeys}
              maxFiles={10}
              onPickFiles={() => { setOpenSettingMenu(null); inputRef.current?.click(); }}
              onUseRecent={(file) => addFiles([file])}
              recentOwner={recentFilesOwner}
              styleValue={activeMode === "website" ? (selectedWebsiteRecipe ? WEBSITE_RECIPES.find((recipe) => recipe.mode === selectedWebsiteRecipe)?.label : "Auto") : undefined}
              onStyle={activeMode === "website" ? () => { setOpenSettingMenu(null); setCompactPanel("style"); } : undefined}
            />

            <button
              type="button"
              onClick={() => {
                setOpenSettingMenu(null);
                toggleIdeas();
              }}
              aria-expanded={compactPanel === "ideas"}
              className={controlClass(compactPanel === "ideas")}
            >
              Ideas
              {selectedIdea && <span className="rounded-full bg-mint/10 px-1.5 py-0.5 text-[8px] text-mint">Added</span>}
              <ChevronDown size={12} className={`transition-transform ${compactPanel === "ideas" ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className="generation-output-controls" role="group" aria-label="Output settings">
            <ModelPicker
              models={availableModels}
              selected={selectedModel}
              quality={settings.outputQuality}
              open={compactPanel === "model"}
              onOpenChange={(next) => { setOpenSettingMenu(null); setCompactPanel(next ? "model" : null); }}
              onSelect={(id) => { chooseModel(id); setCompactPanel(null); }}
              trigger={
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-mint/[.08] text-mint">
                  {modelFamily === "video" ? <Video size={13} /> : modelFamily === "interior" ? <House size={13} /> : <ImageIcon size={13} />}
                </span>
              }
            />

          {selectedModel.supportsDuration && (
            <ControlMenu open={openSettingMenu === "duration"} onClose={() => setOpenSettingMenu(null)} label="Video duration" wide trigger={
              <button
                type="button"
                onClick={() => {
                  setCompactPanel(null);
                  setOpenSettingMenu((current) => current === "duration" ? null : "duration");
                }}
                aria-label={`Duration: ${durationSeconds} seconds`}
                aria-expanded={openSettingMenu === "duration"}
                aria-haspopup="dialog"
                className={controlClass(openSettingMenu === "duration")}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.045] text-mint">
                  <Clock size={12} />
                </span>
                <span>{durationSeconds}s</span>
                <ChevronDown size={12} className={`transition-transform ${openSettingMenu === "duration" ? "rotate-180" : ""}`} />
              </button>}>

              {openSettingMenu === "duration" && (
                <div
                  role="dialog"
                  aria-label="Video duration"
                  className="p-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-white">Video duration</p>
                      <p className="mt-0.5 text-[8px] text-white/38">Choose a quick preset or enter any whole second from 8 to 60.</p>
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

                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {DURATION_PRESETS.map((seconds) => {
                      const active = !usingCustomDuration && durationSeconds === seconds;
                      return (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => applyDurationPreset(seconds)}
                          className={`flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-2 transition ${
                            active
                              ? "border-mint/35 bg-mint/[.10] text-mint"
                              : "border-white/[.08] bg-white/[.035] text-white/70 hover:border-violet/30 hover:bg-white/[.055] hover:text-white"
                          }`}
                        >
                          <Clock size={12} className={active ? "text-mint" : "text-white/40"} />
                          <span className="mt-1 text-[10px] font-semibold">{seconds}s</span>
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
                    <p className="mt-2 text-[8px] leading-3.5 text-white/32">Your value is saved only after you finish typing, so clearing or replacing the number no longer jumps back to 8 while you type.</p>
                  </div>
                </div>
              )}
            </ControlMenu>
          )}

          <CompactDropdown
            onClose={() => setOpenSettingMenu(null)}
            value={settings.aspectRatio}
            options={[
              { value: "9:16", label: "9:16", helper: "Portrait · Reels", icon: <FormatIcon ratio="9:16" size={20} /> },
              { value: "16:9", label: "16:9", helper: "Landscape · YouTube", icon: <FormatIcon ratio="16:9" size={20} /> },
              { value: "1:1", label: "1:1", helper: "Square · Feed", icon: <FormatIcon ratio="1:1" size={20} /> },
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
            icon={<FormatIcon ratio="9:16" size={16} />}
            ariaLabel="Aspect ratio"
          />

          {selectedModel.supportedQualities.length > 1 ? (
            <CompactDropdown
              onClose={() => setOpenSettingMenu(null)}
              value={settings.outputQuality}
              options={selectedModel.supportedQualities.map((quality) => ({
                value: quality,
                label: quality === "4k" ? "Ultra HD" : "Full HD",
                helper: quality === "4k" ? "4K · max detail" : "1080p · fast",
                icon: <QualityGlyph quality={quality} size={18} />,
                iconBare: true,
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
              icon={<QualityGlyph quality="1080p" size={18} />}
              ariaLabel="Quality"
            />
          ) : (
            <span className="generation-control generation-control-static" title="Fixed quality for this model">
              <QualityGlyph quality={selectedModel.supportedQualities[0] === "4k" ? "4k" : "1080p"} size={18} />
              {selectedModel.quality}
            </span>
          )}

          {selectedModel.audioModes.length > 0 && (
            <CompactDropdown
              onClose={() => setOpenSettingMenu(null)}
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
                if (value === "voice_music") pulseLanguage();
              }}
              icon={<Volume2 size={12} />}
              ariaLabel="Audio"
              align="right"
            />
          )}
          </div>
          <div className="generation-submit-slot">{submitButton("w-full")}</div>
        </div>

        {selectedModel.audioModes.includes("voice_music") && settings.audioMode === "voice_music" && (
          <div className="mt-2 flex justify-end">
            <div className={languageShake ? "attention-shake rounded-xl" : ""}>
              <CompactDropdown
                onClose={() => setOpenSettingMenu(null)}
                value={settings.narrationLanguage}
                options={[
                  { value: "auto", label: "Auto", helper: "Speaks the language of your prompt", icon: <Languages size={13} /> },
                  ...NARRATION_LANGUAGES.map(([code, label]) => ({ value: code, label, icon: <Languages size={13} /> })),
                ]}
                open={openSettingMenu === "language"}
                onToggle={() => {
                  setCompactPanel(null);
                  setLanguageShake(false);
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
          </div>
        )}

        {compactPanel === "style" && activeMode === "website" && (
          <div className="mt-2 rounded-2xl border border-white/[.08] bg-white/[.025] p-3" role="radiogroup" aria-label="Video style">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <p className="text-[12px] font-semibold text-white">Choose a style</p>
              <p className="text-[11px] text-white/40">How should the video feel?</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[{ mode: null, label: "Auto", helper: "We pick the best fit", icon: SlidersHorizontal, tint: "from-white/25 to-white/10" }, ...WEBSITE_RECIPES].map((recipe) => {
                const active = (selectedWebsiteRecipe ?? null) === recipe.mode;
                const Icon = recipe.icon;
                return (
                  <button
                    key={recipe.mode ?? "auto"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedWebsiteRecipe(recipe.mode);
                      setSettings((current) => ({ ...current, mode: recipe.mode ?? "video" }));
                      setCompactPanel(null);
                    }}
                    className={`group relative flex items-start gap-2.5 rounded-2xl border p-2.5 text-left transition active:scale-[.98] ${
                      active ? "border-mint/60 bg-mint/[.09] shadow-[0_12px_30px_-20px_rgba(52,211,153,.9)]" : "border-white/[.08] bg-white/[.02] hover:border-white/25 hover:bg-white/[.05]"
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)] ${recipe.tint}`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight text-white">{recipe.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-[1.3] text-white/50">{recipe.helper}</span>
                    </span>
                    {active && (
                      <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-mint text-[#10231f]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {compactPanel === "ideas" && (
          <div className="mt-2 rounded-2xl border border-violet/15 bg-violet/[.035] p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white">Pick a creative direction</p>
                <p className="mt-0.5 text-[11px] text-white/45">Add your own words to change anything.</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setCompactPanel(null)} aria-label="Close ideas" className="grid h-7 w-7 place-items-center rounded-lg text-text-dim hover:bg-white/5 hover:text-white"><X size={12} /></button>
              </div>
            </div>
            <MasterIdeas ideas={masterIdeas} context={ideaContext} selectedId={selectedIdea?.id ?? null} onSelect={applyMasterIdea} />
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl border border-pink/20 bg-pink/5 px-3 py-2 text-xs text-pink">{error}</p>}

        {/* "mt-4" matters: creator-cta-position.css sizes the Generate button only inside a row with that class. */}
        <div className={`mt-4 flex flex-col gap-2 sm:flex-row sm:items-center ${compactLayout ? "generation-row-inline" : ""}`}>
          {!compactLayout && (
            <div className="flex-1 text-[9px] text-text-dim">
              {isProductMode && !files.length && !chosenProductImages.length && !productLink.trim() ? "Paste a product link or upload a product photo." : activeMode === "interior" && !files.length ? "Add space references before generating." : `Your setup: ${isVideoMode ? `${durationSeconds}s · ` : ""}${formatSummary} · ${selectedModel.supportedQualities.length === 1 ? selectedModel.quality : (settings.outputQuality === "4k" ? "4K" : "1080p")}`}
            </div>
          )}
          {submitButton("sm:flex-none sm:min-w-[260px]")}
        </div>

        {!landingWebsitePreview && <SampleStrip
          feature={activeMode}
          selectedId={selectedSample?.id ?? null}
          onSelect={(sample) => { setSelectedSample(sample); setError(null); }}
          selectable={activeMode !== "website"}
        />}

        {previews.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-[11px] font-medium text-white/50">{previews.length} attached</p>
              <button type="button" onClick={() => setFiles([])} className="text-[11px] font-medium text-white/40 transition hover:text-white">Remove all</button>
            </div>
            <ScrollRow className="gap-2 pb-1" nudge={false}>
              {previews.map((preview, index) => (
                <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="group flex w-[196px] shrink-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[.04] p-1.5 pr-2 transition hover:border-white/20 hover:bg-white/[.06]">
                  <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-tight text-white" title={preview.file.name}>{preview.file.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{preview.file.type.replace("image/", "").replace("jpeg", "jpg").toUpperCase()} · {fileSize(preview.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove ${preview.file.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </ScrollRow>
          </div>
        )}

      </div>
    </div>
  );
}
