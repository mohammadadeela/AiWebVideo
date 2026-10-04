import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EMPTY_SELECTION, LEVEL_OPTIONS, MARKER_BOX as CLIENT_BOX, TARGET_OPTIONS, markerRect, selectionToRequest, type SiteSelection } from '../../aiwebvideo/src/lib/siteTarget.js';
import { MARKER_BOX as SERVER_BOX } from '../src/lib/target-marker.js';
import { TARGET_KINDS, TARGET_LEVELS } from '../src/lib/studio-direction.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const sel = (patch: Partial<SiteSelection>): SiteSelection => ({ ...EMPTY_SELECTION, ...patch });
const defined = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

test('the page and the server agree on every kind, every level, and the exact size of every box', () => {
  assert.deepEqual(TARGET_OPTIONS.map((option) => option.id).sort(), [...TARGET_KINDS].sort());
  assert.deepEqual(LEVEL_OPTIONS.map((option) => option.id), [...TARGET_LEVELS]);
  assert.deepEqual(CLIENT_BOX, SERVER_BOX);        // what the customer sees marked is what the AI is shown
});

test('the marker box sits where the customer tapped and stays inside the picture, exactly like the server draws it', () => {
  const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
  const unit = markerRect('unit', 0.62, 0.71);
  near(unit.left, 0.52); near(unit.top, 0.59); near(unit.width, 0.2); near(unit.height, 0.24);
  const corner = markerRect('land', 0.99, 0.99);
  near(corner.left, 0.58); near(corner.top, 0.84);                       // pushed back inside, not cut off
  const topLeft = markerRect('building', 0.01, 0.01);
  near(topLeft.left, 0); near(topLeft.top, 0);
  assert.deepEqual(markerRect(null, 0.5, 0.5), markerRect('unit', 0.5, 0.5));   // before a kind is chosen the pointer is shown at shop size
});

test('nothing is sent until the customer chooses or marks something', () => {
  assert.deepEqual(defined(selectionToRequest(EMPTY_SELECTION)), {});
});

test('the request carries exactly what was chosen: kind, level, the tap, and the camera that tap belongs to', () => {
  assert.deepEqual(defined(selectionToRequest(sel({ kind: 'building' }))), { targetKind: 'building' });
  assert.deepEqual(defined(selectionToRequest(sel({ kind: 'land', level: 'roof' }))), { targetKind: 'land' });          // a level only means something for a shop or a floor
  assert.deepEqual(defined(selectionToRequest(sel({ kind: 'floor', level: '3' }))), { targetKind: 'floor', targetLevel: '3' });
  const tapped = defined(selectionToRequest(sel({ kind: 'unit', level: 'ground', x: 0.123456, y: 0.7, heading: 130, pitch: 45, fov: 65 })));
  assert.deepEqual(tapped, {
    streetViewHeading: 130, streetViewPitch: 45, streetViewFov: 65,
    targetKind: 'unit', targetLevel: 'ground', targetX: 0.1235, targetY: 0.7, targetSource: 'street',
  });
  // facing the plot (heading null) is not sent: the server aims the camera the same way, so the frame is the same
  const auto = defined(selectionToRequest(sel({ kind: 'unit', x: 0.5, y: 0.5 })));
  assert.equal('streetViewHeading' in auto, false);
  assert.equal(auto.streetViewPitch, 5);
  assert.equal(auto.streetViewFov, 90);
  // a tap on one of the customer's own photos names the photo and sends no Street View camera
  assert.deepEqual(defined(selectionToRequest(sel({ kind: 'floor', level: '2', x: 0.4, y: 0.6, source: 'photo', photo: 2 }))), {
    targetKind: 'floor', targetLevel: '2', targetX: 0.4, targetY: 0.6, targetSource: 'photo', targetPhoto: 2,
  });
  // a tap without a kind is not sent (the page asks what it is), and a changed camera alone is still remembered
  assert.deepEqual(defined(selectionToRequest(sel({ x: 0.5, y: 0.5 }))), {});
  assert.deepEqual(defined(selectionToRequest(sel({ heading: 90 }))), { streetViewHeading: 90, streetViewPitch: 5, streetViewFov: 90 });
});

test('the card lets the customer say what they mean: whole building, one shop, one floor, empty land, and which level', async () => {
  const controls = await fe('components/chat/SiteTargetControls.tsx');
  assert.match(controls, /What do you want to design here\?/);
  assert.match(controls, /role="radiogroup" aria-label="What to design"/);
  assert.match(controls, /Which level is the shop or unit on\?/);
  assert.match(controls, /Which floor\?/);
  assert.match(controls, /You marked a spot\. Now choose what it is\./);
  assert.match(controls, /min-h-14/);                                               // big targets
  assert.match(controls, /h-10 min-w-\[52px\]/);
  const options = await fe('lib/siteTarget.ts');
  for (const label of ['Whole building', 'One shop or unit', 'One floor', 'Empty land', 'Basement', 'Ground', 'Roof']) assert.match(options, new RegExp(`label: "${label}"`));
});

test('tapping works with a finger, a mouse and the keyboard, and the mark can be cleared', async () => {
  const controls = await fe('components/chat/SiteTargetControls.tsx');
  assert.match(controls, /event\.detail === 0/);                                    // Enter / Space marks the centre
  assert.match(controls, /\(event\.clientX - rect\.left\) \/ Math\.max\(1, rect\.width\)/);
  assert.match(controls, /aria-label="Clear the mark"/);
  assert.match(controls, /pointer-events-none absolute z-10 rounded/);              // the box never blocks the next tap
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /Moving the camera makes an earlier mark point at the wrong place, so it is cleared/);
  assert.match(card, /label="Tap the exact place on the street picture"/);
  assert.match(card, /label="Tap the exact place on your photo"/);
  assert.match(card, /Mark it on my own photo instead/);
  assert.match(card, /Mark it on Street View instead/);
  assert.match(card, /if \(value\.source === "photo" && \(photos\.length === 0 \|\| value\.photo >= photos\.length\)\)/);   // a removed photo cannot stay marked
});

test('only the site owner is told why Street View is off, and what to do', async () => {
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /info\?\.reason && \(/);
  assert.match(card, /Only you see this: Street View is off in this site/);
  assert.match(card, /ARCHITECTURE_MAPS_IMAGERY=1/);
});
