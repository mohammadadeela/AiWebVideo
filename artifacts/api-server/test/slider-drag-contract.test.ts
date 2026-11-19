import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('sliders can be dragged with a mouse and show grab / grabbing instead of the click hand', async () => {
  assert.match(await fe('main.tsx'), /installDragScroll\(\)/);
  const css = await fe('index.css');
  assert.match(css, /\.drag-scroll-ready button:not\(:disabled\)/);
  assert.match(css, /cursor: url\("data:image\/svg\+xml,[^"]+"\) 23 15, grab;/);          // distinct drag cursor, grab as fallback
  assert.match(css, /\.drag-scroll-active \*[\s\S]{0,1200}\) 23 15, grabbing !important/);
  const lib = await fe('lib/dragScroll.ts');
  assert.match(lib, /pointerType !== "mouse"/);          // touch keeps its native swipe
  assert.match(lib, /swallowClick/);                     // a drag is never a click
  assert.match(lib, /const SLIDER = "\[data-drag-scroll\]";/);   // opt-in: only the chat's feature slider and examples strip
});
