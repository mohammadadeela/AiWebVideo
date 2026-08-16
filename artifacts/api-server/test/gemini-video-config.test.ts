import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiVideoConfig } from '../src/lib/veo.js';

/**
 * Regression coverage for a real production bug: the Gemini Developer API
 * rejects the `generateAudio` field with "generateAudio parameter is only
 * supported in Gemini Enterprise Agent Platform mode, not in Gemini
 * Developer API mode" — confirmed against live production logs. This is the
 * exact same failure class as the earlier `seed` issue this codebase already
 * guards against. Every scene was failing on Gemini before even reaching
 * Veo, silently falling through to the (much slower) open-source/RunPod
 * fallback every time.
 *
 * This test asserts on the real config object the app sends to
 * @google/genai, not on a description of it, so a future edit that
 * reintroduces either field fails loudly here instead of only showing up as
 * a live 400 error in production logs.
 */

const FORBIDDEN_FIELDS = ['generateAudio', 'seed'];

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
