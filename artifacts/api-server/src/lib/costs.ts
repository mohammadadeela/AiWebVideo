import { query } from './pool.js';

export interface CostEvent {
  jobId: string;
  provider: string;
  model: string;
  operation: string;
  quantity: number;
  unit: string;
  unitCostUsd: number;
  metadata?: Record<string, unknown>;
}

/**
 * Records an itemized provider expense and updates the job total together.
 * Cost tracking is intentionally best-effort so a temporary analytics-table
 * issue can never turn a successful customer generation into a failed job.
 */
export async function recordGenerationCost(event: CostEvent): Promise<void> {
  const quantity = Math.max(0, Number(event.quantity) || 0);
  const unitCost = Math.max(0, Number(event.unitCostUsd) || 0);
  const total = quantity * unitCost;
  await query(
    `WITH inserted AS (
       INSERT INTO generation_cost_events
         (job_id,provider,model,operation,quantity,unit,unit_cost_usd,total_cost_usd,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING total_cost_usd
     )
     UPDATE jobs SET generation_provider=$2,
       generation_cost_usd=COALESCE(generation_cost_usd,0)+(SELECT total_cost_usd FROM inserted),
       updated_at=NOW() WHERE id=$1`,
    [event.jobId, `${event.provider}:${event.model}`, event.model, event.operation, quantity, event.unit, unitCost, total, event.metadata ? JSON.stringify(event.metadata) : null],
  ).catch((error) => console.warn(`[costs] could not record ${event.operation}: ${(error as Error).message}`));
}

function envCost(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const GEMINI_COST_CATALOG = {
  text: {
    inputToken: envCost('GEMINI_TEXT_INPUT_COST_PER_MILLION_USD', 0.50) / 1_000_000,
    outputToken: envCost('GEMINI_TEXT_OUTPUT_COST_PER_MILLION_USD', 3.00) / 1_000_000,
  },
  video: {
    lite720: envCost('GEMINI_VIDEO_LITE_720P_COST_PER_SECOND_USD', 0.05),
    lite1080: envCost('GEMINI_VIDEO_LITE_1080P_COST_PER_SECOND_USD', 0.08),
    fast720: envCost('GEMINI_VIDEO_FAST_720P_COST_PER_SECOND_USD', 0.10),
    fast1080: envCost('GEMINI_VIDEO_FAST_1080P_COST_PER_SECOND_USD', 0.12),
    fast4k: envCost('GEMINI_VIDEO_FAST_4K_COST_PER_SECOND_USD', 0.30),
    standard1080: envCost('GEMINI_VIDEO_STANDARD_1080P_COST_PER_SECOND_USD', 0.40),
    standard4k: envCost('GEMINI_VIDEO_STANDARD_4K_COST_PER_SECOND_USD', 0.60),
  },
  image: {
    twoK: envCost('GEMINI_IMAGE_COST_2K_USD', 0.101),
    fourK: envCost('GEMINI_IMAGE_COST_4K_USD', 0.151),
  },
  ttsAudioSecond: envCost('GEMINI_TTS_AUDIO_SECOND_COST_USD', 0.0005),
} as const;

export async function recordGeminiTextUsage(jobId: string, model: string, operation: string, usage: { promptTokenCount?: number | null; candidatesTokenCount?: number | null } | null | undefined): Promise<void> {
  const inputTokens = Math.max(0, Number(usage?.promptTokenCount ?? 0));
  const outputTokens = Math.max(0, Number(usage?.candidatesTokenCount ?? 0));
  await Promise.all([
    inputTokens ? recordGenerationCost({ jobId, provider: 'gemini', model, operation: `${operation}_input`, quantity: inputTokens, unit: 'token', unitCostUsd: GEMINI_COST_CATALOG.text.inputToken }) : Promise.resolve(),
    outputTokens ? recordGenerationCost({ jobId, provider: 'gemini', model, operation: `${operation}_output`, quantity: outputTokens, unit: 'token', unitCostUsd: GEMINI_COST_CATALOG.text.outputToken }) : Promise.resolve(),
  ]);
}
