import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREATIVE_IDEAS, composeIdeaText, getIdeasForIntent, splitIdeaText, type IdeaIntent } from '../../aiwebvideo/src/lib/creativeIdeas.js';
import { inferProjectScope } from '../src/lib/studio-direction.js';

const all = Object.values(CREATIVE_IDEAS).flat();
const words = (text: string) => new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 4));
const overlap = (a: Set<string>, b: Set<string>) => { let shared = 0; for (const word of a) if (b.has(word)) shared += 1; return shared / (a.size + b.size - shared); };

test('every feature has its own curated set of ideas people will actually use', () => {
  const minimum = { ai_video: 12, product_images: 12, product_video: 12, web_video: 12, scenario: 12, interior_design: 14, architecture: 14 } as const;
  for (const [feature, count] of Object.entries(minimum)) {
    const list = CREATIVE_IDEAS[feature as keyof typeof CREATIVE_IDEAS];
    assert.ok(list.length >= count, `${feature} has ${list.length}, needs at least ${count}`);
    assert.ok(list.every((idea) => idea.feature === feature), `${feature}: every idea belongs to it`);
  }
  const ids = all.map((idea) => idea.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique across every feature: ' + ids.filter((id, i) => ids.indexOf(id) !== i).join(', '));
});

test('no two ideas have the same title, and no two share a prompt', () => {
  const titles = all.map((idea) => idea.displayText.trim().toLowerCase());
  assert.equal(new Set(titles).size, titles.length, 'duplicate titles: ' + titles.filter((t, i) => titles.indexOf(t) !== i).join(' | '));
  const prompts = all.map((idea) => idea.prompt);
  assert.equal(new Set(prompts).size, prompts.length);
});

test('every idea is a complete master prompt: specific, readable, safe to show, and different from the others', () => {
  for (const idea of all) {
    const label = `${idea.feature}/${idea.id}`;
    assert.ok(idea.prompt.length >= 380 && idea.prompt.length <= 1100, `${label} prompt is ${idea.prompt.length} characters`);
    assert.ok(idea.prompt.split(/\s+/).length >= 60, `${label} needs at least 60 words`);
    assert.ok(idea.displayText.trim().length >= 18 && idea.displayText.trim().length <= 72, `${label} title length`);
    assert.ok(idea.category.trim().length >= 2);
    assert.ok(idea.guardrail.trim().length >= 80, `${label} keeps its feature's safety text`);
    // the box shows the prompt to the customer: no template leftovers, no internal wording, no brackets to fill in
    assert.doesNotMatch(idea.prompt, /[\[\]{}<>]|TODO|lorem|undefined|\$\{|AIWEBVIDEO|supplied reference images are|You are /i, `${label} has template leftovers`);
    assert.match(idea.prompt, /[.]$/, `${label} ends as a sentence`);
    assert.ok(idea.tags.every((tag) => tag.trim().length > 1));
  }
  const sets = all.map((idea) => ({ idea, set: words(idea.prompt) }));
  for (let a = 0; a < sets.length; a += 1) for (let b = a + 1; b < sets.length; b += 1) {
    const similarity = overlap(sets[a].set, sets[b].set);
    assert.ok(similarity < 0.5, `${sets[a].idea.feature}/${sets[a].idea.id} and ${sets[b].idea.feature}/${sets[b].idea.id} say almost the same thing (${similarity.toFixed(2)})`);
  }
});

test('the hidden safety text is only about accuracy and never repeats the idea itself', () => {
  for (const idea of all) assert.ok(!idea.guardrail.includes(idea.prompt.slice(0, 60)), `${idea.id}`);
  const byFeature = new Map<string, Set<string>>();
  for (const idea of all) byFeature.set(idea.feature, (byFeature.get(idea.feature) ?? new Set()).add(idea.guardrail));
  for (const [feature, set] of byFeature) assert.equal(set.size, 1, `${feature} uses one shared safety text`);
});

test('still photos and films are directed differently (the same concept is not reused for both)', () => {
  const photoDirections = CREATIVE_IDEAS.product_images.map((idea) => idea.displayText.toLowerCase());
  const filmDirections = CREATIVE_IDEAS.product_video.map((idea) => idea.displayText.toLowerCase());
  assert.deepEqual(photoDirections.filter((text) => filmDirections.includes(text)), []);
});

test('the ideas offered for each feature are relevant to what the person typed', () => {
  const intents: IdeaIntent[] = ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'];
  for (const intent of intents) assert.equal(getIdeasForIntent(intent, {}, 8).length, 8, `${intent} offers a full row of ideas`);
  assert.equal(getIdeasForIntent('architecture', { prompt: 'make me a clothes shop here' }, 3)[0].id, 'shop-fit-out');
  assert.ok(getIdeasForIntent('interior', { prompt: 'design a clothes boutique' }, 3).some((idea) => idea.id === 'boutique-store'));
  assert.ok(getIdeasForIntent('architecture', { prompt: 'a hotel for tourists' }, 4).some((idea) => idea.id === 'boutique-hotel'));
  assert.ok(getIdeasForIntent('website', { websiteUrl: 'https://my-restaurant.com/menu' }, 3).some((idea) => idea.id === 'restaurant-menu'));
  assert.ok(getIdeasForIntent('website', { websiteUrl: 'https://my-store.com/shop' }, 3).some((idea) => idea.id === 'ecom-shopping'));
  assert.ok(getIdeasForIntent('photo', { prompt: 'a ramadan gift box' }, 3).some((idea) => idea.id === 'seasonal-campaign'));
});

test('the best ideas for each feature come first when nothing has been typed', () => {
  const firsts = Object.fromEntries((['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture'] as IdeaIntent[]).map((intent) => [intent, getIdeasForIntent(intent, {}, 1)[0].id]));
  assert.deepEqual(firsts, { website: 'launch-trailer', video: 'brand-intro', photo: 'marketplace-white', 'product-video': 'luxury-360', scenario: 'founder-explains', interior: 'boutique-store', architecture: 'site-concept' });
  // Interior needs the customer's own space: once photos are attached, redesigning that exact space comes first
  assert.equal(getIdeasForIntent('interior', { hasReferences: true }, 1)[0].id, 'existing-space-redesign');
  assert.equal(getIdeasForIntent('photo', { hasReferences: true }, 1)[0].id, 'marketplace-white');
});

test('choosing an idea puts its full master prompt in the box, keeps the person\'s own words, and sends only the safety text hidden', async () => {
  const idea = CREATIVE_IDEAS.product_images[0];
  assert.equal(composeIdeaText(idea), idea.prompt);
  const mixed = composeIdeaText(idea, 'It is a 30 ml serum bottle, gold cap.');
  assert.equal(mixed, `${idea.prompt}\n\nMy details: It is a 30 ml serum bottle, gold cap.`);
  assert.deepEqual(splitIdeaText(mixed), { idea, details: 'It is a 30 ml serum bottle, gold cap.' });
  assert.deepEqual(splitIdeaText(idea.prompt), { idea, details: '' });
  assert.deepEqual(splitIdeaText('just my own words'), { idea: null, details: 'just my own words' });
  // changing idea replaces the old master prompt but keeps what the person wrote
  const other = CREATIVE_IDEAS.product_images[1];
  assert.equal(composeIdeaText(other, splitIdeaText(mixed).details), `${other.prompt}\n\nMy details: It is a 30 ml serum bottle, gold cap.`);
  // an edited master prompt is the person's own text now and is never thrown away
  assert.equal(splitIdeaText(idea.prompt + ' Make it blue.').idea, null);

  const form = await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/components/chat/WebsiteBriefForm.tsx'), 'utf8');
  assert.match(form, /const text = composeIdeaText\(idea, own\);/);
  assert.match(form, /setPrompt\(text\)/);
  assert.match(form, /setBrief\(text\)/);
  assert.match(form, /studioDirection: selectedIdea \? selectedIdea\.guardrail : undefined/);
  assert.match(form, /withHiddenDirection\(brief\.trim\(\), selectedIdea\?\.guardrail\)/);
  assert.doesNotMatch(form, /selectedIdea\??\.masterPrompt/);
});

// What the studio makes depends on keywords in the customer's words (see inferProjectScope), so a master prompt written into the box must
// steer an Architecture idea to the right kind of project, and must never send an Interior idea to a street view or a landscape.
test('every Architecture idea is read as the project it is about', () => {
  const expected: Record<string, string> = {
    'site-concept': 'new_building', 'family-villa': 'new_building', 'apartment-block': 'new_building', 'mixed-use': 'new_building', 'office-building': 'new_building',
    'boutique-hotel': 'new_building', 'day-and-dusk': 'new_building', 'plot-before-after': 'new_building', 'drone-reveal': 'new_building',
    'shop-fit-out': 'fit_out_interior', 'shopfront': 'storefront_exterior', 'facade-renovation': 'facade_retrofit', 'add-floors': 'extension', 'site-landscape': 'landscape',
  };
  for (const idea of CREATIVE_IDEAS.architecture) {
    assert.ok(expected[idea.id], `${idea.id} has an expected project type`);
    assert.equal(inferProjectScope(idea.prompt), expected[idea.id], `${idea.id}`);
  }
  assert.equal(Object.keys(expected).length, CREATIVE_IDEAS.architecture.length);
});

test('no Interior idea is read as a street view, a facade, an extension or a landscape', () => {
  for (const idea of CREATIVE_IDEAS.interior_design) {
    const scope = inferProjectScope(idea.prompt);
    assert.ok(scope === 'fit_out_interior' || scope === 'new_building', `${idea.id} is read as ${scope}`);
  }
});
