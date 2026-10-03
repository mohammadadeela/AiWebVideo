import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('every page sits on the space picture (bright, only a light veil); blocks are solid on top of it', async () => {
  const css = await fe('cinematic-theme.css');
  assert.match(css, /:root \{ --site-base: #0a0716; \}/);
  assert.match(css, /\.page-backdrop \{[^}]*position: fixed;[^}]*z-index: -1;[^}]*pointer-events: none;[^}]*url\("\/space-bg\.webp"\)/s);
  assert.match(css, /@media \(max-width: 900px\) \{ \.page-backdrop \{ background-image: url\("\/space-bg-small\.webp"\); \} \}/);   // a lighter file on phones
  // the veil stays light (it was too dark before): the strongest stop is no darker than .52
  const veil = css.match(/\.page-backdrop::after \{[^}]*\}/s)![0];
  const alphas = [...veil.matchAll(/rgba\(8, 5, 20, \.(\d+)\)/g)].map((m) => Number(`0.${m[1]}`));
  assert.ok(alphas.length >= 3 && Math.max(...alphas) <= 0.52, `veil strengths ${alphas.join(', ')}`);
  assert.match(css, /\.cinematic-page\.bg-bg \{ background-color: transparent; \}/);
  assert.match(css, /\.hero-mesh \{\s*background-image: radial-gradient\(ellipse/);                       // the old 62px grid pattern stays gone
  assert.doesNotMatch(css, /62px/);
  assert.doesNotMatch(css, /body::before/);                                                                  // the dark glow-and-stars background is gone
  assert.match(css, /\.cinematic-site main > section\[class\*="bg-black\/"\] \{ background-color: transparent; \}/);   // section bands carry no tint
  assert.match(css, /\.cinematic-site footer \{ background-color: #0a0817; \}/);                            // the footer is a solid block
  assert.match(await fe('App.tsx'), /<div className="cinematic-site">\s*<div className="page-backdrop" aria-hidden="true" \/>/);
  // secondary text is lighter so it reads on the bright picture
  const base = await fe('index.css');
  assert.match(base, /--color-text-muted: #c3bce0;/);
  assert.match(base, /--color-text-dim: #a8a1cc;/);
  // gradient-filled text must not get the readability halo (it would show through the letters)
  assert.match(css, /\.cinematic-site \.cinematic-title-gradient,[\s\S]*?text-shadow: none;/);
  assert.match(css, /h1, h2, h3, p, li, summary, label\):not\(\.cinematic-title\) \{ text-shadow:/);
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

test('every translucent fill used on a block anywhere in the app has a solid rule, so no block shows the background through it', async () => {
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
  const limit: Record<string, number> = { white: 0.16, violet: 0.25, mint: 0.15, pink: 0.1, gold: 0.08, panel: 0.85, black: 0.4 };
  const used = new Set<string>();
  for (const file of await tsx(root)) {
    for (const match of (await readFile(file, 'utf8')).matchAll(/(?<![:\w-])bg-(violet|mint|pink|gold|panel|black|white)\/(\[\.\d+\]|\d+)/g)) {
      const alpha = match[2].startsWith('[') ? Number(match[2].slice(1, -1)) : Number(match[2]) / 100;
      if (alpha <= limit[match[1]]) used.add(`${match[1]}/${match[2]}`);
    }
  }
  assert.ok(used.size >= 40, `sanity: the translucent fills are found (${used.size})`);
  const css = await fe('cinematic-theme.css');
  for (const token of used) {
    assert.ok(css.includes(`[class*=" bg-${token}"]:not(.absolute):not(.fixed):not(:hover):not(section):not(footer)`) && css.includes(`[class^="bg-${token}"]:not(.absolute)`), `bg-${token} needs a solid rule in cinematic-theme.css`);
  }
  // gradient-filled blocks get a solid colour underneath; decorative absolute glows and the hero mesh are skipped
  assert.match(css, /\[class\*=" bg-gradient-to"\][\s\S]*?\):not\(\.absolute\):not\(\.fixed\):not\(\.pointer-events-none\):not\(\.hero-mesh\) \{ background-color: #0d0a1f; \}/);
});

test('the gallery starts right under the hero: no big heading above the photos, the first eight load immediately', async () => {
  const gallery = await fe('components/landing/VideoShowcase.tsx');
  assert.match(gallery, /<h2 className="sr-only">See what it creates<\/h2>/);                // kept for screen readers and search only
  assert.doesNotMatch(gallery, /text-\[clamp\(2rem,8vw,3\.2rem\)\]/);                       // the large visible heading is gone
  assert.match(gallery, /pb-10 pt-4 sm:px-5 sm:pb-14 sm:pt-5/);                                // a thin top edge
  assert.match(gallery, /<Media sample=\{sample\} eager=\{index < 8\} \/>/);
});
