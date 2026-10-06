import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cropFromFrame, captureFailureMessage, MIN_CAPTURE_PIXELS } from '../../aiwebvideo/src/lib/captureView';
import { imageSrcSet, imageVariant, videoPoster, hasVariants } from '../../aiwebvideo/src/lib/mediaVariants';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('the captured frame is cropped to exactly where the Street View box is, at the screen\'s real pixel density', () => {
  // a 1000x600 page shown on a 2x screen: the captured frame is 2000x1200 and the box sits at (100, 80) and is 640x480
  assert.deepEqual(
    cropFromFrame({ left: 100, top: 80, width: 640, height: 480 }, { width: 1000, height: 600 }, { width: 2000, height: 1200 }),
    { sx: 200, sy: 160, sw: 1280, sh: 960 },
  );
  // same page at 1x
  assert.deepEqual(
    cropFromFrame({ left: 100, top: 80, width: 640, height: 480 }, { width: 1000, height: 600 }, { width: 1000, height: 600 }),
    { sx: 100, sy: 80, sw: 640, sh: 480 },
  );
});

test('a box that runs past the screen is cut at the edge, and one that is mostly off-screen gives nothing', () => {
  const partly = cropFromFrame({ left: 300, top: 100, width: 640, height: 480 }, { width: 800, height: 600 }, { width: 800, height: 600 });
  assert.deepEqual(partly, { sx: 300, sy: 100, sw: 500, sh: 480 });
  assert.equal(cropFromFrame({ left: 780, top: 100, width: 640, height: 480 }, { width: 800, height: 600 }, { width: 800, height: 600 }), null);
  assert.equal(cropFromFrame({ left: 0, top: 590, width: 640, height: 480 }, { width: 800, height: 600 }, { width: 800, height: 600 }), null);
  assert.ok(MIN_CAPTURE_PIXELS >= 100);
});

test('bad numbers never produce a crop', () => {
  for (const [viewport, frame] of [[{ width: 0, height: 600 }, { width: 800, height: 600 }], [{ width: 800, height: 600 }, { width: 0, height: 0 }], [{ width: NaN, height: 600 }, { width: 800, height: 600 }]] as const) {
    assert.equal(cropFromFrame({ left: 0, top: 0, width: 500, height: 400 }, viewport, frame), null);
  }
});

test('every capture failure explains what to do next in plain words', () => {
  for (const reason of ['denied', 'surface', 'hidden', 'tiny', 'unsupported', 'failed'] as const) {
    const text = captureFailureMessage(reason);
    assert.ok(text.length > 30 && /[.]$/.test(text), reason);
  }
  assert.match(captureFailureMessage('surface'), /This tab/);
});

test('the Street View card offers one-click capture, hides its own label while capturing, and falls back to screenshot instructions', async () => {
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /data-testid="capture-view"/);
  assert.match(card, /Capture this view/);
  assert.match(card, /captureElementAsFile\(frame/);
  assert.match(card, /\{!capturing && <p className="pointer-events-none absolute left-2 top-2/);   // the label is not in the picture
  assert.match(card, /Windows: Win \+ Shift \+ S/);   // browsers without tab capture keep the screenshot instructions
  assert.match(card, /pickerRef\.current\?\.scrollIntoView/);   // the next step (tap the place) is brought into view
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /onCapture=\{\(file\) => addFiles\(\[file\]\)\}/);
  const lib = await fe('lib/captureView.ts');
  assert.match(lib, /getDisplayMedia/);
  assert.match(lib, /track\.stop\(\)/);   // sharing always stops
  assert.match(lib, /audio: false/);
});

test('our own pictures have small copies, every other address is left alone', () => {
  const url = '/api/assets/123e4567-e89b-12d3-a456-426614174000/photo-0-1080p.png?expires=1790000000&sig=abc';
  assert.ok(hasVariants(url));
  assert.equal(imageVariant(url, 32), `${url}&w=32`);
  assert.equal(imageVariant('/api/assets/marketing/a.jpg', 480), '/api/assets/marketing/a.jpg?w=480');
  assert.equal(videoPoster(`${url}#t=0.001`), `${url}&poster=1`);
  assert.match(imageSrcSet(url)!, /w=480 480w, .*w=960 960w, .* 2048w$/);
  for (const other of ['blob:https://x/1', 'data:image/png;base64,AAA', 'https://other.example/a.png', '/api/other/x.png', '']) {
    assert.equal(imageVariant(other, 32), null);
    assert.equal(videoPoster(other), null);
    assert.equal(imageSrcSet(other), undefined);
  }
});

test('generated photos load blurred-first, never at 4K master size, and the full-size button no longer covers the picture', async () => {
  const grid = await fe('components/chat/ResultGrid.tsx');
  assert.match(grid, /<ProgressiveImage src=\{photo\.url\}/);
  assert.match(grid, /image\.src = imageVariant\(photo\.url, 960\) \?\? photo\.url/);   // no eager download of every master
  assert.match(grid, /<FastVideo key=\{activeVideo\.id\}/);
  assert.match(grid, /poster=\{poster \?\? undefined\}/);
  assert.match(grid, /\[@media\(hover:hover\)\]:opacity-0/);   // the "View full size" pill only appears on hover on a mouse
  assert.doesNotMatch(grid, /min-h-64 overflow-hidden rounded-\[20px\]/);   // min-height with an aspect ratio pushed tiles past their column
  const image = await fe('components/ui/ProgressiveImage.tsx');
  assert.match(image, /blur-2xl/);
  assert.match(image, /Try again/);
  assert.match(image, /image\?\.complete/);   // a cached picture still fades in
});

test('the live workspace thumbnails and chat capture cards also load blurred-first at thumbnail size', async () => {
  const canvas = await fe('components/chat/GenerationCanvas.tsx');
  assert.match(canvas, /<ProgressiveImage src=\{item\.url\}/);
  assert.match(canvas, /<ProgressiveImage key=\{asset\.id\}/);
  assert.match(canvas, /poster=\{videoPoster\(generatedVideo\.url\)/);
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /<ProgressiveImage src=\{item\.url\} alt=\{item\.title\} sizes="224px"/);
});
