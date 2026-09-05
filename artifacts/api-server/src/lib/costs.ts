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

export const GEMINI_COST_CATALOG = {
  text: {
    inputToken: Number(process.env.GEMINI_TEXT_INPUT_COST_PER_MILLION_USD ?? 0.50) / 1_000_000,
    outputToken: Number(process.env.GEMINI_TEXT_OUTPUT_COST_PER_MILLION_USD ?? 3.00) / 1_000_000,
  },
  video: {
    lite720: 0.05,
    lite1080: 0.08,
    fast720: 0.10,
    fast1080: 0.12,
    fast4k: 0.30,
    standard1080: 0.40,
    standard4k: 0.60,
  },
  image: { twoK: 0.101, fourK: 0.151 },
  ttsAudioSecond: 0.0005,
} as const;

export async function recordGeminiTextUsage(jobId: string, model: string, operation: string, usage: { promptTokenCount?: number | null; candidatesTokenCount?: number | null } | null | undefined): Promise<void> {
  const inputTokens = Math.max(0, Number(usage?.promptTokenCount ?? 0));
  const outputTokens = Math.max(0, Number(usage?.candidatesTokenCount ?? 0));
  await Promise.all([
    inputTokens ? recordGenerationCost({ jobId, provider: 'gemini', model, operation: `${operation}_input`, quantity: inputTokens, unit: 'token', unitCostUsd: GEMINI_COST_CATALOG.text.inputToken }) : Promise.resolve(),
    outputTokens ? recordGenerationCost({ jobId, provider: 'gemini', model, operation: `${operation}_output`, quantity: outputTokens, unit: 'token', unitCostUsd: GEMINI_COST_CATALOG.text.outputToken }) : Promise.resolve(),
  ]);
}
