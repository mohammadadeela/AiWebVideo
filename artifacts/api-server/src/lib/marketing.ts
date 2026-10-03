import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { query } from './pool.js';
import { ensureLocalAsset } from './r2-storage.js';

const execFileAsync = promisify(execFile);

/** The creation features a showcase item can be filed under (matches the chat's creation modes). */
export const SHOWCASE_FEATURES = ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'] as const;
export type ShowcaseFeature = (typeof SHOWCASE_FEATURES)[number];

export interface MarketingVideo {
  id: string;
  url: string | null;
  posterUrl: string | null;
  caption: string | null;
  overlayText: string | null;
  eyebrow: string | null;
  /** 'image' or 'video'. Older saved items have no kind and are videos. */
  kind: 'image' | 'video';
  /** Which chat feature this sample belongs to. Required for every item that has media. */
  feature: ShowcaseFeature | null;
}

export interface MarketingSettings {
  heading: string;
  description: string;
  videos: {
    /** The gallery on the home page (many items, filed under features). */
    showcase: MarketingVideo[];
    /**
     * The few photos/videos that float around the chat box on the home page: uploaded and chosen by an admin FOR that
     * place, never picked from the gallery. They are decorative (visitors cannot click them); the feature chosen for
     * each one only decides the label on its card.
     */
    examples: MarketingVideo[];
  };
}

/** How many photos an admin can float around the chat box: a few, never many. */
export const MAX_LANDING_EXAMPLES = 4;

// Room for roughly 40 examples per feature (7 features). The chat and landing page load them progressively.
export const MAX_MARKETING_VIDEOS = 280;
const emptyVideo = (id: string): MarketingVideo => ({ id, url: null, posterUrl: null, caption: null, overlayText: null, eyebrow: null, kind: 'video', feature: null });
const defaults: MarketingSettings = {
  heading: 'Made with AiWebVideo',
  description: 'See short examples created by people using the studio, then start with your own website.',
  videos: { showcase: [emptyVideo('example-1'), emptyVideo('example-2'), emptyVideo('example-3')], examples: [] },
};

let cache: { value: MarketingSettings; expires: number } | null = null;

/** Turns whatever is stored (possibly an older shape) into a complete, safe settings object. */
export function normalizeMarketingSettings(rawInput: unknown): MarketingSettings {
  const raw = (rawInput && typeof rawInput === 'object' ? rawInput : {}) as Partial<MarketingSettings>;
  const legacy = raw.videos as unknown as { feature?: Partial<MarketingVideo>; howTo?: Partial<MarketingVideo>; showcase?: Partial<MarketingVideo>[]; examples?: Partial<MarketingVideo>[] } | undefined;
  const supplied = legacy?.showcase?.length
    ? legacy.showcase
    : [legacy?.feature, legacy?.howTo].filter(Boolean) as Partial<MarketingVideo>[];
  const examples = (Array.isArray(legacy?.examples) ? legacy!.examples! : [])
    .filter((item) => item && typeof item === 'object')
    .slice(0, MAX_LANDING_EXAMPLES)
    .map((item, index) => ({
      ...emptyVideo(`landing-${index + 1}`),
      ...item,
      id: String(item?.id ?? `landing-${index + 1}`),
    }));
  return {
    heading: typeof raw.heading === 'string' ? raw.heading : defaults.heading,
    description: typeof raw.description === 'string' ? raw.description : defaults.description,
    videos: {
      showcase: (supplied.length ? supplied : defaults.videos.showcase)
        .slice(0, MAX_MARKETING_VIDEOS)
        .map((item, index) => ({
          ...emptyVideo(`example-${index + 1}`),
          ...(item ?? {}),
          id: String(item?.id ?? `example-${index + 1}`),
        })),
      examples,
    },
  };
}

export async function getMarketingSettings(): Promise<MarketingSettings> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const { rows } = await query<{ value: Partial<MarketingSettings> }>(
    `SELECT value FROM system_settings WHERE key='marketing' LIMIT 1`,
  ).catch(() => ({ rows: [] as Array<{ value: Partial<MarketingSettings> }> }));
  const value = normalizeMarketingSettings(rows[0]?.value ?? {});
  cache = { value, expires: Date.now() + 5_000 };
  return value;
}

export function clearMarketingSettingsCache() { cache = null; }

export { defaults as marketingDefaults };

/** Finds a gallery item by id (only items that have media and a feature can be used as samples). The floating landing photos are decoration and are never samples. */
export async function findShowcaseSample(id: string): Promise<MarketingVideo | null> {
  const settings = await getMarketingSettings();
  return settings.videos.showcase.find((item) => item.id === id && item.url && item.feature) ?? null;
}

/** A still image of the sample: the image itself, a video's poster, or a frame pulled from the video. */
export async function loadShowcaseStill(item: MarketingVideo): Promise<Buffer | null> {
  const fileOf = (url: string | null) => /^\/api\/assets\/marketing\/([a-z0-9][a-z0-9._-]{0,180})$/i.exec(url ?? '')?.[1] ?? null;
  const readAsset = async (url: string | null) => {
    const name = fileOf(url);
    if (!name) return null;
    const local = await ensureLocalAsset('marketing', name).catch(() => null);
    return local ? { path: local, buffer: await fs.readFile(local) } : null;
  };
  if (item.kind === 'image') return (await readAsset(item.url))?.buffer ?? null;
  const poster = await readAsset(item.posterUrl);
  if (poster) return poster.buffer;
  const video = await readAsset(item.url);
  if (!video) return null;
  const frame = `${video.path}.frame.jpg`;
  try {
    await execFileAsync('ffmpeg', ['-y', '-ss', '0.5', '-i', video.path, '-frames:v', '1', '-q:v', '3', frame], { timeout: 60_000 });
    return await fs.readFile(frame);
  } catch { return null; } finally { await fs.rm(frame, { force: true }).catch(() => {}); }
}
