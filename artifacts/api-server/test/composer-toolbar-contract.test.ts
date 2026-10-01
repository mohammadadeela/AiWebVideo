import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('the toolbar keeps the original separate controls, with the HD/4K badges and the narration shake', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  // original controls: duration, aspect ratio, quality, audio are separate buttons again
  for (const label of ['"Video duration"', 'ariaLabel="Aspect ratio"', 'ariaLabel="Quality"', 'ariaLabel="Audio"']) assert.ok(form.includes(label), label);
  assert.doesNotMatch(form, /OutputSettings/);
  // HD / 4K badges
  assert.match(form, /<QualityGlyph quality=\{quality\} size=\{18\} \/>/);
  assert.match(form, /iconBare: true/);
  // picking Narration makes the language button shake
  assert.match(form, /if \(value === "voice_music"\) pulseLanguage\(\);/);
  assert.match(form, /languageShake \? "attention-shake rounded-xl"/);
  const css = await fe('index.css');
  assert.match(css, /\.attention-shake \{/);
});

test('models are chosen from a ChatGPT/Claude-style list: name, one line, check on the chosen one', async () => {
  const picker = await fe('components/chat/ModelPicker.tsx');
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
  assert.match(picker, /aria-selected=\{active\}/);
  assert.match(picker, /<Check size=\{16\} \/>/);
  assert.match(picker, /model\.tagline/);
});

test('the "+" button replaces Style and References and offers files used before', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /<ComposerPlusMenu/);
  assert.match(form, /onUseRecent=\{\(file\) => addFiles\(\[file\]\)\}/);
  assert.match(form, /void rememberFiles\(accepted, recentFilesOwner\)/);
  assert.doesNotMatch(form, /Style · \{selectedWebsiteRecipe/);
  const menu = await fe('components/chat/ComposerPlusMenu.tsx');
  assert.match(menu, /Recent files/);
  assert.match(menu, /aria-label="Add photos, style or recent files"/);
  assert.match(menu, /disabled=\{full \|\| inUse\}/);               // already-attached rows cannot be added twice
  assert.match(menu, /Remove \$\{row\.name\} from recent files/);
});

test('recent files stay on the device and only keep types the studio can reuse', async () => {
  const lib = await fe('lib/recentFiles.ts');
  assert.match(lib, /indexedDB/);
  assert.match(lib, /ACCEPTED = \["image\/jpeg", "image\/png", "image\/webp"\]/);
  assert.match(lib, /MAX_FILES = 24/);
  assert.match(lib, /MAX_TOTAL_BYTES = 60 \* 1024 \* 1024/);
  assert.doesNotMatch(lib, /fetch\(|XMLHttpRequest|\/api\//);          // never uploaded just by being remembered
});

test('Ideas and format use their own drawn icons, not generic sparkles or monitors', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /<IdeasIcon size=\{17\} lit=\{compactPanel === "ideas" \|\| Boolean\(selectedIdea\)\}/);
  assert.match(form, /<FormatIcon ratio="9:16"/);
  assert.match(form, /<FormatIcon ratio="16:9"/);
  assert.match(form, /<FormatIcon ratio="1:1"/);
  const ideas = await fe('components/chat/IdeasIcon.tsx');
  assert.match(ideas, /<svg/);
  const format = await fe('components/chat/FormatIcon.tsx');
  for (const ratio of ['"9:16"', '"16:9"']) assert.ok(format.includes(ratio));
});

test('recent files exist only for signed-in people and belong to one account', async () => {
  const lib = await fe('lib/recentFiles.ts');
  assert.match(lib, /if \(!who\) return \[\];/);                               // no owner: nothing listed
  assert.match(lib, /if \(!who \|\| !usable\.length\) return;/);               // no owner: nothing remembered
  assert.match(lib, /row\?\.owner === who/);                                   // someone else's files are never returned
  const menu = await fe('components/chat/ComposerPlusMenu.tsx');
  assert.match(menu, /\{recentOwner && \(<>/);                                 // the whole section is hidden when signed out
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /recentFilesOwner=\{isSignedIn \? accountEmail : null\}/);
});

test('the Ideas icon is a bulb that switches on and off, held on when open or chosen, still for reduced motion', async () => {
  const icon = await fe('components/chat/IdeasIcon.tsx');
  assert.match(icon, /ideas-bulb-on/);
  assert.match(icon, /lit \? "is-lit" : ""/);
  const css = await fe('index.css');
  assert.match(css, /@keyframes ideas-light/);
  assert.match(css, /\.ideas-bulb\.is-lit \.ideas-bulb-on \{ opacity: 1; \}/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.ideas-bulb:not\(\.is-lit\), \.ideas-bulb:not\(\.is-lit\) \.ideas-bulb-on \{ animation: none; \}/);
});

test('example tiles are never disabled buttons, so a drag can start on them in every mode', async () => {
  const strip = await fe('components/chat/SampleStrip.tsx');
  assert.doesNotMatch(strip, /disabled=\{!selectable\}/);
  assert.doesNotMatch(strip, /cursor-default/);
  assert.match(strip, /role="img"/);
});

test('the "+" button keeps its toolbar size (a real browser measured 20px when this rule went missing)', async () => {
  const css = await fe('index.css');
  assert.match(css, /\.composer-plus \{ width: 34px; height: 34px; \}/);
  assert.match(css, /max-width: 639px\) \{ \.composer-plus \{ width: 44px; height: 44px; \}/);
});
