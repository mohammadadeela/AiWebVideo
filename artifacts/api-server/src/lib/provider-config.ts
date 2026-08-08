import { query } from './pool.js';

export type MediaKind = 'image' | 'video';
export type ProviderChoice = 'auto' | 'gemini' | 'open_source';

export interface ProviderSettings {
  image: ProviderChoice;
  video: ProviderChoice;
  fallbackEnabled: boolean;
}

const defaults: ProviderSettings = { image: 'auto', video: 'auto', fallbackEnabled: true };
let cache: { value: ProviderSettings; expires: number } | null = null;
export interface OperationsSettings {
  maintenanceMode: boolean;
  registrationsEnabled: boolean;
  maxConcurrentJobs: number;
}
const operationDefaults: OperationsSettings = { maintenanceMode: false, registrationsEnabled: true, maxConcurrentJobs: 3 };
let operationsCache: { value: OperationsSettings; expires: number } | null = null;

export async function getProviderSettings(): Promise<ProviderSettings> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const { rows } = await query<{ value: Partial<ProviderSettings> }>(
    `SELECT value FROM system_settings WHERE key='providers' LIMIT 1`,
  ).catch(() => ({ rows: [] as Array<{ value: Partial<ProviderSettings> }> }));
  const value = { ...defaults, ...(rows[0]?.value ?? {}) };
  cache = { value, expires: Date.now() + 5_000 };
  return value;
}

export function clearProviderSettingsCache() {
  cache = null;
  operationsCache = null;
}

export async function getOperationsSettings(): Promise<OperationsSettings> {
  if (operationsCache && operationsCache.expires > Date.now()) return operationsCache.value;
  const { rows } = await query<{ value: Partial<OperationsSettings> }>(
    `SELECT value FROM system_settings WHERE key='operations' LIMIT 1`,
  ).catch(() => ({ rows: [] as Array<{ value: Partial<OperationsSettings> }> }));
  const raw = { ...operationDefaults, ...(rows[0]?.value ?? {}) };
  const value = { ...raw, maxConcurrentJobs: Math.max(1, Math.min(20, Number(raw.maxConcurrentJobs) || 3)) };
  operationsCache = { value, expires: Date.now() + 5_000 };
  return value;
}

export async function productionCapacity() {
  const settings = await getOperationsSettings();
  const { rows } = await query<{ active: number }>(
    `SELECT COUNT(*)::int active FROM jobs WHERE deleted_at IS NULL AND status IN ('queued','capturing','storyboarding','rendering')`,
  );
  return { active: rows[0]?.active ?? 0, maximum: settings.maxConcurrentJobs };
}

export function providerAvailability(kind: MediaKind) {
  const openSource = kind === 'image'
    ? Boolean(process.env.RUNPOD_IMAGE_ENDPOINT_ID || process.env.GPU_IMAGE_ENDPOINT || process.env.GPU_SERVER_URL)
    : Boolean(process.env.RUNPOD_VIDEO_ENDPOINT_ID || process.env.GPU_VIDEO_ENDPOINT || process.env.GPU_SERVER_URL);
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openSource,
  };
}

export async function resolveProvider(kind: MediaKind): Promise<'gemini' | 'open_source'> {
  const settings = await getProviderSettings();
  const selected = settings[kind];
  const availability = providerAvailability(kind);
  if (selected === 'gemini') {
    if (!availability.gemini) throw new Error(`The selected ${kind} provider is not configured.`);
    return 'gemini';
  }
  if (selected === 'open_source') {
    if (!availability.openSource) throw new Error(`The selected open-source ${kind} provider is not configured.`);
    return 'open_source';
  }
  // In Auto mode, prefer Google's current native image model when Gemini is
  // configured. It provides the closest behavior to Gemini's own image editing
  // experience. Admins can still explicitly select open_source when they want
  // the RunPod/GPU path for cost or throughput reasons.
  if (kind === 'image' && availability.gemini) return 'gemini';
  if (availability.openSource) return 'open_source';
  if (availability.gemini) return 'gemini';
  throw new Error(`No ${kind} generation provider is configured.`);
}
