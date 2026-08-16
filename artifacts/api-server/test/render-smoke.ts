/**
 * No-network AI-video pipeline smoke test.
 *
 * The old smoke test rendered screenshot pans/zooms with FFmpeg. That would
 * validate the architecture we intentionally removed. This smoke test now
 * validates the master prompt contract for every AI-video feature instead.
 * Provider API calls are covered in deployment/integration testing where real
 * Gemini/RunPod credentials are available.
 *
 * Run with: pnpm --filter @workspace/api-server run smoke:render
 */
import { buildAiVideoScenePrompt, VIDEO_MASTER_PROMPTS } from '../src/lib/video-prompts.js';
import type { StoryboardScene } from '../src/lib/gemini.js';

const MODES = ['video', 'tutorial', 'buy', 'tour', 'demo', 'both', 'mockup', 'custom'] as const;

function scene(mode: string): StoryboardScene {
  return {
    sceneNumber: 1,
    durationSeconds: 8,
    sceneType: mode === 'buy' || mode === 'tutorial' ? 'interaction' : 'hook',
    shotDescription: mode === 'buy'
      ? 'Show a natural click on the real Add to Cart control and move into the supplied real cart state.'
      : 'Generate purposeful real motion from the supplied website state and finish on a clean resolved frame.',
    sourceIndices: mode === 'buy' ? [0, 1] : [0],
    composition: 'single',
    motion: 'static',
    focusX: 0.5,
    focusY: 0.5,
    onScreenCopy: '',
    transition: '',
  };
}

function main() {
  const results: string[] = [];
  for (const mode of MODES) {
    if (!VIDEO_MASTER_PROMPTS[mode]) throw new Error(`Missing master prompt for ${mode}`);
    const prompt = buildAiVideoScenePrompt({
      mode,
      siteTitle: 'Smoke Website',
      concept: 'Grounded AI video smoke test',
      vibe: 'premium',
      scene: scene(mode),
      sceneIndex: 0,
      totalScenes: 1,
      targetDurationSeconds: 8,
      nativeAudio: true,
      referenceLabels: mode === 'buy' ? ['Product page', 'Shopping cart'] : ['Homepage'],
      variantSeed: 42,
      aspectRatio: '16:9',
    });
    if (!prompt.includes('Generate a REAL moving AI-video clip')) throw new Error(`${mode}: not a true AI-video prompt`);
    if (!prompt.includes('Preserve visible Arabic/English UI text')) throw new Error(`${mode}: missing UI fidelity rule`);
    if (!prompt.includes('meaningful action finishes before the clip ends')) throw new Error(`${mode}: missing completion rule`);
    if (prompt.length >= 5200) throw new Error(`${mode}: prompt too long (${prompt.length} chars)`);
    results.push(`${mode}: prompt=${prompt.length} chars`);
  }
  console.log('AI VIDEO PIPELINE SMOKE TEST PASSED');
  for (const result of results) console.log(' -', result);
}

main();
