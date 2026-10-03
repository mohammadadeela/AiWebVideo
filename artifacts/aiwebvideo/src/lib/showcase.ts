import { useEffect, useState } from "react";
import { fetchMarketingSettings, type MarketingVideo, type ShowcaseFeature } from "@/lib/api-client";

/** A showcase item that has media and is filed under a feature. */
export type Sample = MarketingVideo & { url: string; feature: ShowcaseFeature; kind: "image" | "video" };

export function isSample(item: MarketingVideo): item is Sample {
  return Boolean(item.url && item.feature);
}

/** Browser event: a visitor picked a sample ("make one like this"). */
export const USE_SAMPLE_EVENT = "aiwebvideo:use-sample";
export interface UseSampleDetail { sample: Sample }

export function startFromSample(sample: Sample) {
  window.dispatchEvent(new CustomEvent<UseSampleDetail>(USE_SAMPLE_EVENT, { detail: { sample } }));
  document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The still to show for a sample: the image itself, or a video's poster. */
export function sampleStill(sample: Sample): string | null {
  return sample.kind === "image" ? sample.url : sample.posterUrl;
}

/** Anything published on the homepage, including older videos that have not been filed under a feature yet. */
export type GalleryItem = MarketingVideo & { url: string; kind: "image" | "video" };

interface LoadedMedia { gallery: GalleryItem[]; examples: GalleryItem[] }

let cache: Promise<LoadedMedia> | null = null;
const GALLERY_UPDATED_EVENT = "aiwebvideo:gallery-updated";

const withMedia = (list: MarketingVideo[] | undefined) => (list ?? [])
  .filter((item): item is MarketingVideo & { url: string } => Boolean(item.url))
  .map((item) => ({ ...item, kind: item.kind ?? "video" }) as GalleryItem);

const toLoaded = (settings: { videos: { showcase: MarketingVideo[]; examples?: MarketingVideo[] } }): LoadedMedia => ({
  gallery: withMedia(settings.videos.showcase),
  examples: withMedia(settings.videos.examples),
});

/** Publish the saved response immediately, including for a return to Home in this tab. */
export function publishGallery(settings: { videos: { showcase: MarketingVideo[]; examples?: MarketingVideo[] } }) {
  cache = Promise.resolve(toLoaded(settings));
  window.dispatchEvent(new Event(GALLERY_UPDATED_EVENT));
}

function loadMedia() {
  cache ??= fetchMarketingSettings()
    .then(toLoaded)
    .catch(() => { cache = null; return { gallery: [], examples: [] } as LoadedMedia; });
  return cache;
}

function useMediaLoad() {
  const [media, setMedia] = useState<LoadedMedia>({ gallery: [], examples: [] });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const refresh = () => {
      const current = ++revision;
      void loadMedia().then((all) => {
        if (!cancelled && current === revision) { setMedia(all); setLoaded(true); }
      });
    };
    refresh();
    window.addEventListener(GALLERY_UPDATED_EVENT, refresh);
    return () => { cancelled = true; window.removeEventListener(GALLERY_UPDATED_EVENT, refresh); };
  }, []);
  return { media, loaded };
}

/** Every homepage item, for the landing gallery. */
export function useGalleryItems() {
  const { media, loaded } = useMediaLoad();
  return { items: media.gallery, loaded };
}

/**
 * The examples right under the chat box. These are uploaded by an admin for that spot and are NEVER taken from the
 * gallery: with none uploaded, nothing is shown.
 */
export function useLandingExamples() {
  const { media, loaded } = useMediaLoad();
  return { examples: media.examples, loaded };
}

/** Only items filed under a feature: what the chat offers as "make one like this". */
export function useSamples() {
  const { media, loaded } = useMediaLoad();
  const all = [...media.gallery, ...media.examples].filter(isSample) as Sample[];
  return { samples: all.filter((item, index) => all.findIndex((other) => other.id === item.id) === index), loaded };
}

/** Tap on an item that is not filed under a feature: just take the visitor to the generator. */
export function scrollToGenerator() {
  document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const PENDING_SAMPLE_KEY = "aiwebvideo_pending_sample";
const PENDING_SAMPLE_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Picking an example on the public landing page sends the visitor through sign-in to the workspace.
 * Remember which example they picked so it is selected again when they arrive (and only for a short while).
 */
export function rememberPendingSample(sample: Pick<Sample, "id" | "feature">) {
  try { sessionStorage.setItem(PENDING_SAMPLE_KEY, JSON.stringify({ id: sample.id, feature: sample.feature, savedAt: Date.now() })); } catch { /* storage can be blocked */ }
}

export function peekPendingSample(): { id: string; feature: ShowcaseFeature } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_SAMPLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; feature?: ShowcaseFeature; savedAt?: number } | null;
    if (!parsed?.id || !parsed.feature || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > PENDING_SAMPLE_MAX_AGE_MS) {
      sessionStorage.removeItem(PENDING_SAMPLE_KEY);
      return null;
    }
    return { id: parsed.id, feature: parsed.feature };
  } catch { return null; }
}

export function clearPendingSample() {
  try { sessionStorage.removeItem(PENDING_SAMPLE_KEY); } catch { /* ignore */ }
}
