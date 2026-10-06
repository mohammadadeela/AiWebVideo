import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const be = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');

test('a set of generated photos is shown once: the separate "choose the images" copy is gone and choosing happens on the photos themselves', async () => {
  const grid = await fe('components/chat/ResultGrid.tsx');
  assert.doesNotMatch(grid, /GeneratedPhotoPicker|Choose the images to continue/);
  assert.match(grid, /aria-pressed=\{chosen\.includes\(`generated-photo-\$\{index \+ 1\}`\)\}/);
  assert.match(grid, /onGeneratedPhotoSelectionChange\?\.\(next\)/);
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.doesNotMatch(widget, /GeneratedPhotoPicker/);
  assert.match(widget, /Tick the photo or photos above/);
  // the next step is still started by the choice itself
  assert.match(widget, /pendingPostResultRequestRef\.current = null;\s*void handleContinueAfterResult\(pending, next, false\)/);
});

test('a follow-up result never repeats pictures or videos the chat already showed', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /const assets = \(job\.assets \?\? \[\]\)\.filter\(\(asset\) => !alreadyShown\?\.has\(asset\.id\)\);/);
  assert.match(widget, /const assets = own\.filter\(\(asset\) => !alreadyShown\?\.has\(asset\.id\)\);/);
  assert.match(widget, /shownAssetIdsRef\.current\.add\(asset\.id\)/);
  // reopening a conversation starts the record afresh from what its own saved cards show
  assert.match(widget, /shownAssetIdsRef\.current = shownBefore;/);
  assert.match(widget, /const shownBefore = new Set<string>\(\);/);
  const canvas = await fe('components/chat/GenerationCanvas.tsx');
  assert.match(canvas, /\{!settled && \(generatedVideo \|\| generatedPhotos\.length > 0\) && \(/);   // the live preview goes away when the real result arrives
});

test('a picture never depends on its small preview: a failed preview falls back to the original', async () => {
  const image = await fe('components/ui/ProgressiveImage.tsx');
  assert.match(image, /const \[originalOnly, setOriginalOnly\] = useState\(false\);/);
  assert.match(image, /if \(smaller\) setOriginalOnly\(true\); else setFailed\(true\);/);
});

test('previews live in a normal folder (Express refuses to send files from inside a dot-folder) and are sent by a function that cannot throw', async () => {
  const variants = await be('lib/media-variants.ts');
  assert.match(variants, /path\.join\(ASSETS_DIR, jobId, 'previews'\)/);
  assert.doesNotMatch(variants, /'\.variants'/);
  assert.match(variants, /dotfiles: 'allow'/);
  const route = await be('routes/index.ts');
  assert.match(route, /await sendVariantFile\(res, variant,/);
  assert.doesNotMatch(route, /res\.type\('image\/jpeg'\)\.sendFile\(variant\)/);
});
