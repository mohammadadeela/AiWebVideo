import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isPlannedBilling, plannedBillingFrom, plannedRenderCost } from '../src/lib/job-billing.js';

const src = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');
const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('the frozen price: render charges exactly what planning reserved', () => {
  const planned = plannedBillingFrom({ totalCredits: 22, narrationCredits: 6, narrationIncluded: false });
  assert.equal(isPlannedBilling(planned), true);
  assert.equal(plannedRenderCost(planned, false), 22);          // unchanged: never asks for more
});

test('only AI narration can move a frozen price, in either direction', () => {
  const withoutVoice = plannedBillingFrom({ totalCredits: 16, narrationCredits: 6, narrationIncluded: false });
  assert.equal(plannedRenderCost(withoutVoice, true), 22);       // narration added after planning
  const withVoice = plannedBillingFrom({ totalCredits: 22, narrationCredits: 6, narrationIncluded: true });
  assert.equal(plannedRenderCost(withVoice, true), 22);
  assert.equal(plannedRenderCost(withVoice, false), 16);         // narration dropped: the excess is refunded
});

test('a photo set has no narration add-on and never changes price', () => {
  const photos = plannedBillingFrom({ totalCredits: 4, narrationCredits: 0, narrationIncluded: true });
  assert.equal(photos.narrationIncluded, false);
  assert.equal(plannedRenderCost(photos, true), 4);
  assert.equal(plannedRenderCost(photos, false), 4);
});

test('anything that is not a real frozen price is ignored and the old calculation applies', () => {
  for (const bad of [null, undefined, {}, { reservedCredits: 0, narrationCredits: 6, narrationIncluded: false }, { reservedCredits: 'x' }]) {
    assert.equal(isPlannedBilling(bad), false);
  }
});

test('planning freezes the price right after reserving, and render and quote both read it', async () => {
  const jobs = await src('routes/jobs.ts');
  assert.match(jobs, /plannedBillingFrom\(\{\s*totalCredits: planningQuote\.totalCredits/);
  assert.match(jobs, /meta = \{ \.\.\.meta, planning: planningBilling \}/);
  assert.match(jobs, /plannedRenderCost\(frozenBilling, !skipVoiceover\)/);
  assert.match(jobs, /quote\.totalCredits = plannedRenderCost\(quoteMeta!\.planning!/);
});

test('no paid AI work can start before its credits are reserved or claimed', async () => {
  const jobs = await src('routes/jobs.ts');
  const at = (needle: string) => { const i = jobs.indexOf(needle); assert.ok(i > 0, `${needle} missing`); return i; };
  // planning: credits are checked and reserved before the planner (a paid model call) runs
  assert.ok(at('INSUFFICIENT_CREDITS') < at('await generateStoryboard('));
  assert.ok(at('await reserveGenerationCredits(') < at('await generateStoryboard('));
  // render: the atomic claim happens before ANY voice, icon, image or video provider call
  const claim = at('await claimRenderAndSpend(');
  for (const call of ['generateVoiceoverScript(', 'generateWebsiteIcon(', 'generateMarketingPhoto(', 'generateMarketingVideo(']) {
    assert.ok(claim < at(call), `${call} must come after the credit claim`);
  }
});

test('only the routes reviewed for credit gating may call a paid provider', async () => {
  const dir = path.resolve(process.cwd(), 'src/routes');
  const callers: string[] = [];
  for (const name of await readdir(dir)) {
    if (!name.endsWith('.ts')) continue;
    const text = await readFile(path.join(dir, name), 'utf8');
    if (/generateStoryboard\(|generateMarketingPhoto\(|generateMarketingVideo\(|generateWebsiteIcon\(|generateVoiceoverScript\(|ai\.models\.generate/.test(text)) callers.push(name);
  }
  // jobs.ts: reserve-then-plan and claim-then-render (checked above). A new route that calls a provider must be
  // added here deliberately, after adding its own credit gate.
  // assistant.ts: the one free call. It is a short text answer (no image, video or voice), so instead of a credit
  // gate it has its own limits, checked below.
  assert.deepEqual(callers.sort(), ['assistant.ts', 'jobs.ts']);
});

test('the free assistant is limited per person, capped in size, and cannot start paid work itself', async () => {
  const assistant = await src('routes/assistant.ts');
  // every turn passes a limiter before the model is called: per account, or per address and per day for visitors
  const call = assistant.indexOf('ai.models.generateContent(');
  assert.ok(assistant.indexOf('allowAccount(`user:${req.user.id}`)') > 0 && assistant.indexOf('allowAccount(') < call);
  assert.ok(assistant.indexOf('allowVisitor(`ip:${address}`) && allowVisitorDaily(`ip:${address}`)') > 0);
  assert.match(assistant, /ASSISTANT_RATE_LIMITED/);
  // what is sent to the model and what comes back are both bounded
  assert.ok(assistant.indexOf('sanitizeMessages(') < call);
  assert.match(assistant, /maxOutputTokens: \d+/);
  assert.match(assistant, /abortSignal: AbortSignal\.timeout\(TURN_TIMEOUT_MS\)/);
  // it only returns a checked plan: no generation, no credits, no database
  assert.match(assistant, /res\.json\(normalizeAssistantTurn\(parsed, context\)\)/);
  assert.doesNotMatch(assistant, /generateStoryboard|generateMarketing|generateVideos|grantCredits|credits_balance|query\(/);
  // the site owner can switch it off without a deploy
  assert.match(assistant, /process\.env\.ASSISTANT_ENABLED === 'false'/);
});

test('studio AI edits reserve credits atomically before the provider runs', async () => {
  const studio = await src('routes/studio.ts');
  assert.match(studio, /UPDATE users SET credits_balance=credits_balance-\$2,updated_at=NOW\(\) WHERE id=\$1 AND credits_balance/);
  assert.match(studio, /code === 'INSUFFICIENT_CREDITS' \? 402/);
});

test('after a plan exists, a signed-in person is never asked to press Generate a second time', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.doesNotMatch(widget, /Review the plan once, then start the final generation when you are ready/);
  assert.match(widget, /a signed-in plan always continues straight into the final generation/);
});

test('after a finished production the chat checks credits in the browser and the server refuses without them', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /const canStartPaidPlanning = await ensureCreditsBeforePaidPlanning\(/);
  assert.match(widget, /if \(!canStartPaidPlanning\) return;/);
});
