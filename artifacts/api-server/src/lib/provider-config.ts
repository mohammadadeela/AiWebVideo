import { query } from './pool.js';
export interface OperationsSettings {
  maintenanceMode: boolean;
  registrationsEnabled: boolean;
  maxConcurrentJobs: number;
}
const operationDefaults: OperationsSettings = { maintenanceMode: false, registrationsEnabled: true, maxConcurrentJobs: 3 };
let operationsCache: { value: OperationsSettings; expires: number } | null = null;

export function clearOperationsSettingsCache() {
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
