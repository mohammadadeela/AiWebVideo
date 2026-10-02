import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREATIVE_IDEAS, getIdeasForIntent, type IdeaIntent } from '../../aiwebvideo/src/lib/creativeIdeas.js';

const all = Object.values(CREATIVE_IDEAS).flat();
const directionOf = (idea: { masterPrompt: string }) => idea.masterPrompt.split('\n\n')[0];
const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 4));
const overlap = (a: Set<string>, b: Set<string>) => { let shared = 0; for (const word of a) if (b.has(word)) shared += 1; return shared / (a.size + b.size - shared); };

test('every feature has its own full set of ideas', () => {
  const minimum = { ai_video: 24, product_images: 24, product_video: 24, web_video: 24, scenario: 16, interior_design: 18, architecture: 20 } as const;
  for (const [feature, count] of Object.entries(minimum)) {
    const list = CREATIVE_IDEAS[feature as keyof typeof CREATIVE_IDEAS];
    assert.ok(list.length >= count, `${feature} has ${list.length}, needs at least ${count}`);
    assert.ok(list.every((idea) => idea.feature === feature), `${feature}: every idea belongs to it`);
    assert.equal(new Set(list.map((idea) => idea.id)).size, list.length, `${feature}: ids are unique`);
  }
});

test('no two ideas have the same title, and no two share a direction', () => {
  const titles = all.map((idea) => idea.displayText.trim().toLowerCase());
  assert.equal(new Set(titles).size, titles.length, 'duplicate titles: ' + titles.filter((t, i) => titles.indexOf(t) !== i).join(' | '));
  const directions = all.map(directionOf);
  assert.equal(new Set(directions).size, directions.length);
});

test('every master prompt carries real direction plus its feature\'s safety text, and the directions are genuinely different from each other', () => {
  for (const idea of all) {
    assert.match(idea.masterPrompt, /\n\n/, `${idea.id} keeps the guardrail after its own direction`);
    assert.ok(directionOf(idea).length >= 190, `${idea.feature}/${idea.id} direction is only ${directionOf(idea).length} characters`);
    assert.ok(idea.category.trim().length >= 2 && idea.displayText.trim().length > 12);
  }
  const sets = all.map((idea) => ({ idea, set: words(directionOf(idea)) }));
  for (let a = 0; a < sets.length; a += 1) for (let b = a + 1; b < sets.length; b += 1) {
    const similarity = overlap(sets[a].set, sets[b].set);
    assert.ok(similarity < 0.5, `${sets[a].idea.feature}/${sets[a].idea.id} and ${sets[b].idea.feature}/${sets[b].idea.id} say almost the same thing (${similarity.toFixed(2)})`);
  }
});

test('still photos and films are directed differently (the same concept is not reused for both)', () => {
  const photoDirections = CREATIVE_IDEAS.product_images.map((idea) => idea.displayText.toLowerCase());
  const filmDirections = CREATIVE_IDEAS.product_video.map((idea) => idea.displayText.toLowerCase());
  assert.deepEqual(photoDirections.filter((text) => filmDirections.includes(text)), []);
});

test('the ideas offered for each feature are relevant to what the person typed', () => {
  const intents: IdeaIntent[] = ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'];
  for (const intent of intents) assert.ok(getIdeasForIntent(intent, {}, 8).length === 8, `${intent} offers a full row of ideas`);
  assert.equal(getIdeasForIntent('architecture', { prompt: 'make me a clothes shop here' }, 3)[0].id, 'shop-fit-out');
  assert.ok(getIdeasForIntent('interior', { prompt: 'design a clothes boutique' }, 3).some((idea) => idea.id === 'boutique-store'));
  assert.ok(getIdeasForIntent('architecture', { prompt: 'a hotel for tourists' }, 4).some((idea) => idea.id === 'boutique-hotel'));
});

test('an idea\'s master prompt is applied as hidden direction in every feature, never typed into the box', async () => {
  const form = await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/components/chat/WebsiteBriefForm.tsx'), 'utf8');
  assert.match(form, /studioDirection: selectedIdea \? selectedIdea\.masterPrompt : undefined/);
  assert.match(form, /withHiddenDirection\(brief\.trim\(\), selectedIdea\?\.masterPrompt\)/);
  assert.match(form, /setBrief\(idea\.displayText\)/);
  assert.doesNotMatch(form, /setBrief\(idea\.masterPrompt\)/);
});
