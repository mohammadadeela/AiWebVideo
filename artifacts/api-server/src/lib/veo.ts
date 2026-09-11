// Keep the proven legacy helpers available exactly as before, while routing
// customer video generation through the native-resolution premium scene
// renderer. The premium renderer preserves the current no-paid-retry,
// cancellation and partial-refund protections but never uses the 720p Veo
// extension chain for paid 1080p/4K customer output.
export * from './veo-base.js';
export { generateMarketingVideo } from './veo-premium.js';
export type { GeneratedVideo } from './veo-premium.js';
