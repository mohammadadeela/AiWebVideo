import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('every page has one designed background: deep glows, a sparse still starfield, no grid; panels stay solid on top', async () => {
  const css = await fe('cinematic-theme.css');
  assert.match(css, /:root \{ --site-base: #06040f; \}/);
  assert.match(css, /body \{[^}]*background-color: var\(--site-base\);[^}]*radial-gradient\([^}]*radial-gradient\([^}]*radial-gradient\(/s);
  assert.match(css, /body::before \{[^}]*position: fixed;[^}]*pointer-events: none;[^}]*data:image\/svg\+xml/s);
  assert.match(css, /\.cinematic-page\.bg-bg \{ background-color: transparent; \}/);
  assert.match(css, /\.hero-mesh \{\s*background-image: radial-gradient\(ellipse/);                       // the old 62px grid pattern is replaced by a soft glow
  assert.doesNotMatch(css, /62px/);
  // the landing picture fades into this background instead of ending in a hard edge
  assert.match(css, /\.cinematic-hero::after \{[^}]*linear-gradient\(180deg, transparent, var\(--site-base\)\)/s);
});

test('the landing page is lean: no buzzword strip, no fake interface, no "quality system", no uppercase labels', async () => {
  const home = await fe('pages/HomePage.tsx');
  for (const gone of ['Product advantages', 'No template workflow', 'Interface preview', 'A workspace, not another landing page', 'Quality system', 'Where it fits', 'Campaign intent, not rigid templates', 'Bring the source. AiWebVideo directs the campaign', 'Configure creator', 'Start with what you have']) {
    assert.ok(!home.includes(gone), `"${gone}" must stay removed`);
  }
  assert.doesNotMatch(home, /font-utility[^"']*uppercase/);
  for (const kept of ['What you can make', 'How it works', 'Know the cost before generation.', 'See plans and top-ups', 'Questions', 'Ready to make yours?']) assert.ok(home.includes(kept), kept);
  assert.ok(home.split('\n').length < 170, 'the landing page stays short');
});

test('decorative uppercase micro-labels and badges are gone from the marketing and content pages', async () => {
  for (const file of ['pages/HomePage.tsx', 'pages/PricingPage.tsx', 'pages/ContentPages.tsx', 'pages/GuidesPage.tsx', 'pages/SearchLandingPages.tsx', 'pages/StudioPage.tsx', 'components/landing/Footer.tsx', 'components/landing/StudioShowcase.tsx', 'components/studio/StudioToolCards.tsx']) {
    assert.doesNotMatch(await fe(file), /font-utility[^"'`]*uppercase|uppercase[^"'`]*font-utility/, `${file} has no uppercase mono label`);
  }
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.doesNotMatch(form, /\{idea\.category\}/);                                  // no tiny category tag on idea cards
  assert.doesNotMatch(form, />Required</);
  const strip = await fe('components/chat/SampleStrip.tsx');
  assert.doesNotMatch(strip, /Start from an example, then add your own photos|example\$\{all\.length/);
  const footer = await fe('components/landing/Footer.tsx');
  assert.doesNotMatch(footer, /AI-directed|Built for original AI production/);
});

test('the pricing blocks keep their text exactly; only the page around them was cleaned', async () => {
  const table = await fe('components/landing/PricingTable.tsx');
  const packs = await fe('lib/pricing.ts');
  for (const text of ['Pay once, no subscription. Credits stay in your account until you use them and work for every feature.', 'Videos need more credits.', 'Buy credits']) assert.ok(table.includes(text), `pricing text kept: ${text}`);
  for (const name of ['Starter', 'Creator', 'Studio']) assert.ok(packs.includes(name), `pack name kept: ${name}`);
  const page = await fe('pages/PricingPage.tsx');
  assert.match(page, /Simple credits\. See the price before you generate\./);
  assert.match(page, /<PricingTable \/>/);
  for (const gone of ['Production pricing', 'Choose your balance', 'See the quote first', 'Failure handling', 'Credits without the guesswork']) assert.ok(!page.includes(gone), `"${gone}" must stay removed`);
});

test('every faint white fill used anywhere in the app has a solid rule, so no card shows the background through it', async () => {
  const root = path.resolve(process.cwd(), '../aiwebvideo/src');
  async function tsx(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await tsx(full));
      else if (entry.name.endsWith('.tsx')) out.push(full);
    }
    return out;
  }
  const used = new Set<string>();
  for (const file of await tsx(root)) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/(?<![:\w-])bg-white\/\[(\.\d+)\]/g)) if (Number(match[1]) < 0.1) used.add(match[1]);
  }
  assert.ok(used.size >= 8, 'sanity: the faint fills are found');
  const css = await fe('cinematic-theme.css');
  for (const opacity of used) {
    assert.ok(css.includes(`[class*=" bg-white/[${opacity}]"]`) && css.includes(`[class^="bg-white/[${opacity}]"]`), `bg-white/[${opacity}] needs a solid rule in cinematic-theme.css`);
  }
});
