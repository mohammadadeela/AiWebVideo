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

let cache: Promise<Sample[]> | null = null;
function loadSamples() {
  cache ??= fetchMarketingSettings()
    .then((settings) => settings.videos.showcase.filter(isSample).map((item) => ({ ...item, kind: item.kind ?? "video" }) as Sample))
    .catch(() => { cache = null; return [] as Sample[]; });
  return cache;
}

/** All published samples (shared between the landing gallery and the chat). */
export function useSamples() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadSamples().then((items) => { if (!cancelled) { setSamples(items); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);
  return { samples, loaded };
}
