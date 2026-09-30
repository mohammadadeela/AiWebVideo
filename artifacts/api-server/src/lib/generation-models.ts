export type PublicGenerationModelId =
  | 'cinema-1'
  | 'cinema-2'
  | 'cinema-pro'
  | 'graphic-1'
  | 'graphic-2'
  | 'graphic-pro'
  | 'space-1'
  | 'space-2'
  | 'space-pro';

export type GenerationModelKind = 'video' | 'image' | 'interior';

export interface GenerationModelDefinition {
  id: PublicGenerationModelId;
  publicName: string;
  kind: GenerationModelKind;
  description: string;
  bestFor: string;
  providerModel: string;
  supports4k: boolean;
  nativeAudio: boolean;
  outputQuality: '1080p' | '4k';
  providerImageSize?: '1K' | '2K' | '4K';
  providerCostUsd: number;
  creditUnit: 'second' | 'image';
  internalCredits: number;
  internalCredits4k?: number;
  providerCost4kUsd?: number;
}

/**
 * Server-owned model catalog.
 * Provider identifiers never need to be returned to the browser.
 *
 * Internal credit prices are chosen from the lowest net revenue-per-credit
 * sold by the site (including the welcome discount) and rounded UP so the
 * customer revenue remains at least 2x the modeled provider cost.
 */
export const GENERATION_MODELS: Record<PublicGenerationModelId, GenerationModelDefinition> = {
  'cinema-1': {
    id: 'cinema-1',
    publicName: 'AiWebVideo Cinema 1',
    kind: 'video',
    description: 'Fast, efficient 1080p video for everyday ads and social content.',
    bestFor: 'Fast social clips, product teasers and lower-cost drafts',
    providerModel: 'veo-3.1-lite-generate-preview',
    supports4k: false,
    nativeAudio: true,
    outputQuality: '1080p',
    providerCostUsd: 0.08,
    creditUnit: 'second',
    internalCredits: 1,
  },
  'cinema-2': {
    id: 'cinema-2',
    publicName: 'AiWebVideo Cinema 2',
    kind: 'video',
    description: 'Balanced cinematic quality, speed and native scene sound.',
    bestFor: 'Website promos, product videos and campaign content',
    providerModel: 'veo-3.1-fast-generate-preview',
    supports4k: true,
    nativeAudio: true,
    outputQuality: '1080p',
    providerCostUsd: 0.12,
    creditUnit: 'second',
    internalCredits: 2,
  },
  'cinema-pro': {
    id: 'cinema-pro',
    publicName: 'AiWebVideo Cinema Pro',
    kind: 'video',
    description: 'Highest-fidelity cinematic generation for premium commercial work.',
    bestFor: 'Hero campaigns, premium ads and maximum visual quality',
    providerModel: 'veo-3.1-generate-preview',
    supports4k: true,
    nativeAudio: true,
    outputQuality: '4k',
    providerCostUsd: 0.60,
    creditUnit: 'second',
    internalCredits: 6,
  },
  'graphic-1': {
    id: 'graphic-1',
    publicName: 'AiWebVideo Graphic 1',
    kind: 'image',
    description: 'Quick product and campaign images with low generation cost.',
    bestFor: 'Fast concepts, ecommerce variants and high-volume image work',
    providerModel: 'gemini-3.1-flash-lite-image',
    supports4k: false,
    nativeAudio: false,
    outputQuality: '1080p',
    providerImageSize: '1K',
    providerCostUsd: 0.0336,
    creditUnit: 'image',
    internalCredits: 1,
  },
  'graphic-2': {
    id: 'graphic-2',
    publicName: 'AiWebVideo Graphic 2',
    kind: 'image',
    description: 'Sharper, more detailed campaign images with strong instruction following.',
    bestFor: 'Product photography, social creatives and polished marketing images',
    providerModel: 'gemini-3.1-flash-image',
    supports4k: true,
    nativeAudio: false,
    outputQuality: '1080p',
    providerImageSize: '2K',
    providerCostUsd: 0.101,
    providerCost4kUsd: 0.151,
    creditUnit: 'image',
    internalCredits: 1,
    internalCredits4k: 2,
  },
  'graphic-pro': {
    id: 'graphic-pro',
    publicName: 'AiWebVideo Graphic Pro',
    kind: 'image',
    description: 'Professional 4K visual generation for demanding commercial assets.',
    bestFor: 'Premium campaign art, complex layouts and high-detail product work',
    providerModel: 'gemini-3-pro-image',
    supports4k: true,
    nativeAudio: false,
    outputQuality: '4k',
    providerImageSize: '4K',
    providerCostUsd: 0.24,
    creditUnit: 'image',
    internalCredits: 3,
  },
  'space-1': {
    id: 'space-1',
    publicName: 'AiWebVideo Space 1',
    kind: 'interior',
    description: 'Fast interior concepts for exploring layouts, mood and materials.',
    bestFor: 'Early concepts and rapid interior iterations',
    providerModel: 'gemini-3.1-flash-lite-image',
    supports4k: false,
    nativeAudio: false,
    outputQuality: '1080p',
    providerImageSize: '1K',
    providerCostUsd: 0.0336,
    creditUnit: 'image',
    internalCredits: 1,
  },
  'space-2': {
    id: 'space-2',
    publicName: 'AiWebVideo Space 2',
    kind: 'interior',
    description: 'Detailed interior visualization with stronger material and geometry fidelity.',
    bestFor: 'Retail, residential and architectural design presentations',
    providerModel: 'gemini-3.1-flash-image',
    supports4k: true,
    nativeAudio: false,
    outputQuality: '1080p',
    providerImageSize: '2K',
    providerCostUsd: 0.101,
    providerCost4kUsd: 0.151,
    creditUnit: 'image',
    internalCredits: 1,
    internalCredits4k: 2,
  },
  'space-pro': {
    id: 'space-pro',
    publicName: 'AiWebVideo Space Pro',
    kind: 'interior',
    description: 'Premium 4K interior visualization for presentation-ready design work.',
    bestFor: 'Final concepts, client presentations and high-detail spaces',
    providerModel: 'gemini-3-pro-image',
    supports4k: true,
    nativeAudio: false,
    outputQuality: '4k',
    providerImageSize: '4K',
    providerCostUsd: 0.24,
    creditUnit: 'image',
    internalCredits: 3,
  },
};

export function generationModel(id: string | null | undefined): GenerationModelDefinition {
  const model = id ? GENERATION_MODELS[id as PublicGenerationModelId] : undefined;
  return model ?? GENERATION_MODELS['cinema-2'];
}

export function generationModelForMode(
  id: string | null | undefined,
  mode: string,
  studioKind?: string | null,
): GenerationModelDefinition {
  const fallbackId: PublicGenerationModelId =
    mode === 'photos' || mode === 'icon'
      ? studioKind === 'interior' ? 'space-2' : 'graphic-2'
      : 'cinema-2';
  const model = id ? GENERATION_MODELS[id as PublicGenerationModelId] : undefined;
  if (!model) return GENERATION_MODELS[fallbackId];
  if (mode === 'photos' || mode === 'icon') {
    if (studioKind === 'interior') return model.kind === 'interior' ? model : GENERATION_MODELS['space-2'];
    return model.kind === 'image' ? model : GENERATION_MODELS['graphic-2'];
  }
  return model.kind === 'video' ? model : GENERATION_MODELS['cinema-2'];
}

export function videoModelCreditsPerSecond(model: GenerationModelDefinition, quality: '1080p' | '4k'): number {
  if (model.kind !== 'video') return 0;
  if (model.id === 'cinema-1') return 1;
  if (model.id === 'cinema-2') return quality === '4k' ? 3 : 2;
  return quality === '4k' ? 6 : 4;
}

export function videoModelProviderCostPerSecond(model: GenerationModelDefinition, quality: '1080p' | '4k'): number {
  if (model.id === 'cinema-1') return 0.08;
  if (model.id === 'cinema-2') return quality === '4k' ? 0.30 : 0.12;
  if (model.id === 'cinema-pro') return quality === '4k' ? 0.60 : 0.40;
  return model.providerCostUsd;
}

export function imageModelCreditsPerImage(model: GenerationModelDefinition, quality: '1080p' | '4k' = '1080p'): number {
  if (model.creditUnit !== 'image') return 1;
  return quality === '4k' ? (model.internalCredits4k ?? model.internalCredits) : model.internalCredits;
}

export function imageModelProviderCostPerImage(model: GenerationModelDefinition, quality: '1080p' | '4k' = '1080p'): number {
  return quality === '4k' ? (model.providerCost4kUsd ?? model.providerCostUsd) : model.providerCostUsd;
}
