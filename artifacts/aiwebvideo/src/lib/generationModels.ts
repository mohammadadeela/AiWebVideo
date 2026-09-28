export type PublicModelId =
  | 'cinema-1'
  | 'cinema-2'
  | 'cinema-pro'
  | 'graphic-1'
  | 'graphic-2'
  | 'graphic-pro'
  | 'space-1'
  | 'space-2'
  | 'space-pro';

export interface PublicModelCard {
  id: PublicModelId;
  name: string;
  family: 'video' | 'image' | 'interior';
  tagline: string;
  bestFor: string;
  speed: 'Fastest' | 'Fast' | 'Balanced' | 'Premium';
  quality: string;
  nativeAudio: boolean;
  supports4k: boolean;
  supportsDuration: boolean;
  supportedQualities: Array<'1080p' | '4k'>;
  audioModes: Array<'native_audio' | 'voice_music' | 'music_only' | 'silent'>;
  recommended?: boolean;
  internalCredits1080p?: number;
  internalCredits4k?: number;
  internalCreditsPerImage?: number;
}

export const PUBLIC_MODELS: PublicModelCard[] = [
  {
    id: 'cinema-1', name: 'AiWebVideo Cinema 1', family: 'video',
    tagline: 'Fast, efficient video for everyday creation.',
    bestFor: 'Social clips, drafts and product teasers',
    speed: 'Fastest', quality: '1080p', nativeAudio: true, supports4k: false, supportsDuration: true, supportedQualities: ['1080p'], audioModes: ['native_audio', 'voice_music', 'music_only', 'silent'],
    internalCredits1080p: 1,
  },
  {
    id: 'cinema-2', name: 'AiWebVideo Cinema 2', family: 'video',
    tagline: 'The best balance of cinematic quality, speed and price.',
    bestFor: 'Website promos, campaigns and product videos',
    speed: 'Fast', quality: '1080p / 4K', nativeAudio: true, supports4k: true, supportsDuration: true, supportedQualities: ['1080p', '4k'], audioModes: ['native_audio', 'voice_music', 'music_only', 'silent'], recommended: true,
    internalCredits1080p: 2, internalCredits4k: 3,
  },
  {
    id: 'cinema-pro', name: 'AiWebVideo Cinema Pro', family: 'video',
    tagline: 'Maximum fidelity for premium commercial work.',
    bestFor: 'Hero campaigns, premium ads and final masters',
    speed: 'Premium', quality: '1080p / 4K', nativeAudio: true, supports4k: true, supportsDuration: true, supportedQualities: ['1080p', '4k'], audioModes: ['native_audio', 'voice_music', 'music_only', 'silent'],
    internalCredits1080p: 4, internalCredits4k: 6,
  },
  {
    id: 'graphic-1', name: 'AiWebVideo Graphic 1', family: 'image',
    tagline: 'Fast image generation for high-volume creative work.',
    bestFor: 'Concepts, ecommerce variants and quick tests',
    speed: 'Fastest', quality: '1K', nativeAudio: false, supports4k: false, supportsDuration: false, supportedQualities: ['1080p'], audioModes: [],
    internalCreditsPerImage: 1,
  },
  {
    id: 'graphic-2', name: 'AiWebVideo Graphic 2', family: 'image',
    tagline: 'Sharper campaign imagery with stronger detail.',
    bestFor: 'Product photos and polished marketing creatives',
    speed: 'Fast', quality: '2K / 4K', nativeAudio: false, supports4k: true, supportsDuration: false, supportedQualities: ['1080p', '4k'], audioModes: [], recommended: true,
    internalCreditsPerImage: 1, internalCredits4k: 2,
  },
  {
    id: 'graphic-pro', name: 'AiWebVideo Graphic Pro', family: 'image',
    tagline: 'Professional 4K visuals for demanding commercial assets.',
    bestFor: 'Premium campaign art and complex layouts',
    speed: 'Premium', quality: '4K', nativeAudio: false, supports4k: true, supportsDuration: false, supportedQualities: ['4k'], audioModes: [],
    internalCreditsPerImage: 3,
  },
  {
    id: 'space-1', name: 'AiWebVideo Space 1', family: 'interior',
    tagline: 'Fast interior concepts for exploring a direction.',
    bestFor: 'Early layouts, mood and material studies',
    speed: 'Fastest', quality: '1K', nativeAudio: false, supports4k: false, supportsDuration: false, supportedQualities: ['1080p'], audioModes: [],
    internalCreditsPerImage: 1,
  },
  {
    id: 'space-2', name: 'AiWebVideo Space 2', family: 'interior',
    tagline: 'Detailed visualization with stronger spatial fidelity.',
    bestFor: 'Retail, residential and architectural concepts',
    speed: 'Fast', quality: '2K / 4K', nativeAudio: false, supports4k: true, supportsDuration: false, supportedQualities: ['1080p', '4k'], audioModes: [], recommended: true,
    internalCreditsPerImage: 1, internalCredits4k: 2,
  },
  {
    id: 'space-pro', name: 'AiWebVideo Space Pro', family: 'interior',
    tagline: 'Presentation-ready 4K interior visualization.',
    bestFor: 'Final concepts and client presentations',
    speed: 'Premium', quality: '4K', nativeAudio: false, supports4k: true, supportsDuration: false, supportedQualities: ['4k'], audioModes: [],
    internalCreditsPerImage: 3,
  },
];

export function publicModel(id: string | null | undefined) {
  return PUBLIC_MODELS.find((model) => model.id === id) ?? PUBLIC_MODELS.find((model) => model.id === 'cinema-2')!;
}

export function modelsFor(family: PublicModelCard['family']) {
  return PUBLIC_MODELS.filter((model) => model.family === family);
}

export function defaultModelFor(family: PublicModelCard['family']): PublicModelId {
  return family === 'video' ? 'cinema-2' : family === 'interior' ? 'space-2' : 'graphic-2';
}
