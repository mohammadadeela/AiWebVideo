import { useMemo } from 'react';
import { PurchaseModal } from '@/components/billing/PurchaseModal';
import { estimateRenderCredits } from '@/lib/credits';
import { publicModel } from '@/lib/generationModels';

/**
 * Shown when a generation needs more credits than the person has. Every pack and plan is listed; the
 * best fit for exactly what is configured (model, length, quality, photos or video) is marked and first.
 */
export function PaywallModal({
  onClose,
  context,
  durationSeconds = 8,
  mode = 'video',
  outputQuality = '1080p',
  skipVoiceover = false,
  modelId = null,
  currentBalance = 0,
  reservedCredits = 0,
  jobId,
}: {
  onClose: () => void;
  context?: string;
  durationSeconds?: number;
  mode?: string;
  outputQuality?: '1080p' | '4k';
  skipVoiceover?: boolean;
  modelId?: string | null;
  currentBalance?: number;
  reservedCredits?: number;
  jobId?: string | null;
}) {
  const isPhotoMode = mode === 'photos' || mode === 'icon';
  const required = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality, modelId);
  const modelLabel = useMemo(() => {
    try { return publicModel(modelId ?? (isPhotoMode ? 'graphic-2' : 'cinema-2')).name.replace(/^AiWebVideo\s+/, ''); } catch { return null; }
  }, [isPhotoMode, modelId]);
  const summary = [
    isPhotoMode ? '4 photos' : `${durationSeconds}s`,
    outputQuality === '4k' ? '4K' : '1080p',
    modelLabel,
    `${required.toLocaleString()} credits`,
  ].filter(Boolean).join(' · ');

  return (
    <PurchaseModal
      onClose={onClose}
      title="Finish this production"
      summary={summary}
      context={context}
      funded={currentBalance + reservedCredits}
      required={required}
      // One-video packs are for videos; a photo set is bought with credits or a plan.
      includeVideoPacks={!isPhotoMode}
      videoTabLabel="One video"
      jobId={jobId}
    />
  );
}
