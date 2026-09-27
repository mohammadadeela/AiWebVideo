import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Film,
  Globe2,
  Image as ImageIcon,
  House,
  Link2,
  MapPinned,
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
import { CREATIVE_PRESETS, type CreativePreset } from "@/components/landing/CreativePresets";
import { fetchMarketingSettings } from "@/lib/api-client";
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
  photoCount?: 1 | 4 | 9;
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
  { id: "scenario" as const, label: "Talking Person", short: "Talking", icon: MessageCircleMore },
  { id: "interior" as const, label: "Interior Design", short: "Interior", icon: House },
  { id: "architecture" as const, label: "Architecture Preview", short: "Site", icon: MapPinned },
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
  return Math.max(8, Math.min(60, Math.round(value)));
}

function intentFromSearch(): CreationIntent | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("create");
  if (value === "photo" || value === "product") return "photo";
  if (value === "product-video") return "product-video";
  if (value === "scenario" || value === "talking") return "scenario";
  if (value === "architecture") return "architecture";
  if (value === "interior" || value === "interior-design") return "interior";
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

function resizePromptTextarea(node: HTMLTextAreaElement | null) {
  if (!node || typeof window === "undefined") return;
  const viewportCap = Math.max(132, Math.round(window.innerHeight * 0.38));
  const maxHeight = Math.min(220, viewportCap);
  node.style.height = "0px";
  const nextHeight = Math.max(52, Math.min(maxHeight, node.scrollHeight));
  node.style.height = `${nextHeight}px`;
  node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
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
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const [stylePreset, setStylePreset] = useState("Auto");
  const [roomType, setRoomType] = useState("Living Room");
  const [voicePreset, setVoicePreset] = useState("Natural");
  const [photoCount, setPhotoCount] = useState<1 | 4 | 9>(4);
  const [compactPanel, setCompactPanel] = useState<"style" | "ideas" | null>(null);
  const [settings, setSettings] = useState<WebsiteGenerationSettings>(DEFAULT_SETTINGS);
  const [customDurationDraft, setCustomDurationDraft] = useState<string | null>(null);
  const [selectedWebsiteRecipe, setSelectedWebsiteRecipe] = useState<WebsiteProductionMode | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<CreativeIdea | null>(null);
  const [personReferenceRequired, setPersonReferenceRequired] = useState(false);
  const [interiorOutput, setInteriorOutput] = useState<"images" | "video">("images");
  const [productLinkOpen, setProductLinkOpen] = useState(false);
  const [productLink, setProductLink] = useState("");
  const [productLinkBusy, setProductLinkBusy] = useState(false);
  const [architectureLocation, setArchitectureLocation] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationResolved, setLocationResolved] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [exampleReference, setExampleReference] = useState<File | null>(null);
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const composerRootRef = useRef<HTMLDivElement>(null);
  const websiteBriefRef = useRef<HTMLTextAreaElement>(null);
  const studioPromptRef = useRef<HTMLTextAreaElement>(null);

  function applyIntent(intent: CreationIntent, userInitiated = false) {
    if (userInitiated && onIntentRequest?.(intent) === false) return;
    if (userInitiated && window.location.pathname === "/") {
      window.history.replaceState({}, "", `/?create=${intent}#generate`);
    }
    const previousIntent = activeModeRef.current;
    activeModeRef.current = intent;
    setActiveMode(intent);
    setSelectedIdea(null);
    setPersonReferenceRequired(false);
    setCompactPanel(null);
    setSettingsOpen(false);
    setStylePreset(intent === "website" ? "Auto" : "");
    setError(null);
    setSettings((current) => {
      if (intent === "photo" || intent === "interior" || intent === "architecture") return { ...current, aspectRatio: intent === "photo" ? "1:1" : "16:9", audioMode: "silent" };
      const leavingPhotoDefaults = (previousIntent === "photo" || previousIntent === "interior" || previousIntent === "architecture") && current.audioMode === "silent";
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

  useEffect(() => {
    const applyPreset = (preset: CreativePreset) => {
      applyIntent(preset.intent);
      setSelectedExample(preset.title);
      setExampleReference(null);
      if (preset.image) void fetch(preset.image).then(async (response) => {
        if (!response.ok) throw new Error('Example unavailable');
        const blob = await response.blob();
        if (blob.type.startsWith('image/')) setExampleReference(new File([blob], 'gallery-style-reference.webp', { type: blob.type }));
      }).catch(() => {});
      else if (preset.preview?.startsWith('/')) {
        const player = document.createElement('video');
        player.muted = true;
        player.preload = 'metadata';
        player.src = preset.preview;
        player.addEventListener('loadeddata', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(1024, player.videoWidth);
            canvas.height = Math.max(1, Math.round(canvas.width * player.videoHeight / player.videoWidth));
            canvas.getContext('2d')?.drawImage(player, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) setExampleReference(new File([blob], 'gallery-video-frame.jpg', { type: 'image/jpeg' }));
              player.removeAttribute('src');
              player.load();
            }, 'image/jpeg', 0.85);
          } catch { /* Keep the written direction if the frame cannot be read. */ }
        }, { once: true });
      }
      setPersonReferenceRequired(preset.intent === "scenario");
      const direction = `${preset.prompt} The final reference image, when attached, is the gallery example for STYLE, lighting and composition only. Earlier images uploaded by the customer are the exact product, person or space to depict; never copy the example's subject or branding.`;
      if (preset.intent === "video" || preset.intent === "scenario") setPrompt(direction);
      else setBrief(direction);
      window.requestAnimationFrame(() => studioPromptRef.current?.focus());
    };
    const initialName = new URLSearchParams(window.location.search).get("preset");
    const initial = CREATIVE_PRESETS.find((preset) => preset.title === initialName);
    if (initial) applyPreset(initial);
    else if (initialName) void fetchMarketingSettings().then((settings) => {
      const video = settings.videos.showcase.find((item) => item.id === initialName && item.templateMode && item.url);
      if (!video?.templateMode) return;
      applyPreset({ title: video.caption || "Create your version", kind: video.kind === 'image' ? "Image" : "Video", category: video.templateMode === "scenario" ? "People" : video.templateMode === "interior" ? "Interior" : "Product", intent: video.templateMode, prompt: video.templatePrompt?.trim() || (video.templateMode === 'interior' ? 'Recreate the selected example using my real room layout and measurements.' : video.templateMode === 'scenario' ? 'Recreate the selected scene with the person in my portrait, keeping their identity.' : 'Recreate the selected example with my exact uploaded product, preserving its branding.'), position: "50% 0%", image: video.kind === 'image' ? video.url ?? undefined : video.posterUrl ?? undefined });
    }).catch(() => {});
    const onPreset = (event: Event) => applyPreset((event as CustomEvent<CreativePreset>).detail);
    window.addEventListener("aiwebvideo:creative-preset", onPreset);
    return () => window.removeEventListener("aiwebvideo:creative-preset", onPreset);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ((activeMode === "photo" || activeMode === "product-video") && params.get("productLink") === "1") {
      setProductLinkOpen(true);
    }
  }, [activeMode]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (event: PointerEvent) => { if (!settingsAnchorRef.current?.contains(event.target as Node)) setSettingsOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [settingsOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      resizePromptTextarea(activeMode === "website" ? websiteBriefRef.current : studioPromptRef.current);
    });
    const onResize = () => resizePromptTextarea(activeMode === "website" ? websiteBriefRef.current : studioPromptRef.current);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [activeMode, brief, prompt]);

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
    setFiles((current) => activeMode === "product-video" || activeMode === "video" ? accepted.slice(0, 1) : [...current, ...accepted].slice(0, 10));
    if (files.length + accepted.length > 10) nextError = "You can attach up to 10 reference images.";
    setError(nextError);
  }


  async function importProductLink() {
    if (!productLink.trim() || productLinkBusy) return;
    setProductLinkBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/product-source/resolve", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: normalizeWebsiteUrl(productLink) }),
      });
      const source = await response.json() as { title?: string; description?: string; images?: string[]; error?: string };
      if (!response.ok) throw new Error(source.error || "Could not import that product page.");
      const imported: File[] = [];
      for (const [index, imageUrl] of (source.images ?? []).slice(0, 3).entries()) {
        const imageResponse = await fetch(`/api/product-source/image?url=${encodeURIComponent(imageUrl)}`, { credentials: "include" });
        if (!imageResponse.ok) continue;
        const blob = await imageResponse.blob();
        if (!ACCEPTED_IMAGES.includes(blob.type)) continue;
        imported.push(new File([blob], `product-link-${index + 1}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type }));
      }
      if (!imported.length) throw new Error("The product page was found, but it did not expose a usable product image. Attach a product photo manually.");
      setFiles((current) => [...current, ...imported].slice(0, 10));
      const facts = [source.title, source.description].filter(Boolean).join(". ");
      if (facts) setBrief((current) => current.trim() ? current : `Create a premium campaign for this product. Use only supported product facts: ${facts}`);
      setProductLinkOpen(false);
      setProductLink("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import that product page.");
    } finally {
      setProductLinkBusy(false);
    }
  }

  async function resolveArchitectureLocation() {
    if (!architectureLocation.trim() || locationBusy) return;
    setLocationBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/location-source/preview", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location: architectureLocation.trim() }),
      });
      const source = await response.json() as { label?: string; lat?: number; lng?: number; imageDataUrl?: string; error?: string };
      if (!response.ok || !source.imageDataUrl) throw new Error(source.error || "Could not resolve that location.");
      const blob = await (await fetch(source.imageDataUrl)).blob();
      const file = new File([blob], "real-location-satellite-reference.jpg", { type: blob.type || "image/jpeg" });
      setFiles((current) => [file, ...current.filter((item) => item.name !== file.name)].slice(0, 10));
      const label = source.label || architectureLocation.trim();
      setLocationResolved(label);
      setBrief((current) => {
        const grounding = `Use the attached real satellite reference as the location ground truth for ${label}. Preserve the real plot orientation, surrounding context and visible site geometry. This is a concept visualization, not a surveyed construction plan.`;
        return current.includes("real satellite reference") ? current : `${grounding} ${current}`.trim();
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resolve that location.");
    } finally {
      setLocationBusy(false);
    }
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
      try {
        setError(null);
        void onSubmit(normalizeWebsiteUrl(url), `${brief.trim()}${stylePreset && stylePreset !== "Auto" ? ` Visual style: ${stylePreset}.` : ""}`.trim(), settings, files);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Enter a valid public website URL.");
      }
      return;
    }

    const isProduct = activeMode === "photo" || activeMode === "product-video";
    const isInterior = activeMode === "interior" || activeMode === "architecture";
    const writtenPrompt = isProduct || isInterior ? brief.trim() : prompt.trim();
    const defaultDirection = activeMode === "photo" ? "Create premium product images using the uploaded product as the exact subject." : activeMode === "architecture" ? "Create a high-fidelity architecture concept grounded in the attached real location reference while preserving the site's real orientation and context." : activeMode === "interior" ? "Design the uploaded space while preserving its architecture and dimensions." : "";
    const styleDirection = stylePreset && stylePreset !== "Auto" ? ` Style direction: ${stylePreset}.` : "";
    const contextDirection = activeMode === "interior" ? ` Room: ${roomType}.` : activeMode === "architecture" ? " Maintain real-site grounding; never claim survey-grade dimensional accuracy." : activeMode === "scenario" ? ` Voice direction: ${voicePreset}.` : "";
    const activePrompt = `${writtenPrompt || defaultDirection}${styleDirection}${contextDirection}`.trim();
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
    if (activeMode === "scenario" && personReferenceRequired && files.length === 0) {
      setError("Add a portrait of the person before using this scene.");
      return;
    }

    const durationSeconds = customDurationDraft === null
      ? (settings.durationSeconds === "auto" ? 8 : settings.durationSeconds)
      : normalizeDuration(Number(customDurationDraft));
    setError(null);
    void onStudioSubmit({
      studioKind: isProduct ? "product" : activeMode === "scenario" ? "scenario" : isInterior ? "interior" : "idea",
      prompt: activePrompt,
      files: exampleReference && files.length < 10 ? [...files, exampleReference] : files,
      mode: activeMode === "photo" ? "photos" : activeMode === "product-video" ? "video" : isInterior ? (interiorOutput === "video" ? "custom" : "photos") : "custom",
      durationSeconds: activeMode === "photo" ? 8 : durationSeconds,
      aspectRatio: settings.aspectRatio,
      outputQuality: settings.outputQuality,
      audioMode: activeMode === "photo" || isInterior ? "silent" : settings.audioMode,
      photoCount: activeMode === "photo" ? photoCount : undefined,
    });
  }

  const isProductMode = activeMode === "photo" || activeMode === "product-video";
  const isInteriorMode = activeMode === "interior" || activeMode === "architecture";
  const isVideoMode = activeMode !== "photo" && (!isInteriorMode || interiorOutput === "video");
  const durationSeconds = settings.durationSeconds === "auto" ? 8 : settings.durationSeconds;
  const formatSummary = settings.aspectRatio === "9:16" ? "Portrait" : settings.aspectRatio === "16:9" ? "Wide" : "Square";
  const audioSummary = settings.audioMode === "voice_music"
    ? `Narration · ${settings.narrationLanguage.toUpperCase()}`
    : settings.audioMode === "native_audio"
      ? "Scene audio"
      : settings.audioMode === "music_only"
        ? "Music only"
        : "Silent";
  const exactCredits = activeMode === "photo" || (isInteriorMode && interiorOutput === "images")
    ? estimateRenderCredits("photos", true, 8, "1080p")
    : estimateRenderCredits("video", settings.audioMode !== "voice_music", durationSeconds, settings.outputQuality);
  const submitDisabled = disabled || (
    activeMode === "website"
      ? !url.trim()
      : isProductMode
        ? files.length === 0
        : isInteriorMode
          ? files.length === 0
          : activeMode === "scenario" && personReferenceRequired
            ? files.length === 0 || !prompt.trim()
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
              ? "Create architecture preview"
              : "Create talking scene";

  const activeTool = CREATION_MODES.find((item) => item.id === activeMode) ?? CREATION_MODES[0];
  const ToolIcon = activeTool.icon;
  const accents: Record<CreationIntent, string> = { website: "#75dcc9", video: "#b59aff", photo: "#f3a9bd", "product-video": "#eac68d", scenario: "#a7bdfa", interior: "#bdcba6", architecture: "#8fd7c8" };
  const styles: Record<CreationIntent, string[]> = {
    website: ["Auto", "Bold", "Minimal", "Luxury"], video: ["Cinematic", "Dreamlike", "Editorial", "Energetic"],
    photo: ["Studio", "Editorial", "Natural", "Luxury"], "product-video": ["Studio", "Lifestyle", "Macro", "Splash"],
    scenario: ["Natural", "Interview", "Warm", "Cinematic"], interior: ["Modern", "Minimalist", "Scandinavian", "Industrial", "Luxury"],
    architecture: ["Contemporary", "Minimal", "Landscape-led", "Commercial", "Residential"],
  };
  const iconButton = "relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/65 transition hover:scale-105 hover:bg-white/[.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60";
  const toolPlaceholder: Record<CreationIntent, string> = {
    website: "What should the video highlight? (optional)", video: "A cinematic reveal from the city into the location…",
    photo: "Soft studio light, sculptural shadows, refined textures…", "product-video": "Slow premium reveal, macro details, strong hero ending…",
    scenario: "Write the words they should say and describe the scene…", interior: "A calm modern space with warm wood and natural light…",
    architecture: "Describe what should be designed on this real site, access, massing, materials and landscape…",
  };
  const segmented = (selected: boolean) => `min-h-9 rounded-full px-3 text-[11px] font-medium transition ${selected ? "bg-white text-[#15121c]" : "text-white/65 hover:bg-white/[.08] hover:text-white"}`;
  return <div ref={composerRootRef} className={`relative ${dragging ? "rounded-[28px] ring-2 ring-white/40" : ""}`} onPaste={(event) => { if (disabled) return; const pasted = Array.from(event.clipboardData.files ?? []).filter((file) => file.type.startsWith("image/")); if (pasted.length) { event.preventDefault(); addFiles(pasted); } }} onDragEnter={(event) => { if (disabled || !Array.from(event.dataTransfer.types ?? []).includes("Files")) return; event.preventDefault(); dragDepthRef.current++; setDragging(true); }} onDragOver={(event) => { if (disabled) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDragLeave={(event) => { event.preventDefault(); dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (!dragDepthRef.current) setDragging(false); }} onDrop={onDrop}>
    <input ref={inputRef} type="file" multiple={activeMode !== "product-video" && activeMode !== "video"} accept={ACCEPTED_IMAGES.join(",")} className="hidden" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = ""; }} />
    {dragging && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-[28px] border-2 border-dashed border-white/50 bg-[#17131f]/95 text-sm text-white">Drop images to attach</div>}
    {isProductMode && <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/[.09] bg-white/[.025] px-3 py-2.5"><div className="min-w-0"><p className="text-[11px] font-semibold text-white">Start from a product page</p><p className="mt-0.5 truncate text-[9px] text-white/45">Import the real product image and page facts before you generate.</p></div><button type="button" onClick={() => setProductLinkOpen((value) => !value)} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[10px] font-semibold text-white/70 transition hover:border-mint/35 hover:text-white"><Link2 size={13} />Product link</button></div>}
    {productLinkOpen && isProductMode && <div className="mb-3 rounded-[20px] border border-white/[.12] bg-[#14101d] p-3"><div className="flex gap-2"><input value={productLink} onChange={(event) => setProductLink(event.currentTarget.value)} placeholder="https://store.com/product/…" type="url" inputMode="url" className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-mint/35" /><button type="button" disabled={!productLink.trim() || productLinkBusy} onClick={() => void importProductLink()} className="rounded-full bg-signature px-4 text-[10px] font-semibold text-white disabled:opacity-40">{productLinkBusy ? "Importing…" : "Continue"}</button></div><p className="mt-2 text-[9px] text-white/40">Nothing generates or spends credits here. Review the imported references and prompt first.</p></div>}
    {activeMode === "architecture" && <div className="mb-3 rounded-[20px] border border-white/[.12] bg-[#11151a] p-3"><div className="flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3"><MapPinned size={14} className="shrink-0 text-mint" /><input value={architectureLocation} onChange={(event) => { setArchitectureLocation(event.currentTarget.value); setLocationResolved(null); }} placeholder="Google Maps link or site address" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35" /></div><button type="button" disabled={!architectureLocation.trim() || locationBusy} onClick={() => void resolveArchitectureLocation()} className="rounded-full border border-mint/25 bg-mint/[.08] px-4 py-2.5 text-[10px] font-semibold text-mint transition hover:bg-mint/[.14] disabled:opacity-40">{locationBusy ? "Fetching site…" : locationResolved ? "Refresh site" : "Fetch real site"}</button></div>{locationResolved && <p className="mt-2 truncate text-[9px] text-mint/75">Real satellite reference attached · {locationResolved}</p>}<p className="mt-2 text-[9px] leading-4 text-amber-200/65">AI visualization for concept purposes — not a surveyed or construction-accurate plan.</p></div>}
    {activeMode === "website" && <div className="mb-3 flex min-h-12 items-center gap-3 rounded-full border border-white/[.12] bg-[#0d0b15] px-4 focus-within:border-white/35">
      {url ? <img src={`https://${url.replace(/^https?:\/\//, "").split("/")[0]}/favicon.ico`} alt="" className="h-5 w-5 rounded-md object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Globe2 size={16} className="text-white/55" />}
      <input value={url} onChange={(event) => setUrl(event.currentTarget.value)} type="url" inputMode="url" autoComplete="url" placeholder="Paste a website URL" disabled={disabled} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/40" />
    </div>}
    <div className="relative flex min-h-16 flex-wrap items-end gap-2 rounded-[30px] border border-white/[.16] bg-[#191522] px-3 py-2 shadow-[0_20px_55px_-40px_rgba(0,0,0,.9)] transition focus-within:border-white/35 focus-within:shadow-[0_0_0_1px_rgba(181,154,255,.16),0_22px_60px_-42px_rgba(181,154,255,.7)] sm:flex-nowrap sm:items-center sm:px-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-[15px] border border-white/10 bg-black/20 sm:self-auto" style={{ color: accents[activeMode] }}><ToolIcon size={19} /></span>
      <textarea ref={activeMode === "website" ? websiteBriefRef : studioPromptRef} value={activeMode === "video" || activeMode === "scenario" ? prompt : brief} onChange={(event) => { if (activeMode === "video" || activeMode === "scenario") setPrompt(event.currentTarget.value); else setBrief(event.currentTarget.value); resizePromptTextarea(event.currentTarget); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} placeholder={toolPlaceholder[activeMode]} rows={2} disabled={disabled} aria-label={activeMode === "scenario" ? "Script and scene" : "Creative prompt"} className={`min-h-[52px] max-h-[min(220px,38dvh)] min-w-0 basis-[calc(100%-3.5rem)] flex-1 resize-none overflow-y-hidden bg-transparent px-1 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-white/40 sm:basis-0 ${activeMode === "scenario" ? "font-mono" : ""}`} />
      <button type="button" title="Attach images" aria-label={files.length ? `${files.length} images attached. Add more` : "Attach images"} onClick={() => inputRef.current?.click()} disabled={disabled || files.length >= 10} className={iconButton}>{files.length ? <><img src={previews[0]?.url} alt="" className="h-7 w-7 rounded-full object-cover" />{files.length > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[9px] font-semibold text-black">+{files.length - 1}</span>}</> : <Paperclip size={18} />}</button>
      {isVideoMode && <button type="button" title="Change duration" aria-label={`Duration ${durationSeconds} seconds`} onClick={() => { const values = [8,16,24,32,60]; const index = Math.max(0, values.indexOf(durationSeconds)); setSettings((current) => ({ ...current, durationSeconds: values[(index + 1) % values.length] })); }} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/[.10] bg-white/[.035] px-2.5 text-[10px] font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/[.07] hover:text-white"><Clock3 size={14} /><span>{durationSeconds}s</span></button>}
      <div ref={settingsAnchorRef} className="relative">
        <button type="button" title="Settings" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((current) => !current)} className={iconButton}><Settings2 size={18} /></button>
        {settingsOpen && <div className="absolute bottom-[calc(100%+14px)] right-[-3.5rem] z-40 w-[min(355px,calc(100vw-2.5rem))] origin-bottom-right animate-fade-in-up rounded-[24px] border border-white/[.14] bg-[#211b2c] p-4 shadow-2xl sm:right-0" role="group" aria-label="Generation settings">
          {isVideoMode && <div><div className="mb-2 flex items-center justify-between text-xs text-white/70"><span>Duration</span><span className="rounded-full border border-white/20 px-2 py-0.5 font-semibold text-white">{durationSeconds}s</span></div><input type="range" min={0} max={4} step={1} value={Math.max(0, [8,16,24,32,60].indexOf(durationSeconds))} onChange={(event) => setSettings((current) => ({ ...current, durationSeconds: [8,16,24,32,60][Number(event.target.value)] }))} className="w-full accent-white" aria-label="Duration" /><div className="flex justify-between text-[10px] text-white/45">{[8,16,24,32,60].map((value) => <span key={value}>{value}s</span>)}</div></div>}
          <div className="mt-4"><p className="mb-2 text-xs text-white/70">Format</p><div className="flex rounded-full border border-white/10 bg-black/20 p-1">{([ ["9:16", Smartphone, "Portrait"], ["16:9", Monitor, "Wide"], ["1:1", ImageIcon, "Square"] ] as const).map(([ratio, Icon, label]) => <button key={ratio} type="button" title={label} aria-label={label} aria-pressed={settings.aspectRatio === ratio} onClick={() => setSettings((current) => ({ ...current, aspectRatio: ratio }))} className={`${segmented(settings.aspectRatio === ratio)} flex flex-1 items-center justify-center gap-1.5`}><Icon size={14} /><span className="hidden sm:inline">{label}</span></button>)}</div></div>
          <div className="mt-4"><p className="mb-2 text-xs text-white/70">Quality</p><div className="flex rounded-full border border-white/10 bg-black/20 p-1">{(["1080p","4k"] as const).map((quality) => <button key={quality} type="button" aria-pressed={settings.outputQuality === quality} onClick={() => setSettings((current) => ({ ...current, outputQuality: quality }))} className={`${segmented(settings.outputQuality === quality)} flex-1`}>{quality === "4k" ? "4K" : "1080p"}</button>)}</div></div>
          {isVideoMode && <div className="mt-4"><p className="mb-2 text-xs text-white/70">Audio</p><div className="grid grid-cols-4 rounded-full border border-white/10 bg-black/20 p-1">{([ ["native_audio","Scene"], ["voice_music","Voice"], ["music_only","Music"], ["silent","Silent"] ] as const).map(([mode,label]) => <button key={mode} type="button" aria-label={label} aria-pressed={settings.audioMode === mode} onClick={() => setSettings((current) => ({ ...current, audioMode: mode }))} className={segmented(settings.audioMode === mode)}>{label}</button>)}</div>{settings.audioMode === "voice_music" && <select value={settings.narrationLanguage} onChange={(event) => setSettings((current) => ({ ...current, narrationLanguage: event.target.value }))} aria-label="Narration language" className="mt-2 w-full rounded-full border border-white/15 bg-[#17131f] px-3 py-2 text-xs text-white">{NARRATION_LANGUAGES.map(([code,label]) => <option key={code} value={code}>{label}</option>)}</select>}</div>}
        </div>}
      </div>
      <button type="button" title={landingWebsitePreview && activeMode === "website" ? "Capture website" : createLabel} aria-label={landingWebsitePreview && activeMode === "website" ? "Capture website" : createLabel} onClick={submit} disabled={submitDisabled} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signature text-white transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35">{disabled ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRight size={20} className="-rotate-45" />}</button>
    </div>
    {previews.length > 0 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{previews.map((preview, index) => <div key={`${preview.file.name}-${index}`} className="relative h-14 w-14 shrink-0"><img src={preview.url} alt={preview.file.name} className="h-full w-full rounded-xl object-cover" /><button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${preview.file.name}`} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#37303f] text-white"><X size={11} /></button></div>)}</div>}
    {isInteriorMode && <div className="mt-3 flex flex-wrap gap-2">{activeMode === "interior" && <select value={roomType} onChange={(event) => setRoomType(event.target.value)} aria-label="Room type" className="rounded-full border border-white/10 bg-[#201b29] px-3 py-2 text-xs text-white">{["Living Room","Bedroom","Kitchen","Office","Other Space"].map((room) => <option key={room}>{room}</option>)}</select>}<div className="flex rounded-full border border-white/10 p-1"><button type="button" onClick={() => setInteriorOutput("images")} className={segmented(interiorOutput === "images")}>Images</button><button type="button" onClick={() => setInteriorOutput("video")} className={segmented(interiorOutput === "video")}>{activeMode === "architecture" ? "Site video" : "Walkthrough"}</button></div></div>}
    {activeMode === "scenario" && <div className="mt-3 flex gap-2 overflow-x-auto">{["Natural", "Warm", "Narrator", "Dialogue"].map((voice) => <button type="button" key={voice} onClick={() => setVoicePreset(voice)} className={segmented(voicePreset === voice)}>{voice}</button>)}</div>}
    {activeMode === "photo" && <div className="mt-3 flex items-center gap-2 text-xs text-white/55"><span>Images</span><div className="flex rounded-full border border-white/10 p-1">{([1,4,9] as const).map((count) => <button type="button" key={count} aria-pressed={photoCount === count} onClick={() => setPhotoCount(count)} className={segmented(photoCount === count)}>{count}</button>)}</div></div>}
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">{styles[activeMode].map((style) => <button type="button" key={style} onClick={() => setStylePreset(style)} aria-pressed={stylePreset === style} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition ${stylePreset === style ? "border-white/40 bg-white/10 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>{style}</button>)}</div>
    <div className="mt-3" aria-label="Prompt ideas"><MasterIdeas ideas={masterIdeas.slice(0,4)} context={ideaContext} selectedId={selectedIdea?.id ?? null} onSelect={applyMasterIdea} /></div>
    {selectedExample && <p className="mt-2 text-xs text-white/55">Your version of {selectedExample} · attach your own subject.</p>}
    {error && <p role="alert" className="mt-2 text-xs text-[#f3a9bd]">{error}</p>}
    {showCreditPricing && <p className="mt-2 text-right text-[10px] text-white/45">Estimate: {photoCount === 4 || activeMode !== "photo" ? exactCredits : Math.ceil(exactCredits * photoCount / 4)} credits before generation</p>}
  </div>;
}
