import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import architectureRouter from '../src/routes/architecture.js';
import { describeTarget, composeStudioBrief, scopeWithTarget, TARGET_KINDS, TARGET_LEVELS, type ArchitectureInput } from '../src/lib/studio-direction.js';
import { drawTargetMarker, markerFilter, markerLabel } from '../src/lib/target-marker.js';
import { fetchStreetViewSet, planStreetViews, streetViewImageUrl } from '../src/lib/street-view.js';

const run = promisify(execFile);

// ------------------------------------------------------------------------- what the customer pointed at, in words
test('every kind of target is described so the AI designs exactly that and leaves the rest alone', () => {
  const whole = describeTarget({ targetKind: 'building' }).join('\n');
  assert.match(whole, /WHOLE BUILDING.*every floor and the roof/);
  const shop = describeTarget({ targetKind: 'unit', targetLevel: 'ground' }).join('\n');
  assert.match(shop, /ONE SHOP \/ UNIT.*the ground floor, at street level/);
  assert.match(shop, /Design only that unit/);
  assert.match(shop, /the units above, below and beside it, and the neighbours stay exactly as they are/);
  const upper = describeTarget({ targetKind: 'unit', targetLevel: '3' }).join('\n');
  assert.match(upper, /on the 3rd floor/);
  const floor = describeTarget({ targetKind: 'floor', targetLevel: 'basement' }).join('\n');
  assert.match(floor, /ONE FLOOR.*the basement \(below street level\)/);
  assert.match(floor, /Only that level changes/);
  assert.match(floor, /design it as an interior/);
  const land = describeTarget({ targetKind: 'land' }).join('\n');
  assert.match(land, /EMPTY LAND.*Place a NEW building on exactly that plot/);
  assert.match(land, /keep both neighbours unchanged/);
  assert.deepEqual(describeTarget({}), []);
  assert.deepEqual(describeTarget(null), []);
  assert.deepEqual(describeTarget({ targetLevel: '2', targetX: 0.5, targetY: 0.5 }), []);   // a tap without a kind means nothing
  for (const kind of TARGET_KINDS) for (const level of TARGET_LEVELS) assert.ok(describeTarget({ targetKind: kind, targetLevel: level }).length >= 1);
});

test('where the customer tapped is turned into plain position words, with the camera, and the marker note only when a marked copy exists', () => {
  const at = (x: number, y: number, extra: Partial<ArchitectureInput> = {}) => describeTarget({ targetKind: 'unit', targetX: x, targetY: y, targetSource: 'street', ...extra }).join('\n');
  assert.match(at(0.62, 0.71), /pointed at the lower middle of the first Street View picture \(about 62% from the left and 71% from the top\)/);
  assert.match(at(0.8, 0.8), /the lower right of the first Street View picture/);
  assert.match(at(0.1, 0.1), /the upper left of the first Street View picture/);
  assert.match(at(0.5, 0.5), /the centre of the first Street View picture/);
  assert.match(at(0.5, 0.2), /the upper middle of the first Street View picture/);
  assert.match(at(0.9, 0.5), /pointed at the right of the first Street View picture/);
  assert.match(at(0.5, 0.5, { streetViewPitch: 40 }), /the camera looks up 40 degrees \(to see the upper floors\)/);
  assert.match(at(0.5, 0.5, { streetViewFov: 45, streetViewPitch: 0 }), /level and is zoomed in/);
  assert.match(at(0.5, 0.5, { targetSource: 'photo' }), /the centre of their own photo/);
  assert.doesNotMatch(at(0.5, 0.5), /TARGET MARKER/);
  assert.match(at(0.5, 0.5, { targetMarked: true }), /labelled TARGET MARKER.*must never appear in any result/);
  assert.equal(describeTarget({ targetKind: 'land' }).some((line) => line.includes('Where:')), false);   // no tap, no "where"
});

test('the customer\'s target decides the kind of project; their words only choose between the close variants', () => {
  assert.equal(scopeWithTarget('land', 'fit_out_interior'), 'new_building');
  assert.equal(scopeWithTarget('building', 'storefront_exterior'), 'new_building');
  assert.equal(scopeWithTarget('building', 'facade_retrofit'), 'facade_retrofit');
  assert.equal(scopeWithTarget('building', 'extension'), 'extension');
  assert.equal(scopeWithTarget('unit', 'new_building'), 'storefront_exterior');
  assert.equal(scopeWithTarget('unit', 'fit_out_interior'), 'fit_out_interior');
  assert.equal(scopeWithTarget('floor', 'new_building'), 'fit_out_interior');
  assert.equal(scopeWithTarget('floor', 'extension'), 'extension');
  assert.equal(scopeWithTarget(undefined, 'landscape'), 'landscape');
});

test('the target reaches the brief the AI receives, before the customer\'s own words, and sets the scope', () => {
  const brief = composeStudioBrief({
    studioKind: 'architecture',
    userBrief: 'a clothes shop here',
    architecture: { location: 'Ramallah', targetKind: 'unit', targetLevel: 'ground', targetX: 0.4, targetY: 0.7, targetSource: 'street', targetMarked: true },
  });
  assert.match(brief, /TARGET \(the customer's explicit choice\): ONE SHOP \/ UNIT/);
  assert.match(brief, /TARGET SELECTION/);                                         // the master direction explains how to treat it
  assert.match(brief, /PROJECT SCOPE: storefront_exterior/);                       // not "a new tower", whatever the words
  assert.ok(brief.indexOf('TARGET (the customer') < brief.indexOf('a clothes shop here'));
  const land = composeStudioBrief({ studioKind: 'architecture', userBrief: 'a clothes shop here', architecture: { location: 'Ramallah', targetKind: 'land' } });
  assert.match(land, /PROJECT SCOPE: new_building/);
});

// ------------------------------------------------------------------------- the marked copy, checked on real pixels
let dir = '';
before(async () => { dir = await mkdtemp(path.join(os.tmpdir(), 'target-test-')); });
after(async () => { await rm(dir, { recursive: true, force: true }); });

async function pixels(jpeg: Buffer): Promise<{ at: (x: number, y: number) => [number, number, number]; width: number; height: number }> {
  const file = path.join(dir, `p-${Math.random().toString(36).slice(2)}.jpg`);
  await (await import('node:fs/promises')).writeFile(file, jpeg);
  const { stdout } = await new Promise<{ stdout: Buffer }>((resolve, reject) => execFile('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }, (error, out) => (error ? reject(error) : resolve({ stdout: out as unknown as Buffer }))));
  const width = 640, height = 480;
  return { width, height, at: (x, y) => { const i = (y * width + x) * 3; return [stdout[i], stdout[i + 1], stdout[i + 2]]; } };
}
const isRed = ([r, g, b]: [number, number, number]) => r > 190 && g < 90 && b < 90;
const isGray = ([r, g, b]: [number, number, number]) => Math.abs(r - 128) < 12 && Math.abs(g - 128) < 12 && Math.abs(b - 128) < 12;

async function grayFrame(): Promise<Buffer> {
  const file = path.join(dir, 'gray.jpg');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x808080:s=640x480', '-frames:v', '1', file]);
  return readFile(file);
}

test('the marker is drawn exactly where the customer tapped, and nowhere else', async () => {
  const marked = await drawTargetMarker(await grayFrame(), { x: 0.62, y: 0.71 }, 'unit');
  assert.ok(marked && marked.length > 1000);
  const frame = await pixels(marked);
  assert.ok(isRed(frame.at(397, 341)), 'the cross is at the tap (62% of 640, 71% of 480)');
  assert.ok(isRed(frame.at(400, 284)), 'the box top edge, 12% of the height above the tap');
  assert.ok(isRed(frame.at(333, 340)), 'the box left edge, 10% of the width left of the tap');
  assert.ok(isGray(frame.at(10, 10)), 'the far corner is untouched');
  assert.ok(isGray(frame.at(350, 300)), 'inside the box the picture is untouched');
  assert.ok(isGray(frame.at(600, 100)), 'outside the box the picture is untouched');
});

test('a tap at the very edge keeps the box inside the picture, and each kind of target has its own box', async () => {
  const edge = await pixels((await drawTargetMarker(await grayFrame(), { x: 0.99, y: 0.99 }, 'land'))!);
  assert.ok(isRed(edge.at(634, 470)), 'the cross is where it was tapped, near the corner');
  assert.ok(isRed(edge.at(500, 404)), 'the box top edge sits inside the frame (clamped, not cut off)');
  assert.ok(isRed(edge.at(638, 440)), 'the box right edge is the right edge of the frame');
  const wide = markerFilter({ x: 0.5, y: 0.5 }, 'floor');
  const tall = markerFilter({ x: 0.5, y: 0.5 }, 'building');
  assert.match(wide, /w=iw\*0\.5600:h=ih\*0\.1300/);          // a floor is a wide, low band
  assert.match(tall, /w=iw\*0\.3400:h=ih\*0\.4000/);          // a building is a big box
  assert.notEqual(wide, tall);
  assert.match(markerFilter({ x: -5, y: 9 }, 'unit'), /iw\*0\.0000/);   // out-of-range taps are clamped, never passed to ffmpeg raw
});

test('a file that is not a picture gives no marked copy, and does not throw', async () => {
  assert.equal(await drawTargetMarker(Buffer.from('not an image at all'), { x: 0.5, y: 0.5 }, 'unit'), null);
});

test('the marked copy is labelled so the AI knows it is a pointer and not part of the scene', () => {
  const street = markerLabel('unit', 'street');
  assert.match(street, /^TARGET MARKER — locating aid only/);
  assert.match(street, /the first Street View picture \(one shop or unit\)/);
  assert.match(street, /never draw the box, the cross or any marker in any result/);
  assert.match(markerLabel('land', 'photo'), /their own photo \(empty land\)/);
  assert.match(markerLabel('floor', 'street'), /one floor/);
});

// ------------------------------------------------------------------------- the camera: look up at upper floors, down to a basement, zoom on a shop
test('the Street View camera tilts and zooms, and every frame carries the same camera', async () => {
  const shots = planStreetViews({ headingToPlot: 10 }, 90, { pitch: 40, fov: 55 });
  assert.deepEqual(shots.map((shot) => [shot.pitch, shot.fov]), [[40, 55], [40, 55], [40, 55]]);
  const clamped = planStreetViews({ headingToPlot: 0 }, null, { pitch: 999, fov: 1 });
  assert.deepEqual([clamped[0].pitch, clamped[0].fov], [70, 30]);
  assert.deepEqual(planStreetViews({ headingToPlot: 0 }).map((shot) => [shot.pitch, shot.fov]), [[5, 90], [5, 90], [5, 90]]);
  assert.match(streetViewImageUrl({ panoId: 'CAoSLEFGMVFpcE5ocFZ6', heading: 10, pitch: 40, fov: 55 }, 'k'), /size=640x480&pano=.*&heading=10&pitch=40&fov=55/);

  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input); urls.push(url);
    if (url.includes('/metadata')) return Response.json({ status: 'OK', pano_id: 'CAoSLEFGMVFpcE5ocFZ6', date: '2020-06', location: { lat: 31.9, lng: 35.2 } });
    return new Response(new Uint8Array(2000).fill(5), { headers: { 'content-type': 'image/jpeg' } });
  };
  const set = await fetchStreetViewSet({ latitude: 31.9005, longitude: 35.2 }, { env: { ARCHITECTURE_MAPS_IMAGERY: '1', GOOGLE_MAPS_API_KEY: 'k' } as NodeJS.ProcessEnv, fetcher, heading: 120, pitch: 45, fov: 60 });
  assert.deepEqual(set!.images.map((image) => image.role), ['front', 'left', 'right']);
  assert.ok(urls.filter((url) => url.includes('/streetview?')).every((url) => url.includes('pitch=45') && url.includes('fov=60')));
  assert.equal(urls.find((url) => url.includes('heading=120'))?.includes('size=640x480'), true);
});

// ------------------------------------------------------------------------- the routes
let server: Server;
let base = '';
const realFetch = globalThis.fetch;
const saved = { flag: process.env.ARCHITECTURE_MAPS_IMAGERY, key: process.env.GOOGLE_MAPS_API_KEY };
before(async () => {
  const app = express();
  app.use('/api/architecture', architectureRouter);
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/architecture`;
});
after(() => {
  server.close();
  globalThis.fetch = realFetch;
  if (saved.flag === undefined) delete process.env.ARCHITECTURE_MAPS_IMAGERY; else process.env.ARCHITECTURE_MAPS_IMAGERY = saved.flag;
  if (saved.key === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = saved.key;
});

test('route: the page can tilt and zoom, out-of-range values are refused, and customers are never told what is missing on the server', async () => {
  process.env.ARCHITECTURE_MAPS_IMAGERY = '1'; process.env.GOOGLE_MAPS_API_KEY = 'TEST-KEY';
  const seen: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    if (url.includes('maps.googleapis.com')) { seen.push(url); return new Response(new Uint8Array(2000).fill(9), { headers: { 'content-type': 'image/jpeg' } }); }
    return realFetch(input, init);
  }) as typeof fetch;
  const ok = await realFetch(`${base}/street-view/image?pano=CAoSLEFGMVFpcE5ocFZ6&heading=90&pitch=40&fov=55`);
  assert.equal(ok.status, 200);
  assert.ok(seen[0].includes('pitch=40') && seen[0].includes('fov=55') && seen[0].includes('size=640x480'));
  for (const bad of ['pitch=90', 'pitch=-60', 'fov=5', 'fov=170']) {
    assert.equal((await realFetch(`${base}/street-view/image?pano=CAoSLEFGMVFpcE5ocFZ6&heading=90&${bad}`)).status, 400, bad);
  }
  delete process.env.ARCHITECTURE_MAPS_IMAGERY; delete process.env.GOOGLE_MAPS_API_KEY;
  const off = await (await realFetch(`${base}/street-view?lat=31.9&lng=35.2`)).json() as Record<string, unknown>;
  assert.deepEqual(off, { enabled: false, available: false });     // no reason for anonymous visitors
});

// ------------------------------------------------------------------------- the upload route
test('the upload route validates the target, keeps what only the server may say, and marks the picture the customer tapped', async () => {
  const route = await readFile(path.resolve(process.cwd(), 'src/routes/uploads.ts'), 'utf8');
  assert.match(route, /targetKind: z\.enum\(TARGET_KINDS\)\.optional\(\)/);
  assert.match(route, /targetLevel: z\.enum\(TARGET_LEVELS\)\.optional\(\)/);
  assert.match(route, /targetX: z\.number\(\)\.min\(0\)\.max\(1\)\.optional\(\)/);
  assert.match(route, /streetViewPitch: z\.number\(\)\.min\(-20\)\.max\(70\)\.optional\(\)/);
  assert.match(route, /streetViewFov: z\.number\(\)\.min\(30\)\.max\(110\)\.optional\(\)/);
  assert.ok(route.indexOf('delete architecture.targetMarked') < route.indexOf('fetchSiteImageryDetailed({'), 'a page cannot claim a marked copy exists');
  assert.match(route, /architecture\.targetKind === 'unit'\) architecture\.targetLevel \?\?= 'ground'/);
  assert.match(route, /architecture\.targetKind === 'floor'\) architecture\.targetLevel \?\?= '1'/);
  assert.match(route, /else delete architecture\.targetLevel;/);                           // a whole building or empty land has no level
  assert.match(route, /if \(architecture\?\.targetSource === 'photo' && architecture\.targetPhoto === index\) photoTappedOn = jpeg;/);
  assert.match(route, /url: `target-marker:\/\/\$\{pageIndex\}`, title: markerLabel\(architecture\.targetKind, 'photo'\)/);
  assert.match(route, /url: `target-marker:\/\/\$\{pageIndex\}`, title: markerLabel\(architecture\.targetKind, 'street'\)/);
  assert.match(route, /imagery\.images\.find\(\(shot\) => shot\.role === 'front'\)/);        // the marked copy is of the picture the customer looked at
  // a tap that has no picture to refer to is dropped, the choice of target is kept
  assert.equal((route.match(/delete architecture\.targetX; delete architecture\.targetY; delete architecture\.targetSource;/g) ?? []).length >= 2, true);
});
