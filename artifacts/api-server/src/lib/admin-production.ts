export type AdminProductionFeature =
  | 'website-video'
  | 'ai-video'
  | 'ai-images'
  | 'product-photos'
  | 'product-video'
  | 'talking-scene';

const FEATURE_LABELS: Record<AdminProductionFeature, string> = {
  'website-video': 'Website Video',
  'ai-video': 'AI Video',
  'ai-images': 'AI Images',
  'product-photos': 'Product Photos',
  'product-video': 'Product Video',
  'talking-scene': 'Talking Scene',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function classifyAdminProduction(input: {
  mode?: unknown;
  captureMetadata?: unknown;
  workflowState?: unknown;
}) {
  const capture = record(input.captureMetadata);
  const workflow = record(input.workflowState);
  const mode = String(input.mode ?? workflow.mode ?? 'video');
  const sourceType = String(capture.sourceType ?? '');
  const studioKind = String(capture.studioKind ?? '');

  const type: AdminProductionFeature = sourceType === 'studio' && studioKind === 'product'
    ? mode === 'photos' ? 'product-photos' : 'product-video'
    : sourceType === 'studio' && studioKind === 'scenario'
      ? 'talking-scene'
      : sourceType === 'studio' && studioKind === 'idea'
        ? 'ai-video'
        : mode === 'product-video'
          ? 'product-video'
          : mode === 'talking-scene'
            ? 'talking-scene'
            : mode === 'ai-video' || mode === 'custom'
              ? 'ai-video'
              : mode === 'photos'
                ? 'ai-images'
                : 'website-video';

  return { type, label: FEATURE_LABELS[type] };
}
