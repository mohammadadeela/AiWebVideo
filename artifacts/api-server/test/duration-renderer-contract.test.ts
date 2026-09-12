import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPremiumScenePlan, premiumSceneOperationCount } from '../src/lib/veo.js';

const sourceScene = {
  sceneNumber: 1,
  durationSeconds: 8,
  sceneType: 'hook' as const,
  shotDescription: 'A complete premium opening shot.',
  sourceIndices: [0],
  composition: 'single' as const,
  motion: 'static' as const,
  focusX: 0.5,
  focusY: 0.5,
  onScreenCopy: '',
  transition: '',
};

test('every supported whole-second duration maps to an exact premium render plan', () => {
  for (let seconds = 8; seconds <= 144; seconds += 1) {
    const plan = buildPremiumScenePlan([sourceScene], seconds, 1, 'video');

    assert.equal(plan.length, Math.ceil(seconds / 8), `${seconds}s operation count`);
    assert.equal(premiumSceneOperationCount(seconds), plan.length, `${seconds}s ETA operation count`);
    assert.equal(
      plan.reduce((total, scene) => total + scene.deliverySeconds, 0),
      seconds,
      `${seconds}s exact delivery total`,
    );
    assert.ok(plan.every((scene) => scene.deliverySeconds >= 1 && scene.deliverySeconds <= 8));
    assert.ok(plan.slice(0, -1).every((scene) => scene.deliverySeconds === 8));
    assert.equal(plan.at(-1)?.deliverySeconds, seconds % 8 || 8, `${seconds}s final trim`);
  }
});

test('maximum 144-second production stays within eighteen native Veo operations', () => {
  const plan = buildPremiumScenePlan([sourceScene], 144, 1, 'video');
  assert.equal(plan.length, 18);
  assert.equal(plan.at(-1)?.sceneType, 'cta');
});
