import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUp,
  Lightbulb,
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
  ImagePlus,
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
  UserRound,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { normalizeWebsiteUrl } from "@/lib/websiteUrl";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import { defaultModelFor, modelsFor, publicModel, type PublicModelId } from "@/lib/generationModels";
import {
  composeIdeaText,
  getIdeasForIntent,
  splitIdeaText,
  referenceHintForIdea,
  type CreativeIdea,
  type IdeaContext,
} from "@/lib/creativeIdeas";
import { trackStudioEvent } from "@/lib/studio-api";
import { withHiddenDirection } from "@/lib/hiddenDirection";
import { clearPromptDraft, loadPromptDraft, savePromptDraft } from "@/lib/promptDraft";
import { useAutoGrow } from "@/lib/useAutoGrow";
import { looksLikeLink, withScheme } from "@/lib/linkStatus";
import { classifyLink, findLinkInText, linkHost } from "@/lib/smartLink";
import { LinkStatus } from "./LinkStatus";
import { CREATION_FEATURES } from "@/lib/creationFeatures";
import { CREATION_INTENT_EVENT, publishCreationMode } from "@/lib/creationMode";
import { ScrollRow } from "@/components/ui/scroll-row";
import { NumberStepper } from "@/components/ui/number-stepper";
import { ToggleRow } from "@/components/ui/toggle-row";
import { SampleStrip } from "./SampleStrip";
import { USE_SAMPLE_EVENT, clearPendingSample, peekPendingSample, rememberPendingSample, useSamples, type Sample, type UseSampleDetail } from "@/lib/showcase";
import { ComposerPlusMenu } from "./ComposerPlusMenu";
import { DrawingCard, useDrawingAttachment } from "./DrawingCard";
import { SiteStreetView } from "./SiteStreetView";
import { EMPTY_SELECTION, isMarked, selectionToRequest, type SiteSelection } from "@/lib/siteTarget";
import { isDrawingFile } from "@/lib/drawingFile";
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
  "video" | "tutorial" | "buy" | "tour" | "linkedin" | "demo" | "character"
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
  /** An engineer's CAD drawing (.dxf) for Interior Design / Architecture, and the units the customer confirmed for it. */
  drawing?: File;
  drawingUnits?: string;
}

const TEMPLATE_PROMPTS: Partial<Record<CreationIntent, string>> = {
  photo: "Recreate this style with my product.",
  "product-video": "Recreate this style with my product.",
  video: "Make a video in the style of this example.",
  scenario: "Recreate this scene with my references.",
  interior: "Redesign my space in the style of this example.",
  architecture: "Place my building on my site in the style of this example.",
};

/** Used when someone sends a link or a photo with no message: the result should still be a good one. */
const DEFAULT_WEBSITE_BRIEF = "Show what this website offers, its strongest benefits, and end with a clear call to action.";
const DEFAULT_PROMPTS: Partial<Record<CreationIntent, string>> = {
  photo: "Clean, premium studio photos of this product with soft light.",
  "product-video": "A premium product video: a slow reveal, close-up details and a strong final hero shot.",
  interior: "Redesign this space in a clean, modern style and keep its real proportions.",
  architecture: "Place a modern building on this site that fits its surroundings.",
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
  { mode: "character", label: "Character story", helper: "Someone uses your site", icon: UserRound, tint: "from-rose-400 to-amber-300" },
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
  // What the customer pointed at on the site: Street View camera, the spot they tapped, and whether it is the whole building,
  // one shop or unit, one floor or empty land.
  const [siteSelection, setSiteSelection] = useState<SiteSelection>(EMPTY_SELECTION);
  // A product link the shop would not let us read: what we kept from it and what the person can do next.
  const [blockedProduct, setBlockedProduct] = useState<{ host: string; name: string; blocked: boolean; slow?: boolean; description?: string; facts?: Record<string, string> } | null>(null);
  const [plotWidth, setPlotWidth] = useState("");
  const [plotDepth, setPlotDepth] = useState("");
  const [floorCount, setFloorCount] = useState("");
  const [setback, setSetback] = useState("");
  // On by default: most customers do not know their exact plot size. Turning it off reveals width and depth.
  const [estimatedScale, setEstimatedScale] = useState(true);
  useEffect(() => { setSiteSelection(EMPTY_SELECTION); }, [site?.latitude, site?.longitude]);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [languageShake, setLanguageShake] = useState(false);
  const languageShakeTimer = useRef<number | null>(null);
  const lastReadLinkRef = useRef("");
  // A link the shop would not let us read: not read again on every blur, since the answer would be the same.
  const lastFailedLinkRef = useRef("");
  const productReadId = useRef(0);
  const siteReadId = useRef(0);
  const [compactPanel, setCompactPanel] = useState<"style" | "ideas" | "model" | null>(null);
  const [openSettingMenu, setOpenSettingMenu] = useState<"duration" | "aspect" | "quality" | "audio" | "language" | "style" | "output" | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState(String(DEFAULT_SETTINGS.durationSeconds));
  const [usingCustomDuration, setUsingCustomDuration] = useState(false);
  const [settings, setSettings] = useState<WebsiteGenerationSettings>(DEFAULT_SETTINGS);
  const [selectedWebsiteRecipe, setSelectedWebsiteRecipe] = useState<WebsiteProductionMode | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<CreativeIdea | null>(null);
  const [interiorOutput, setInteriorOutput] = useState<"images" | "video">("images");
  const [files, setFiles] = useState<File[]>([]);
  // An engineer's CAD drawing (Interior Design and Architecture): read on the server and checked by the customer first.
  const drawingAttachment = useDrawingAttachment();
  const drawingInputRef = useRef<HTMLInputElement | null>(null);
  const cadMode = activeMode === "interior" || activeMode === "architecture";
  useEffect(() => { if (!cadMode) drawingAttachment.remove(); }, [cadMode, drawingAttachment.remove]);
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
    // Only the person's own words steer which ideas are offered, never the master prompt an idea put there.
    prompt: splitIdeaText(activeMode === "video" || activeMode === "scenario" ? prompt : brief).details,
    referenceNames: files.map((file) => file.name),
    hasReferences: files.length > 0,
  }), [activeMode, brief, files, prompt, url]);

  const masterIdeas = useMemo(
    () => getIdeasForIntent(activeMode, ideaContext, 8),
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
      drawingAttachment.remove();
      setSelectedSample(null);
      setProductData(null);
      setChosenProductImages([]);
      setProductLink("");
    }
  }, [recentFilesOwner]);

  // The prompt box grows with the text (up to ~40% of the screen) and scrolls inside after that.
  useAutoGrow(activeMode === "website" ? websiteBriefRef : studioPromptRef, activeMode === "video" || activeMode === "scenario" ? prompt : brief, { minPx: 60, maxPx: 240 });

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
      if (isDrawingFile(file)) {
        if (cadMode) drawingAttachment.attach(file);
        else nextError = "CAD drawings (.dxf) can be used with Interior Design and Architecture.";
        continue;
      }
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
    // The chat box receives the idea's full master prompt (readable and editable). Anything the person had
    // already written stays underneath it. Only the feature's safety text travels hidden (see below).
    const own = splitIdeaText(activeMode === "video" || activeMode === "scenario" ? prompt : brief).details;
    const text = composeIdeaText(idea, own);
    if (activeMode === "video" || activeMode === "scenario") setPrompt(text);
    else setBrief(text);
    setCompactPanel(null);
    setError(null);
    void trackStudioEvent({ event: "idea_clicked", ideaId: idea.id, feature: idea.feature });
    window.requestAnimationFrame(() => {
      if (activeMode === "website") websiteBriefRef.current?.focus();
      else studioPromptRef.current?.focus();
    });
  }

  async function loadProductLink(link = productLink, explain = false) {
    const typed = link.trim();
    if (!typed) return null;
    const value = looksLikeLink(typed) ? withScheme(typed) : typed;
    if (lastReadLinkRef.current === value && productData) return productData;
    if (lastFailedLinkRef.current === value) {
      if (explain) setError("Add one photo of the product (see the note above), then press Create again.");
      return null;
    }
    // A newer link replaces an older one that is still being read; the older answer is then ignored.
    const readId = ++productReadId.current;
    setReadingProduct(true);
    setError(null);
    setBlockedProduct(null);
    try {
      const data = await extractProductReference(value);
      if (readId !== productReadId.current) return null;
      lastReadLinkRef.current = value;
      lastFailedLinkRef.current = "";
      setProductData(data);
      setChosenProductImages(data.images.slice(0, 1));
      if (!brief.trim() && data.description) setBrief(data.description.slice(0, 1200));
      return data;
    } catch (error) {
      if (readId !== productReadId.current) return null;
      lastReadLinkRef.current = "";
      setProductData(null);
      setChosenProductImages([]);
      if (error instanceof ApiError && (error.code === "PRODUCT_BLOCKED" || error.code === "PRODUCT_IMAGES_MISSING" || error.code === "PRODUCT_TIMEOUT" || error.code === "PRODUCT_UNSUPPORTED_RESPONSE")) {
        // Not an error screen: the page keeps the product's name from the link and shows the quick ways to add a photo.
        let host = "That shop";
        try { host = new URL(value).hostname.replace(/^www\./i, ""); } catch { /* keep the generic name */ }
        lastFailedLinkRef.current = value;
        // Whatever the page DID give us (name, description, facts) is kept: only the missing photo is asked for.
        setBlockedProduct({ host, name: error.productName ?? "", blocked: error.code === "PRODUCT_BLOCKED", slow: error.code === "PRODUCT_TIMEOUT", description: error.productDescription, facts: error.productFacts });
        if (!brief.trim() && error.productDescription) setBrief(error.productDescription.slice(0, 1200));
        if (explain) setError("Add one photo of the product (see the note above), then press Create again.");
        return null;
      }
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

    let websiteUrl = url;
    let text = brief;
    const pending = findLinkInText(text, true);
    if (pending && linkSlotOpen() && (activeMode !== "video" && activeMode !== "scenario" || !pending.rest)) {
      if (activeMode === "website" && classifyLink(pending.link) === "website") {
        websiteUrl = withScheme(pending.link);
        text = pending.rest;
        setUrl(websiteUrl);
        setBrief(text);
      } else if (routeLink(pending.link, pending.rest)) {
        // The link now sits in its own chip and is being read; one more press sends it.
        return;
      }
    }

    const activeModel = publicModel(settings.modelId);
    const safeQuality = activeModel.supportedQualities.includes(settings.outputQuality)
      ? settings.outputQuality
      : (activeModel.supportedQualities[0] ?? "1080p");
    const safeAudioMode = activeModel.audioModes.includes(settings.audioMode)
      ? settings.audioMode
      : (activeModel.audioModes[0] ?? "silent");

    if (activeMode === "website") {
      if (!websiteUrl.trim() && files.length === 0) {
        setError("Paste your website link, or add screenshots of your website with the + button.");
        websiteBriefRef.current?.focus();
        return;
      }
      try {
        setError(null);
        // The request is on its way (and saved for after sign-in), so the draft has done its job.
        clearPromptDraft();
        void onSubmit(
          // No address but photos: the person's own website photos ARE the source.
          websiteUrl.trim() ? normalizeWebsiteUrl(websiteUrl) : "",
          // A link on its own is enough: an empty message gets a sensible default story.
          withHiddenDirection(text.trim() || DEFAULT_WEBSITE_BRIEF, selectedIdea?.guardrail),
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
    const typedPrompt = text.trim();
    const hasSource = files.length > 0 || Boolean(productLink.trim()) || chosenProductImages.length > 0 || Boolean(site) || Boolean(mapLink.trim()) || Boolean(drawingAttachment.drawing);
    // Picking an example, or adding a link or a photo, is enough of a brief on its own.
    const activePrompt = typedPrompt || (selectedSample ? (TEMPLATE_PROMPTS[activeMode] ?? "") : "") || (hasSource ? (DEFAULT_PROMPTS[activeMode] ?? "") : "");
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
      if (isMarked(siteSelection) && siteSelection.kind === null) {
        setError("You marked a spot. Choose what it is: the whole building, one shop or unit, one floor, or empty land.");
        return;
      }
      // Plot size and a site image are optional: the location and your words are enough to start.
    }
    let productUrl = productData?.url;
    let productReference = productData;
    let productImages = chosenProductImages;
    if (isProduct && files.length === 0 && productImages.length === 0 && productLink.trim()) {
      const data = await loadProductLink(undefined, true);
      if (!data) return;
      productUrl = data.url;
      productReference = data;
      productImages = data.images.slice(0, 1);
    }
    if (isInterior && activeMode === "interior" && files.length === 0 && !drawingAttachment.drawing) {
      setError("Attach at least one photo of the space, a plan, a sketch, an elevation or a CAD drawing.");
      return;
    }
    if (cadMode && drawingAttachment.drawing && drawingAttachment.blockReason) {
      setError(drawingAttachment.blockReason);
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
      studioDirection: selectedIdea ? selectedIdea.guardrail : undefined,
      drawing: cadMode ? drawingAttachment.drawing?.file : undefined,
      // exactly the units the customer was shown, so what they checked is what the server uses
      drawingUnits: cadMode ? drawingAttachment.drawing?.preview?.units.choice : undefined,
      templateId: selectedSample?.id,
      productFacts: isProduct && productReference ? { title: productReference.title, description: productReference.description, facts: productReference.facts } : isProduct && blockedProduct?.name ? { title: blockedProduct.name, description: blockedProduct.description ?? "", facts: blockedProduct.facts ?? {} } : undefined,
      architecture: activeMode === "architecture" ? {
        location: resolvedSite?.label || resolvedSite?.resolvedUrl,
        latitude: resolvedSite?.latitude,
        longitude: resolvedSite?.longitude,
        mapUrl: resolvedSite?.resolvedUrl || undefined,
        plotWidth: estimatedScale ? undefined : Number(plotWidth) || undefined,
        plotDepth: estimatedScale ? undefined : Number(plotDepth) || undefined,
        floors: Number(floorCount) || undefined,
        setback: Number(setback) || undefined,
        estimatedScale,
        ...selectionToRequest(siteSelection),
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
  const submitDisabled = disabled || linkBusy || !(
    brief.trim() || url.trim() || files.length > 0 || productLink.trim() || mapLink.trim() || hasBrief || drawingAttachment.drawing
  );
  const createLabel = activeMode === "website"
    ? "Create website video"
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

  // ---- One box: links typed or pasted into the message are picked up and filed where they belong. ----

  /** Whether the open feature still has room for a link (each feature reads one). */
  function linkSlotOpen() {
    const mode = activeModeRef.current;
    if (mode === "website") return !url.trim();
    if (mode === "photo" || mode === "product-video") return !productLink.trim();
    if (mode === "architecture") return !mapLink.trim();
    if (mode === "interior") return false;
    // AI video and talking scenes take no link: a link alone (nothing else written) means "make it from this".
    return !brief.trim();
  }

  /** Files a link under the right feature (switching feature when the link is clearly something else). */
  function routeLink(link: string, rest: string | null): boolean {
    const kind = classifyLink(link);
    const mode = activeModeRef.current;
    const productMode = mode === "photo" || mode === "product-video";
    if (mode === "interior") return false;
    if (kind === "map" || mode === "architecture") {
      if (mode !== "architecture") applyIntent("architecture", true);
      setMapLink(withScheme(link));
      setSite(null);
    } else if (productMode || kind === "product") {
      if (!productMode) applyIntent("product-video", true);
      setBlockedProduct(null);
      setProductData(null);
      setChosenProductImages([]);
      setProductLink(withScheme(link));
    } else {
      if (mode !== "website") applyIntent("website", true);
      setUrl(withScheme(link));
    }
    if (rest !== null) setBrief(rest);
    setError(null);
    return true;
  }

  function onMessageChange(value: string) {
    const found = findLinkInText(value, false);
    if (found && linkSlotOpen() && (activeModeRef.current !== "video" && activeModeRef.current !== "scenario" || !found.rest)) {
      if (routeLink(found.link, found.rest)) return;
    }
    setBrief(value);
  }

  /** Choosing a feature by hand keeps the link that was already added. */
  function chooseMode(intent: CreationIntent) {
    const carried = (activeMode === "website" ? url : isProductMode ? productLink : "").trim();
    applyIntent(intent, true);
    setModeMenuOpen(false);
    if (!carried) return;
    if (intent === "website") {
      setUrl(carried);
      setProductLink("");
      setProductData(null);
      setChosenProductImages([]);
      setBlockedProduct(null);
    } else if (intent === "photo" || intent === "product-video") {
      setProductLink(carried);
      setUrl("");
    }
  }

  const activeFeature = CREATION_MODES.find((feature) => feature.id === activeMode) ?? CREATION_MODES[0];
  const ActiveIcon = activeFeature.icon;
  const qualityLabel = selectedModel.supportedQualities.length === 1 ? selectedModel.quality : settings.outputQuality === "4k" ? "4K" : "HD";
  const settingsSummary = `${isVideoMode && selectedModel.supportsDuration ? `${durationSeconds}s · ` : ""}${settings.aspectRatio} · ${qualityLabel}`;
  const placeholder = activeMode === "website"
    ? (url.trim() ? "What should the video show? Leave empty and we'll pick the best story." : "Paste a link, or describe what you want to make")
    : activeMode === "video"
      ? "Describe the video you want"
      : activeMode === "photo"
        ? "Paste a product link or add a photo, then describe the photos"
        : activeMode === "product-video"
          ? "Paste a product link or add a photo, then describe the video"
          : activeMode === "interior"
            ? "Add a photo or plan of the room, then describe the design"
            : activeMode === "architecture"
              ? "Describe the building, for example “a two-floor clothes shop”"
              : "Describe the scene and who is speaking";
  const chipClass = "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[.05] pl-2.5 pr-1 text-[13px] text-text-primary";
  const chipRemove = "grid h-6 w-6 shrink-0 place-items-center rounded-full text-text-dim transition hover:bg-white/10 hover:text-white";
  const toolClass = (active: boolean) => `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition max-sm:h-10 ${active ? "bg-white/[.12] text-white" : "text-text-muted hover:bg-white/[.07] hover:text-white"}`;
  const hasContext = Boolean(
    (activeMode === "website" && url.trim()) || (isProductMode && productLink.trim()) || previews.length || selectedSample
    || activeMode === "architecture" || (cadMode && drawingAttachment.drawing) || linkBusy,
  );

  return (
    <div className="w-full">
    <div
      ref={composerRootRef}
      data-composer
      className={`composer-box relative rounded-[26px] border bg-panel-alt transition-colors ${dragging ? "border-violet" : "border-white/[.09] focus-within:border-white/20"}`}
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
      <input
        ref={drawingInputRef}
        type="file"
        accept=".dxf,.dwg"
        className="hidden"
        aria-label="Add CAD drawing"
        onChange={(event) => {
          addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
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
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-[inherit] bg-panel-alt/95">
          <p className="flex items-center gap-2 text-sm font-medium text-white"><Paperclip size={16} className="text-violet" /> Drop images here</p>
        </div>
      )}

      {hasContext && (
        <div className="space-y-2.5 px-3 pt-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
            {activeMode === "website" && url.trim() && (
              <span className={chipClass} data-testid="website-link-chip">
                <Globe2 size={14} className="shrink-0 text-violet" />
                <span className="truncate">{linkHost(url)}</span>
                <button type="button" onClick={() => setUrl("")} aria-label="Remove website link" className={chipRemove}><X size={13} /></button>
              </span>
            )}
            {isProductMode && productLink.trim() && (
              <span className={chipClass} data-testid="product-link-chip">
                {readingProduct
                  ? <i className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet border-t-transparent" aria-hidden="true" />
                  : <PackageOpen size={14} className="shrink-0 text-violet" />}
                <span className="truncate">{productData?.title || linkHost(productLink)}</span>
                <button
                  type="button"
                  onClick={() => { setProductLink(""); setProductData(null); setChosenProductImages([]); setBlockedProduct(null); lastReadLinkRef.current = ""; lastFailedLinkRef.current = ""; }}
                  aria-label="Remove product link"
                  className={chipRemove}
                ><X size={13} /></button>
              </span>
            )}
            {selectedSample && activeMode !== "website" && (
              <span className={chipClass}>
                <Film size={14} className="shrink-0 text-violet" />
                <span className="truncate">Like the example</span>
                <button type="button" onClick={() => setSelectedSample(null)} aria-label="Remove the attached example" className={chipRemove}><X size={13} /></button>
              </span>
            )}
            {previews.map((preview, index) => (
              <span key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10" title={preview.file.name}>
                <img src={preview.url} alt={`Reference ${index + 1}: ${preview.file.name}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove ${preview.file.name}`}
                  className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                ><X size={11} /></button>
              </span>
            ))}
          </div>

          {isProductMode && (
            <>
              <LinkStatus active={readingProduct} skeleton messages={["Reading the product page…", "Still working: some shops load slowly…", "Trying a deeper read of this page. Almost there…"]} />
              {blockedProduct && files.length === 0 && (
                <div role="status" data-testid="product-blocked" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-gold/30 bg-gold/[.07] px-3 py-2.5 text-[13px] leading-5 text-text-primary">
                  <p className="min-w-0 flex-1">
                    {blockedProduct.blocked ? `${blockedProduct.host} doesn't allow automatic reading.` : blockedProduct.slow ? `${blockedProduct.host} took too long to answer.` : `No photos found on that ${blockedProduct.host} page.`}{" "}
                    {blockedProduct.name ? <>We kept the name “{blockedProduct.name}”. </> : null}
                    Add one photo of the product to continue.
                  </p>
                  <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-bg transition active:scale-[.98]">
                    <ImagePlus size={15} aria-hidden="true" /> Add a photo
                  </button>
                </div>
              )}
              {productData && productData.images.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[12px] text-text-dim">Photos to use · {chosenProductImages.length} selected</p>
                  <ScrollRow className="gap-2 pb-1" nudge={false}>
                    {productData.images.map((image) => {
                      const selected = chosenProductImages.includes(image);
                      return (
                        <button key={image} type="button" aria-label="Use product image" aria-pressed={selected}
                          onClick={() => setChosenProductImages((current) => current.includes(image) ? current.filter((item) => item !== image) : [...current, image].slice(0, 6))}
                          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${selected ? "border-violet" : "border-transparent opacity-60 hover:opacity-100"}`}>
                          <img src={image} alt="" loading="lazy" className="h-full w-full object-contain" />
                          {selected && <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-violet text-white"><Check size={10} strokeWidth={3} /></span>}
                        </button>
                      );
                    })}
                  </ScrollRow>
                </div>
              )}
            </>
          )}

          {activeMode === "architecture" && (
            <div className="space-y-2.5">
              <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-bg/60 px-3 transition focus-within:border-violet/60">
                <MapPin size={15} className="shrink-0 text-violet" />
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
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-text-dim sm:text-sm"
                />
                {site && <Check size={15} className="shrink-0 text-mint" aria-label="Location found" />}
              </div>
              <LinkStatus active={resolvingSite} messages={["Finding the exact place on the map…", "Still working on the location…", "This map link is slow to open. Almost there…"]} />
              {site && typeof site.latitude === "number" && typeof site.longitude === "number" && (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-bg/60" data-testid="site-preview">
                  <SiteStreetView latitude={site.latitude} longitude={site.longitude} mapSrc={mapPreviewUrl(site.latitude, site.longitude)} value={siteSelection} onChange={setSiteSelection} photos={files} onAddPhoto={() => inputRef.current?.click()} onCapture={(file) => addFiles([file])} />
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[12px] text-text-muted">
                    <span className="min-w-0 truncate">{site.label || `${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`}</span>
                    <a href={`https://www.google.com/maps?q=${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`} target="_blank" rel="noreferrer" className="font-medium text-violet hover:underline">Check in Google Maps</a>
                  </p>
                </div>
              )}
              {site && site.precision !== "pin" && site.precision !== "view" && typeof site.latitude !== "number" && (
                <p className="text-[12px] leading-5 text-amber-200">No exact coordinates for this address. For the exact place, paste the Google Maps share link.</p>
              )}
              {site?.precision === "view" && (
                <p className="text-[12px] leading-5 text-amber-200">This link shows a map view, not a pin, so the spot may be slightly off. In Google Maps, tap Share and paste that link.</p>
              )}
              {site && (
                <details className="group rounded-2xl border border-white/[.08] px-3 py-2">
                  <summary className="flex list-none items-center justify-between text-[13px] font-medium text-text-muted">Plot size and floors <ChevronDown size={14} className="transition group-open:rotate-180" /></summary>
                  <div className="mt-2.5 space-y-2.5">
                    <ToggleRow checked={estimatedScale} onChange={setEstimatedScale} label="Estimate the plot size" hint="Turn off to enter the exact width and depth." />
                    <div className="grid grid-cols-2 gap-2">
                      {!estimatedScale && (
                        <>
                          <NumberStepper label="Plot width" unit="m" value={plotWidth} onChange={setPlotWidth} min={1} max={5000} step={1} decimal placeholder="0" />
                          <NumberStepper label="Plot depth" unit="m" value={plotDepth} onChange={setPlotDepth} min={1} max={5000} step={1} decimal placeholder="0" />
                        </>
                      )}
                      <NumberStepper label="Floors" value={floorCount} onChange={setFloorCount} min={1} max={200} step={1} placeholder="Any" />
                      <NumberStepper label="Setback" unit="m" value={setback} onChange={setSetback} min={0} max={500} step={0.5} decimal placeholder="0" />
                    </div>
                  </div>
                </details>
              )}
            </div>
          )}

          {cadMode && drawingAttachment.drawing && (
            <DrawingCard state={drawingAttachment.drawing} onRemove={drawingAttachment.remove} onUnits={drawingAttachment.chooseUnits} />
          )}
        </div>
      )}

      <textarea
        ref={(element) => { websiteBriefRef.current = element; studioPromptRef.current = element; }}
        value={brief}
        onChange={(event) => onMessageChange(event.currentTarget.value)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text").trim();
          // A link pasted on its own always goes to its place (and replaces one that was already there).
          if (!pasted || !looksLikeLink(pasted) || activeModeRef.current === "interior") return;
          if ((activeModeRef.current === "video" || activeModeRef.current === "scenario") && brief.trim()) return;
          event.preventDefault();
          routeLink(pasted, null);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          // Phones and tablets keep Enter for a new line; with a keyboard it sends, like any chat.
          if (window.matchMedia?.("(pointer: coarse)").matches) return;
          event.preventDefault();
          if (!submitDisabled) void submit();
        }}
        placeholder={placeholder}
        aria-label="Message"
        rows={2}
        disabled={disabled}
        className="composer-input block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-base leading-6 text-white outline-none placeholder:text-text-dim sm:px-5"
      />

      {settingsOpen && (
        <div className="flex flex-wrap items-center gap-1 px-2.5 pb-1 pt-1 sm:px-3" role="group" aria-label="Output settings">
          <ModelPicker
            models={availableModels}
            selected={selectedModel}
            quality={settings.outputQuality}
            open={compactPanel === "model"}
            onOpenChange={(next) => { setOpenSettingMenu(null); setCompactPanel(next ? "model" : null); }}
            onSelect={(id) => { chooseModel(id); setCompactPanel(null); }}
          />

          {isInteriorMode && (
            <CompactDropdown
              onClose={() => setOpenSettingMenu(null)}
              value={interiorOutput}
              options={[
                { value: "images", label: "Images", helper: "A set of four", icon: <ImageIcon size={13} /> },
                { value: "video", label: "Video", helper: "A walkthrough", icon: <Video size={13} /> },
              ]}
              open={openSettingMenu === "output"}
              onToggle={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "output" ? null : "output"); }}
              onChange={(value) => {
                const next = value === "video" ? "video" : "images";
                setInteriorOutput(next);
                setSettings((current) => next === "video"
                  ? { ...current, modelId: defaultModelFor("video"), outputQuality: "1080p", audioMode: "native_audio" }
                  : { ...current, modelId: defaultModelFor("interior"), outputQuality: "1080p", audioMode: "silent" });
                setOpenSettingMenu(null);
              }}
              icon={<ImageIcon size={12} />}
              ariaLabel="Output"
            />
          )}

          {activeMode === "website" && (
            <CompactDropdown
              onClose={() => setOpenSettingMenu(null)}
              value={selectedWebsiteRecipe ?? "auto"}
              options={[
                { value: "auto", label: "Auto style", helper: "We pick the best fit", icon: <SlidersHorizontal size={13} /> },
                ...WEBSITE_RECIPES.map((recipe) => ({ value: recipe.mode, label: recipe.label, helper: recipe.helper, icon: <recipe.icon size={13} /> })),
              ]}
              open={openSettingMenu === "style"}
              onToggle={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "style" ? null : "style"); }}
              onChange={(value) => {
                const recipe = WEBSITE_RECIPES.find((item) => item.mode === value) ?? null;
                setSelectedWebsiteRecipe(recipe ? recipe.mode : null);
                setSettings((current) => ({ ...current, mode: recipe ? recipe.mode : "video" }));
                setOpenSettingMenu(null);
              }}
              icon={<SlidersHorizontal size={12} />}
              ariaLabel="Video style"
            />
          )}

          {isVideoMode && selectedModel.supportsDuration && (
            <ControlMenu open={openSettingMenu === "duration"} onClose={() => setOpenSettingMenu(null)} label="Video duration" wide trigger={
              <button
                type="button"
                onClick={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "duration" ? null : "duration"); }}
                aria-label={`Duration: ${durationSeconds} seconds`}
                aria-expanded={openSettingMenu === "duration"}
                aria-haspopup="dialog"
                className={controlClass(openSettingMenu === "duration")}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[.045] text-violet"><Clock size={12} /></span>
                <span>{durationSeconds}s</span>
                <ChevronDown size={12} className={`transition-transform ${openSettingMenu === "duration" ? "rotate-180" : ""}`} />
              </button>}>
              {openSettingMenu === "duration" && (
                <div role="dialog" aria-label="Video duration" className="p-1.5">
                  <div className="grid grid-cols-4 gap-1.5">
                    {DURATION_PRESETS.map((seconds) => {
                      const active = !usingCustomDuration && durationSeconds === seconds;
                      return (
                        <button
                          key={seconds}
                          type="button"
                          onClick={() => applyDurationPreset(seconds)}
                          className={`min-h-11 rounded-xl border text-[13px] font-semibold transition ${active ? "border-violet bg-violet/[.16] text-white" : "border-white/[.08] bg-white/[.035] text-text-muted hover:border-white/25 hover:text-white"}`}
                        >
                          {seconds}s
                        </button>
                      );
                    })}
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
                          if (event.key === "Enter") { event.preventDefault(); commitCustomDuration(); setOpenSettingMenu(null); }
                          if (event.key === "Escape") { setCustomDurationInput(String(durationSeconds)); setOpenSettingMenu(null); }
                        }}
                        placeholder="8–60"
                        className="h-11 w-full rounded-xl border border-white/10 bg-bg px-3 pr-12 text-center text-base font-semibold text-white outline-none transition placeholder:text-text-dim focus:border-violet sm:text-sm"
                        aria-label="Custom video duration in seconds"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-dim">sec</span>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { commitCustomDuration(); setOpenSettingMenu(null); }}
                      className="h-11 rounded-xl bg-white/10 px-4 text-[13px] font-semibold text-white transition hover:bg-white/15"
                    >
                      Set
                    </button>
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
            onToggle={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "aspect" ? null : "aspect"); }}
            onChange={(value) => {
              setSettings((current) => ({ ...current, aspectRatio: value as "16:9" | "9:16" | "1:1" }));
              setOpenSettingMenu(null);
            }}
            icon={<FormatIcon ratio="9:16" size={16} />}
            ariaLabel="Aspect ratio"
          />

          {selectedModel.supportedQualities.length > 1 && (
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
              onToggle={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "quality" ? null : "quality"); }}
              onChange={(value) => {
                setSettings((current) => ({ ...current, outputQuality: value as "1080p" | "4k" }));
                setOpenSettingMenu(null);
              }}
              icon={<QualityGlyph quality="1080p" size={18} />}
              ariaLabel="Quality"
            />
          )}

          {isVideoMode && selectedModel.audioModes.length > 0 && (
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
              onToggle={() => { setCompactPanel(null); setOpenSettingMenu((current) => current === "audio" ? null : "audio"); }}
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

          {isVideoMode && selectedModel.audioModes.includes("voice_music") && settings.audioMode === "voice_music" && (
            <div className={languageShake ? "attention-shake rounded-xl" : ""}>
              <CompactDropdown
                onClose={() => setOpenSettingMenu(null)}
                value={settings.narrationLanguage}
                options={[
                  { value: "auto", label: "Auto", helper: "Speaks the language of your prompt", icon: <Languages size={13} /> },
                  ...NARRATION_LANGUAGES.map(([code, label]) => ({ value: code, label, icon: <Languages size={13} /> })),
                ]}
                open={openSettingMenu === "language"}
                onToggle={() => { setCompactPanel(null); setLanguageShake(false); setOpenSettingMenu((current) => current === "language" ? null : "language"); }}
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
        </div>
      )}

      <div className="flex items-center gap-0.5 px-2 pb-2 pt-1 sm:gap-1 sm:px-2.5 sm:pb-2.5">
        <ComposerPlusMenu
          disabled={disabled}
          addLabel={isProductMode ? "Add product photos" : activeMode === "interior" ? "Add room photos or plans" : activeMode === "architecture" ? "Add site or building photos" : activeMode === "website" ? "Add website screenshots" : "Add photos"}
          attachedCount={files.length}
          attachedKeys={attachedKeys}
          maxFiles={10}
          onPickFiles={() => { setOpenSettingMenu(null); inputRef.current?.click(); }}
          onPickDrawing={cadMode ? () => { setOpenSettingMenu(null); drawingInputRef.current?.click(); } : undefined}
          drawingAttached={Boolean(drawingAttachment.drawing)}
          onUseRecent={(file) => addFiles([file])}
          recentOwner={recentFilesOwner}
        />

        <Popover.Root open={modeMenuOpen} onOpenChange={setModeMenuOpen}>
          <Popover.Trigger asChild>
            <button type="button" aria-label={`Making: ${activeFeature.label}. Change`} aria-haspopup="listbox" aria-expanded={modeMenuOpen} className={`${toolClass(modeMenuOpen)} max-sm:px-2`} data-testid="mode-menu">
              <ActiveIcon size={16} className="text-violet" />
              <span className="whitespace-nowrap max-[430px]:hidden">{activeFeature.label}</span>
              <span className="whitespace-nowrap min-[431px]:hidden">{activeFeature.short}</span>
              <ChevronDown size={13} className={`text-text-dim transition-transform ${modeMenuOpen ? "rotate-180" : ""}`} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="start" sideOffset={8} collisionPadding={12} aria-label="What to make" className="z-[100] w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-panel p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
              <div role="listbox" aria-label="What to make" className="max-h-[min(60vh,var(--radix-popover-content-available-height))] overflow-y-auto">
                {CREATION_MODES.map(({ id, label, description, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={activeMode === id}
                    onClick={() => chooseMode(id)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${activeMode === id ? "bg-white/[.08]" : "hover:bg-white/[.05]"}`}
                  >
                    <Icon size={18} className={activeMode === id ? "shrink-0 text-violet" : "shrink-0 text-text-dim"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-tight text-white">{label}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-text-dim">{description}</span>
                    </span>
                    {activeMode === id && <Check size={15} className="shrink-0 text-violet" />}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <button
          type="button"
          onClick={() => { setOpenSettingMenu(null); setCompactPanel(null); setSettingsOpen((current) => !current); }}
          aria-expanded={settingsOpen}
          aria-label={`Settings: ${settingsSummary}`}
          className={`${toolClass(settingsOpen)} max-sm:px-2`}
          data-testid="settings-toggle"
        >
          <SlidersHorizontal size={15} />
          <span className="whitespace-nowrap max-[430px]:hidden">{settingsSummary}</span>
        </button>

        <button
          type="button"
          onClick={() => { setOpenSettingMenu(null); toggleIdeas(); }}
          aria-expanded={compactPanel === "ideas"}
          aria-label="Ideas"
          className={`${toolClass(compactPanel === "ideas")} max-sm:px-2`}
        >
          <Lightbulb size={15} className={selectedIdea ? "text-gold" : undefined} />
          <span className="max-sm:hidden">Ideas</span>
        </button>

        <span className="min-w-0 flex-1" />

        {showCreditPricing && !linkBusy && (
          <span className="shrink-0 whitespace-nowrap pr-1.5 font-utility text-[12px] text-text-dim" title="What this will use" aria-label={`${exactCredits} credits`} data-testid="composer-cost">{exactCredits}<span className="max-[430px]:hidden"> credits</span><span className="min-[431px]:hidden"> cr</span></span>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitDisabled}
          aria-label={linkBusy ? "Reading your link" : createLabel}
          title={createLabel}
          className="composer-send grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-bg transition hover:bg-white/90 active:scale-95 disabled:bg-white/15 disabled:text-white/40"
        >
          {linkBusy
            ? <i className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            : <ArrowUp size={19} strokeWidth={2.4} />}
        </button>
      </div>

      {compactPanel === "ideas" && (
        <div className="border-t border-white/[.07] p-2.5 sm:p-3">
          <MasterIdeas ideas={masterIdeas} context={ideaContext} selectedId={selectedIdea?.id ?? null} onSelect={applyMasterIdea} />
        </div>
      )}
    </div>

    {error && <p role="alert" className="mt-2 rounded-2xl border border-pink/25 bg-pink/[.07] px-3.5 py-2.5 text-[13px] leading-5 text-pink">{error}</p>}

    {!landingWebsitePreview && (
      <SampleStrip
        feature={activeMode}
        selectedId={selectedSample?.id ?? null}
        onSelect={(sample) => { setSelectedSample(sample); setError(null); }}
        selectable={activeMode !== "website"}
      />
    )}
    </div>
  );
}
