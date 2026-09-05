import { query } from './pool.js';

export interface MarketingVideo {
  id: string;
  url: string | null;
  posterUrl: string | null;
  caption: string | null;
  overlayText: string | null;
  eyebrow: string | null;
}

export interface MarketingSettings {
  heading: string;
  description: string;
  videos: {
    showcase: MarketingVideo[];
  };
}

export const MAX_MARKETING_VIDEOS = 30;
const emptyVideo = (id: string): MarketingVideo => ({ id, url: null, posterUrl: null, caption: null, overlayText: null, eyebrow: null });
const defaults: MarketingSettings = {
  heading: 'Made with AiWebVideo',
  description: 'See short examples created by people using the studio, then start with your own website.',
  videos: { showcase: [emptyVideo('example-1'), emptyVideo('example-2'), emptyVideo('example-3')] },
};

let cache: { value: MarketingSettings; expires: number } | null = null;

export async function getMarketingSettings(): Promise<MarketingSettings> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const { rows } = await query<{ value: Partial<MarketingSettings> }>(
    `SELECT value FROM system_settings WHERE key='marketing' LIMIT 1`,
  ).catch(() => ({ rows: [] as Array<{ value: Partial<MarketingSettings> }> }));
  const raw = rows[0]?.value ?? {};
  const legacy = raw.videos as unknown as { feature?: Partial<MarketingVideo>; howTo?: Partial<MarketingVideo>; showcase?: Partial<MarketingVideo>[] } | undefined;
  const supplied = legacy?.showcase?.length
    ? legacy.showcase
    : [legacy?.feature, legacy?.howTo].filter(Boolean) as Partial<MarketingVideo>[];
  const value: MarketingSettings = {
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
    },
  };
  cache = { value, expires: Date.now() + 5_000 };
  return value;
}

export function clearMarketingSettingsCache() { cache = null; }

export { defaults as marketingDefaults };
