import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSISTANT_SYSTEM,
  createTurnLimiter,
  normalizeAssistantTurn,
  planIsStartable,
  safeWebAddress,
  sanitizeContext,
  sanitizeMessages,
  type AssistantContext,
} from '../src/lib/assistant.js';

const context = (patch: Partial<AssistantContext> = {}): AssistantContext => ({ feature: 'website', link: '', photos: 0, hasDrawing: false, signedIn: false, ...patch });

test('a clear request becomes a plan that starts, with every setting inside its limits', () => {
  const turn = normalizeAssistantTurn({
    understood: true, start: true, feature: 'website', url: 'mystore.com', prompt: 'A fast vertical promo of the store.',
    durationSeconds: 500, aspectRatio: '4:3', outputQuality: '8k', audioMode: 'voice_music', narrationLanguage: 'ar',
    websiteStyle: 'nonsense', reply: 'A 16-second promo for mystore.com. Reading the site now.', thinking: ['Website link found', 'Arabic voice-over'],
    suggestions: ['Make it longer'],
  }, context());
  assert.equal(turn.start, true);
  assert.equal(turn.plan?.url, 'https://mystore.com/');
  assert.equal(turn.plan?.durationSeconds, 60);          // clamped
  assert.equal(turn.plan?.aspectRatio, '9:16');           // unknown value falls back
  assert.equal(turn.plan?.outputQuality, '1080p');
  assert.equal(turn.plan?.websiteStyle, 'auto');
  assert.equal(turn.plan?.narrationLanguage, 'ar');
  assert.deepEqual(turn.suggestions, []);                 // nothing to tap once it starts
});

test('the assistant cannot start what the page could not start', () => {
  // says "start" but there is no address and no photos
  const website = normalizeAssistantTurn({ understood: true, start: true, feature: 'website', prompt: 'promo', reply: 'ok', thinking: [] }, context());
  assert.equal(website.start, false);
  // a room redesign needs a photo, a plan or a drawing
  const room = normalizeAssistantTurn({ understood: true, start: true, feature: 'interior', prompt: 'modern living room', reply: 'ok', thinking: [] }, context());
  assert.equal(room.start, false);
  assert.equal(planIsStartable(room.plan!, context({ photos: 1 })), true);
  assert.equal(planIsStartable(room.plan!, context({ hasDrawing: true })), true);
});

test('what is already on the page is used: an attached link or photo is never asked for again', () => {
  const product = normalizeAssistantTurn({ understood: true, start: true, feature: 'product-video', prompt: 'Slow premium reveal.', reply: 'ok', thinking: [] }, context({ link: 'https://shop.example.com/products/shoe' }));
  assert.equal(product.plan?.productUrl, 'https://shop.example.com/products/shoe');
  assert.equal(product.start, true);
  const photos = normalizeAssistantTurn({ understood: true, start: true, feature: 'photo', prompt: 'Studio photos.', audioMode: 'voice_music', reply: 'ok', thinking: [] }, context({ photos: 2 }));
  assert.equal(photos.start, true);
  assert.equal(photos.plan?.audioMode, 'silent');         // photos have no sound, whatever the model said
  assert.equal(photos.plan?.aspectRatio, '1:1');
});

test('small talk and unrelated requests produce an answer but never a plan', () => {
  const turn = normalizeAssistantTurn({ understood: false, start: true, feature: 'video', prompt: 'x', reply: 'I make videos and images from links.', thinking: [], suggestions: ['Video from my website', 'Product photos', 'a', 'b'] }, context());
  assert.equal(turn.plan, null);
  assert.equal(turn.start, false);
  assert.equal(turn.suggestions.length, 3);
  // garbage from the model is still a safe turn
  for (const raw of [null, 'text', 42, [], { reply: 7 }]) {
    const safe = normalizeAssistantTurn(raw, context());
    assert.equal(safe.plan, null);
    assert.equal(safe.start, false);
    assert.ok(safe.reply.length > 0);
  }
});

test('only real web addresses pass; scripts, data and local paths are dropped', () => {
  assert.equal(safeWebAddress('mystore.com/sale'), 'https://mystore.com/sale');
  assert.equal(safeWebAddress('https://a.example.com'), 'https://a.example.com/');
  for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'localhost', 'not a link', '', null, 12]) {
    assert.equal(safeWebAddress(bad), '', String(bad));
  }
});

test('what the browser sends is cut to size, and the conversation always ends with the person', () => {
  const many = Array.from({ length: 40 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', text: `message ${index}` }));
  const kept = sanitizeMessages(many);
  assert.ok(kept.length <= 12);
  assert.equal(kept[kept.length - 1].role, 'user');
  assert.equal(sanitizeMessages([{ role: 'user', text: 'x'.repeat(9000) }])[0].text.length, 2000);
  assert.deepEqual(sanitizeMessages('nope'), []);
  assert.deepEqual(sanitizeMessages([{ role: 'system', text: '   ' }]), []);
  const cleaned = sanitizeContext({ feature: 'admin', link: 'javascript:1', photos: 999, hasDrawing: 'yes' }, true);
  assert.deepEqual(cleaned, { feature: 'website', link: '', photos: 10, hasDrawing: false, signedIn: true });
});

test('turns are limited per person and the limit resets after its window', () => {
  const allow = createTurnLimiter(3, 1000);
  assert.deepEqual([allow('a', 0), allow('a', 1), allow('a', 2), allow('a', 3)], [true, true, true, false]);
  assert.equal(allow('b', 3), true);                      // someone else is not affected
  assert.equal(allow('a', 1001), true);                   // a new window
});

test('the assistant speaks as Linkreel, never quotes prices, and stays on its job', () => {
  assert.match(ASSISTANT_SYSTEM, /never mention Google, Gemini, Veo/);
  assert.match(ASSISTANT_SYSTEM, /Never state prices or credit amounts/);
  assert.match(ASSISTANT_SYSTEM, /Do not answer the unrelated question/);
  assert.match(ASSISTANT_SYSTEM, /Never invent facts about a business/);
});
