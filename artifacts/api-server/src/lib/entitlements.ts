import { query } from './pool.js';
import type { CreationFeature, CreationScope } from './billing-products.js';

export function creationScope(input: { studioKind?: string | null; mode: string; modelId: string;
  durationSeconds: number; outputQuality: '1080p' | '4k'; audioMode: string }): CreationScope | null {
  const feature: CreationFeature = input.studioKind === 'product'
    ? input.mode === 'photos' ? 'product-photo' : 'product-video'
    : input.studioKind === 'interior' || input.studioKind === 'architecture' ? 'interior'
    : input.studioKind ? 'video' : 'website';
  if (input.outputQuality !== '1080p' || !['native_audio','silent'].includes(input.audioMode)) return null;
  return { feature, modelId: input.modelId, durationSeconds: ['product-photo','interior'].includes(feature)
    ? undefined : input.durationSeconds, quality: '1080p', audioMode: ['product-photo','interior'].includes(feature)
      ? 'silent' : input.audioMode as 'native_audio' | 'silent' };
}

export async function hasScopedEntitlement(userId: string, scope: CreationScope | null, amount: number) {
  if (!scope) return false;
  const { rows } = await query<{ id: string }>(`SELECT id FROM one_time_generation_entitlements
    WHERE user_id=$1 AND feature=$2 AND model_id=$3 AND duration_seconds IS NOT DISTINCT FROM $4
      AND quality=$5 AND audio_mode=$6 AND status='available' AND remaining_credits >= $7 LIMIT 1`,
    [userId,scope.feature,scope.modelId,scope.durationSeconds ?? null,scope.quality,scope.audioMode,amount]);
  return Boolean(rows[0]);
}
