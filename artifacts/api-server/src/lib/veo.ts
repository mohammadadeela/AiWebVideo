// Keep the proven legacy helpers available exactly as before, while routing
// customer video generation through the partial-delivery-safe implementation.
export * from './veo-base.js';
export { generateMarketingVideo } from './veo-partial.js';
export type { GeneratedVideo } from './veo-partial.js';
