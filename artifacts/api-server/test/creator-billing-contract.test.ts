import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { creationScope } from '../src/lib/entitlements.js';

const source = (path: string) => readFile(new URL(path,import.meta.url),'utf8');

test('only matching creation settings can redeem a scoped pass', () => {
  assert.deepEqual(creationScope({studioKind:'product',mode:'photos',modelId:'graphic-2',
    durationSeconds:8,outputQuality:'1080p',audioMode:'silent'}),{
    feature:'product-photo',modelId:'graphic-2',durationSeconds:undefined,
    quality:'1080p',audioMode:'silent',
  });
  assert.equal(creationScope({studioKind:'product',mode:'video',modelId:'cinema-2',
    durationSeconds:8,outputQuality:'4k',audioMode:'native_audio'}),null);
  assert.equal(creationScope({studioKind:null,mode:'video',modelId:'cinema-2',
    durationSeconds:8,outputQuality:'1080p',audioMode:'voice_music'}),null);
});

test('starter allowance is separate from the production reservation', async () => {
  const growth = await source('../src/routes/growth.ts');
  const capture = await source('../src/routes/capture.ts');
  const starter = await source('../src/lib/starter-capture.ts');
  const reservations = await source('../src/lib/queries-base.ts');
  assert.match(growth,/email_verified=TRUE/);
  assert.match(growth,/starter_identity_grants/);
  assert.doesNotMatch(growth,/grantCreditsOnce/);
  assert.match(capture,/router\.post\('\/', requireAuth/);
  assert.match(capture,/reserveCapture\(job\.id, userId\)/);
  assert.match(capture,/settleCapture\(job\.id, true\)/);
  assert.match(capture,/settleCapture\(job\.id, false\)/);
  assert.match(starter,/starter_credits_balance=starter_credits_balance-\$1/);
  assert.match(starter,/WHERE job_id=\$1 FOR UPDATE/);
  assert.match(reservations,/credits_balance >= \$1/);
  assert.doesNotMatch(reservations,/starter_credits_balance/);
});

test('entitlement and starter migrations preserve old balances and revoke refunds', async () => {
  const migration = await source('../db/creator-billing.sql');
  assert.match(migration,/one_time_generation_entitlements/);
  assert.match(migration,/one_time_entitlement_redemptions/);
  assert.match(migration,/payment_id UUID NOT NULL UNIQUE/);
  assert.match(migration,/aiwebvideo_revoke_refunded_entitlement/);
  assert.match(migration,/NOT EXISTS\(SELECT 1 FROM payments p WHERE p.user_id=u.id AND p.status='paid'\)/);
  assert.match(migration,/paypal_runtime_legacy/);
});

test('legacy subscriptions retain their original renewal mapping and scoped receipts name the purchase', async () => {
  const paypal = await source('../src/routes/paypal.ts');
  const mailer = await source('../src/lib/mailer.ts');
  const user = await source('../src/routes/user.ts');
  assert.match(paypal,/paypal_runtime_legacy/);
  assert.match(paypal,/creator: \{ amountUsd: 39, credits: 150 \}/);
  assert.match(paypal,/verifySubscriptionSaleAmount\(resource, matched\.product\.amountUsd\)/);
  assert.match(mailer,/purchaseName\?: string/);
  assert.match(user,/starterCreditsBalance: growth\?\.starterBalanceDisplay \?\? 0/);
});
