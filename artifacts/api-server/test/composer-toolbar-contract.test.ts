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
  assert.match(form, /void rememberFiles\(accepted\)/);
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
  assert.match(form, /<IdeasIcon size=\{16\}/);
  assert.match(form, /<FormatIcon ratio="9:16"/);
  assert.match(form, /<FormatIcon ratio="16:9"/);
  assert.match(form, /<FormatIcon ratio="1:1"/);
  const ideas = await fe('components/chat/IdeasIcon.tsx');
  assert.match(ideas, /<svg/);
  const format = await fe('components/chat/FormatIcon.tsx');
  for (const ratio of ['"9:16"', '"16:9"']) assert.ok(format.includes(ratio));
});

test('Ideas and Style panels scroll into view when opened, so phones see them below the toolbar', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /compactPanel === "ideas" && \(\n\s*<div ref=\{inlinePanelRef\}/);
  assert.match(form, /compactPanel === "style" && activeMode === "website" && \(\n\s*<div ref=\{inlinePanelRef\}/);
  assert.match(form, /inlinePanelRef\.current\?\.scrollIntoView\?\.\(\{ block: "nearest"/);
  assert.match(form, /prefers-reduced-motion: reduce/);
});
