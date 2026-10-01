import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseOptions, orderOptions, pickBestFit, pickBestPerGroup } from '../../aiwebvideo/src/lib/purchaseOptions.js';
import { estimateRenderCredits } from '../../aiwebvideo/src/lib/credits.js';

const keysOf = (options: Array<{ key: string }>) => options.map((option) => option.key);
const inGroup = (options: ReturnType<typeof buildPurchaseOptions>, group: string) => options.filter((option) => option.group === group);

test('every pack and plan is always listed, whatever the job needs (nothing is filtered away)', () => {
  for (const required of [0, 20, 110, 150, 1800]) {
    const options = buildPurchaseOptions({ funded: 25, required, offer: null, includeVideoPacks: true });
    assert.equal(inGroup(options, 'video').length, 3, `video packs @${required}`);
    assert.equal(inGroup(options, 'credits').length, 3, `credit packs @${required}`);
    assert.equal(inGroup(options, 'plans').length, 3, `plans @${required}`);
  }
  // a photo set simply leaves the one-video packs out
  const photos = buildPurchaseOptions({ funded: 0, required: 20, offer: null, includeVideoPacks: false });
  assert.equal(inGroup(photos, 'video').length, 0);
});

test('new user with 25 credits and an 8s narrated Cinema 2 video: best fit leads every list', () => {
  const required = estimateRenderCredits('video', false, 8, '1080p', 'cinema-2');
  assert.equal(required, 110);
  const options = buildPurchaseOptions({ funded: 25, required, offer: null, includeVideoPacks: true });
  const best = pickBestPerGroup(options, required);
  assert.equal(best.video, 'single8');      // $5.99, covers it exactly
  assert.equal(best.credits, 'topup100');   // 265 credits; the 70-credit pack leaves the person short
  assert.equal(best.plans, 'creator');      // cheapest plan that covers it
  assert.equal(pickBestFit(options, required), 'single8');  // cheapest one-time purchase overall

  const creditsList = orderOptions(inGroup(options, 'credits'), best.credits ?? null);
  assert.deepEqual(keysOf(creditsList), ['topup100', 'topup250', 'topup50']);
  const short = creditsList.find((option) => option.key === 'topup50')!;
  assert.equal(short.covers, false);
  assert.equal(short.shortBy, 15);          // 25 + 70 = 95 of 110
});

test('a 4K video: the small one-video pack no longer fits, so a bigger one leads instead of an empty tab', () => {
  const required = estimateRenderCredits('video', false, 8, '4k', 'cinema-2');
  const options = buildPurchaseOptions({ funded: 25, required, offer: null, includeVideoPacks: true });
  const videoList = orderOptions(inGroup(options, 'video'), pickBestPerGroup(options, required).video ?? null);
  assert.deepEqual(keysOf(videoList), ['single48', 'single144', 'single8']);
  assert.equal(videoList.at(-1)?.covers, false);
});

test('when nothing in a list can cover the job alone, the closest (largest) option leads', () => {
  const required = estimateRenderCredits('video', true, 60, '4k', 'cinema-pro');
  const options = buildPurchaseOptions({ funded: 0, required, offer: null, includeVideoPacks: true });
  const best = pickBestPerGroup(options, required);
  assert.equal(inGroup(options, 'video').some((option) => option.covers), false);
  assert.equal(best.video, 'single144');
  assert.equal(best.credits, 'topup250');
  assert.equal(options.find((option) => option.key === best.video)?.covers, false);
  assert.equal(options.find((option) => option.key === best.plans)?.covers, true);
  assert.equal(pickBestFit(options, required), 'pro');   // only plans cover it: the cheapest one
});

test('browsing from the profile (nothing required) marks nothing and keeps the natural order', () => {
  const options = buildPurchaseOptions({ funded: 340, required: 0, offer: null, includeVideoPacks: true });
  assert.deepEqual(pickBestPerGroup(options, 0), {});
  assert.equal(pickBestFit(options, 0), null);
  const credits = orderOptions(inGroup(options, 'credits'), null);
  assert.deepEqual(keysOf(credits), ['topup50', 'topup100', 'topup250']);
  assert.ok(options.every((option) => option.covers && option.shortBy === 0));
});

test('the welcome discount lowers the eligible credit packs and the ranking uses the discounted price', () => {
  const offer = { discountPercent: 20, eligibleProducts: ['topup50', 'topup100', 'topup250'] as const };
  const options = buildPurchaseOptions({ funded: 25, required: 150, offer, includeVideoPacks: true });
  const pack = options.find((option) => option.key === 'topup100')!;
  assert.equal(pack.originalAmountUsd, 14.99);
  assert.equal(pack.amountUsd, 11.99);
  // video packs and plans are never discounted
  assert.equal(options.find((option) => option.key === 'single48')!.amountUsd, 27.99);
  assert.equal(options.find((option) => option.key === 'pro')!.amountUsd, 99);
  assert.equal(pickBestFit(options, 150), 'topup100');
});
