import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('a finished result is pinned in view: the follow-the-bottom logic stands aside while it settles, and the reader can take over', async () => {
  const widget = await fe('components/chat/ChatWidget.tsx');
  assert.match(widget, /finishLockUntilRef\.current = Date\.now\(\) \+ 4500/);                            // pinned for a few seconds
  assert.match(widget, /if \(Date\.now\(\) < finishLockUntilRef\.current\) \{\s*realignFinishedRef\.current\(false\)/);   // resizes re-align instead of jumping to the bottom
  assert.match(widget, /our own scroll to the finished result is not the reader scrolling up/);          // programmatic scroll is not "user scrolled up"
  assert.equal((widget.match(/finishLockUntilRef\.current = 0/g) ?? []).length, 2);                      // wheel and touch end the lock
  assert.match(widget, /window\.scrollBy\(\{ top: delta, behavior \}\)/);                                // the outer page is aligned too
  const base = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(base, /stage === "done" && scrollRef\.current\?\.querySelector\('\[data-generated-result="true"\]'\)\) return;/);   // no scroll-to-bottom past the result
});

test('Street View can be looked around like Google\'s: drag to turn and tilt, arrow keys, a steady picture while the next one loads, and clear steps', async () => {
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /onPointerDown=\{onPointerDown\}/);
  assert.match(card, /touch-none/);                                                                       // a finger drags the picture instead of scrolling the page
  assert.match(card, /start\.heading - dx \* degreesPerPixelX/);                                          // dragging right looks left, as in Google's viewer
  assert.match(card, /justDraggedRef/);                                                                   // the click that ends a drag never places a mark
  assert.match(card, /ArrowLeft/);
  assert.match(card, /const \[shownSrc, setShownSrc\]/);                                                  // the old picture stays until the new one has loaded
  for (const step of ['Look around', 'Tap the exact place', 'Say what it is']) assert.match(card, new RegExp(step));
  assert.match(card, /Drag to look around · tap to mark/);
  // the key still never reaches the page
  assert.doesNotMatch(card, /maps\.googleapis\.com/);
});

test('Street View is always shown under the map: Google\'s 360° viewer when pictures are off, then screenshot and tap the exact place', async () => {
  const { streetViewEmbedUrl } = await import('@/lib/mapPreview');
  const url = streetViewEmbedUrl(31.9062891, 35.2067296, 370);
  assert.match(url, /^https:\/\/www\.google\.com\/maps\?layer=c&cbll=31\.906289,35\.206730&cbp=12,10,0,0,0&output=svembed$/);   // no key, heading wrapped into 0-359
  assert.doesNotMatch(url, /key=/);
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /data-testid="street-view-embed"/);
  assert.match(card, /src=\{streetViewEmbedUrl\(latitude, longitude\)\}/);
  assert.match(card, /Google Street View · drag to look around/);
  assert.match(card, /take a screenshot of that view/);                       // says how to get the exact view to the AI
  assert.match(card, /Add a screenshot of the view/);
  assert.match(card, /onAddPhoto\?: \(\) => void/);                          // the card can open the photo picker
  assert.match(await fe('components/chat/WebsiteBriefForm.tsx'), /onAddPhoto=\{\(\) => inputRef\.current\?\.click\(\)\}/);
  // the embed appears only when the server has not switched pictures on, never when it confirmed there is no coverage
  assert.match(card, /info\?\.enabled \? \(/);
});
