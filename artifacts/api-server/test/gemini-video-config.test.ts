import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContinuousBaseVideoConfig, buildGeminiVideoConfig, buildGeminiVideoSource } from '../src/lib/veo.js';

/**
 * Regression coverage for a real production bug: the Gemini Developer API
 * rejects `personGeneration: allow_adult`, `negativePrompt`, and also rejects
 * `generateAudio` with "generateAudio parameter is only
 * supported in Gemini Enterprise Agent Platform mode, not in Gemini
 * Developer API mode" — confirmed against live production logs. This is the
 * exact same failure class as the earlier `seed` issue this codebase already
 * guards against. Every scene was failing before reaching Veo.
 *
 * This test asserts on the real config object the app sends to
 * @google/genai, not on a description of it, so a future edit that
 * reintroduces any field fails loudly here instead of only showing up as a
 * live 400 error in production logs. `personGeneration` is intentionally
 * omitted so the Developer API applies its supported default behavior.
 */

const FORBIDDEN_FIELDS = ['personGeneration', 'generateAudio', 'seed', 'negativePrompt'];

test('Gemini video config never includes Developer-API-unsupported fields (no lastFrame)', () => {
  const config = buildGeminiVideoConfig('16:9', '1080p', false);
  for (const field of FORBIDDEN_FIELDS) {
    assert.equal(field in config, false, `config must not include '${field}' — it is rejected by the Gemini Developer API`);
  }
  assert.equal(config.aspectRatio, '16:9');
  assert.equal(config.resolution, '1080p');
  assert.equal('lastFrame' in config, false);
});

test('Gemini video config never includes Developer-API-unsupported fields (with lastFrame / 4k)', () => {
  const lastFrame = { imageBytes: 'ZmFrZQ==', mimeType: 'image/jpeg' };
  const config = buildGeminiVideoConfig('9:16', '4k', true, lastFrame);
  for (const field of FORBIDDEN_FIELDS) {
    assert.equal(field in config, false, `config must not include '${field}' — it is rejected by the Gemini Developer API`);
  }
  assert.equal(config.aspectRatio, '9:16');
  assert.equal(config.resolution, '4k');
  assert.deepEqual(config.lastFrame, lastFrame);
});

test('lastFrame is omitted when the scene is not a real state transition', () => {
  const lastFrame = { imageBytes: 'ZmFrZQ==', mimeType: 'image/jpeg' };
  // isStateTransition=false must never attach lastFrame even if one is passed.
  const config = buildGeminiVideoConfig('16:9', '1080p', false, lastFrame);
  assert.equal('lastFrame' in config, false);
});

test('Gemini video source supports direct text-to-video when Custom Idea has no photos', () => {
  assert.deepEqual(buildGeminiVideoSource('A cinematic coffee shop morning'), {
    prompt: 'A cinematic coffee shop morning',
  });
});

test('Gemini video source preserves image guidance when a reference photo is supplied', () => {
  const image = { imageBytes: 'ZmFrZQ==', mimeType: 'image/jpeg' };
  assert.deepEqual(buildGeminiVideoSource('Keep this product recognizable', image), {
    prompt: 'Keep this product recognizable',
    image,
  });
});

test('Gemini video config supports up to three Veo asset reference images for Custom/Scenario scenes', () => {
  const refs = [
    { imageBytes: 'b25l', mimeType: 'image/jpeg' },
    { imageBytes: 'dHdv', mimeType: 'image/jpeg' },
    { imageBytes: 'dGhyZWU=', mimeType: 'image/jpeg' },
    { imageBytes: 'Zm91cg==', mimeType: 'image/jpeg' },
  ];
  const config = buildGeminiVideoConfig('9:16', '1080p', false, undefined, refs);
  assert.deepEqual(config.referenceImages, refs.slice(0, 3).map((image) => ({ image, referenceType: 'asset' })));
  assert.equal('lastFrame' in config, false);
});



test('continuous Veo base config never includes unsupported negativePrompt or other rejected fields', () => {
  const refs = [{ image: { imageBytes: 'ZmFrZQ==', mimeType: 'image/jpeg' }, referenceType: 'asset' as const }];
  const config = buildContinuousBaseVideoConfig('9:16', '720p', refs);
  for (const field of FORBIDDEN_FIELDS) {
    assert.equal(field in config, false, `continuous config must not include '${field}'`);
  }
  assert.equal(config.resolution, '720p');
  assert.deepEqual(config.referenceImages, refs);
});
test('native-resolution quality gate thresholds prevent fake 720p upscales', async () => {
  const { minimumProviderShortEdge } = await import('../src/lib/veo.js');
  assert.equal(minimumProviderShortEdge('1080p'), 1080);
  assert.equal(minimumProviderShortEdge('4k'), 2160);
});


test('Gemini video source uses the new source object for video continuation', () => {
  const video = { uri: 'files/example-video' };
  assert.deepEqual(buildGeminiVideoSource('Continue the same film', undefined, video), {
    prompt: 'Continue the same film',
    video,
  });
});
