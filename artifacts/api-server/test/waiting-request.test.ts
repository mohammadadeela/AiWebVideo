import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  HANDOFF_AUTOSTART_MAX_AGE_MS,
  HANDOFF_MAX_AGE_MS,
  isHandoffFresh,
} from '../../aiwebvideo/src/lib/publicCreatorHandoff.js';
import { advanceStar, createField, createStar } from '../../aiwebvideo/src/lib/warpField.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('a waiting request starts by itself only while fresh; older ones are shown again and started by hand', () => {
  const now = 1_000_000_000_000;
  assert.equal(isHandoffFresh({ savedAt: now - 5 * 60 * 1000 }, now), true);
  assert.equal(isHandoffFresh({ savedAt: now - HANDOFF_AUTOSTART_MAX_AGE_MS }, now), true);
  assert.equal(isHandoffFresh({ savedAt: now - HANDOFF_AUTOSTART_MAX_AGE_MS - 1 }, now), false);
  assert.equal(isHandoffFresh(null, now), false);
  assert.ok(HANDOFF_MAX_AGE_MS >= 24 * 60 * 60 * 1000, 'a slow e-mail verification must not lose the request');
  assert.ok(HANDOFF_AUTOSTART_MAX_AGE_MS < HANDOFF_MAX_AGE_MS);
});

test('the waiting-request card shows the prompt, every attachment and the settings, with Start / Add credits / Discard', async () => {
  const card = await fe('components/chat/WaitingRequestCard.tsx');
  assert.match(card, /Your request is ready/);
  assert.match(card, /URL\.createObjectURL\(file\)/);
  assert.match(card, /attachment\{previews\.length === 1 \? "" : "s"\}/);
  assert.match(card, /Start now/);
  assert.match(card, /and start/);
  assert.match(card, /Discard/);
  assert.match(card, /Nothing is charged until the production starts/);
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  // After a checkout the balance can lag the webhook: wait for it instead of showing the paywall again.
  assert.match(widget, /waitForCreditsAfterCheckout\(required\)/);
  // A failed upload keeps the request on screen for one-tap retry.
  assert.match(widget, /if \(!jobIdRef\.current\) \{[\s\S]*?await saveStudioHandoff\(request, waiting\.reason\)/);
});

test('a finished result is anchored at its start while the layout settles and the reader can always take over', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /new MutationObserver\(\(\) => \{\s*if \(begin\(\)\) mutationObserver\?\.disconnect\(\);/);
  assert.match(widget, /resizeObserver = new ResizeObserver\(scheduleSettle\)/);
  assert.match(widget, /"loadedmetadata" : "load", scheduleSettle/);
  assert.match(widget, /window\.addEventListener\("wheel", onReaderMove/);
  assert.match(widget, /window\.addEventListener\("touchmove", onReaderMove/);
  const shell = await fe('components/chat/ChatWidget.tsx');
  // Follow-to-bottom stays off after a finish so late media never carries the view past the result.
  assert.match(shell, /switches back on as soon as the reader themselves reaches the bottom\.\s*autoFollowRef\.current = false;/);
});

test('every page change travels through space: full-sky warp used as the Suspense fallback and on route changes', async () => {
  const app = await fe('App.tsx');
  assert.match(app, /<Suspense fallback=\{<SpaceJumpLoader \/>\}>/);
  assert.match(app, /<SpaceJumpTransition \/>/);
  assert.doesNotMatch(app, /function PageLoader/);
  const loader = await fe('components/system/SpaceJumpLoader.tsx');
  assert.match(loader, /fullSky: true/);
  assert.match(loader, /prefers-reduced-motion: reduce/);
  assert.match(loader, /role="status"/);
  const css = await fe('cinematic-theme.css');
  assert.match(css, /\.space-jump \{/);
  assert.match(css, /\.space-jump-leaving \{/);

  // full-sky stars point in every direction, upper-fan stars still only upward
  let seed = 7;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const sky = createField(400, rand, true);
  assert.ok(sky.some((star) => Math.sin(star.angle) > 0.5), 'some stars fly downward in hyperspace');
  assert.ok(sky.some((star) => Math.sin(star.angle) < -0.5), 'some stars fly upward in hyperspace');
  const fan = createField(400, rand);
  assert.ok(fan.every((star) => Math.sin(star.angle) < 0.15), 'the landing-page fan stays above the horizon');
  const reborn = advanceStar({ ...createStar(rand, 0.04, true), z: 0.04 }, 1, 0.5, rand, true).star;
  assert.equal(reborn.z, 1);
});
