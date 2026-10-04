import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchPhotoForDesign, findNearbyPhotos, isMapillaryId, mapillaryEnabled, rankPhotos, searchBox } from '../src/lib/mapillary.js';
import { describeTarget } from '../src/lib/studio-direction.js';
import { EMPTY_SELECTION, selectionToRequest } from '@/lib/siteTarget';

const PLOT = { latitude: 31.9062891, longitude: 35.2067296 };
const NOW = Date.UTC(2026, 9, 4);
const photo = (over: Record<string, unknown> = {}) => ({
  id: '100000000000001', captured_at: Date.UTC(2026, 2, 10), compass_angle: 0, computed_compass_angle: 0,
  computed_geometry: { type: 'Point', coordinates: [PLOT.longitude, PLOT.latitude - 0.00018] },   // about 20 m south of the plot, looking north: at it
  is_pano: false, quality_score: 0.9, width: 2688, creator: { username: 'amal_k', id: '1' },
  thumb_256_url: 'https://cdn.example/t256.jpg', thumb_1024_url: 'https://cdn.example/t1024.jpg', ...over,
});

test('the search box is about 90 m each way around the plot', () => {
  const [west, south, east, north] = searchBox(PLOT);
  assert.ok(Math.abs((north - south) * 111_320 - 180) < 2);
  assert.ok(west < PLOT.longitude && east > PLOT.longitude);
  assert.ok(Math.abs((east - west) * 111_320 * Math.cos(PLOT.latitude * Math.PI / 180) - 180) < 2);
});

test('ranking: close, facing the plot, recent and sharp come first; panoramas, tiny, far, duplicate and unsafe photos are dropped', () => {
  const data = [
    photo({ id: '100000000000002', computed_geometry: { coordinates: [PLOT.longitude, PLOT.latitude + 0.0005] }, computed_compass_angle: 0, captured_at: Date.UTC(2018, 0, 1) }),   // 55 m north, looking away, old
    photo(),                                                                                                                                                                   // the best
    photo({ id: '100000000000003', is_pano: true }),                                                                                                                           // panorama
    photo({ id: '100000000000004', width: 640 }),                                                                                                                              // too small
    photo({ id: '100000000000005', computed_geometry: { coordinates: [PLOT.longitude, PLOT.latitude - 0.01] } }),                                                              // 1 km away
    photo({ id: '100000000000006', computed_geometry: { coordinates: [PLOT.longitude + 0.00001, PLOT.latitude - 0.00018] } }),                                                 // same spot, same direction as the best
    photo({ id: '100000000000007', thumb_256_url: 'http://insecure.example/t.jpg' }),                                                                                          // not https
    photo({ id: 'abc' }),                                                                                                                                                      // not a Mapillary id
    photo({ id: '100000000000008', computed_geometry: { coordinates: [PLOT.longitude + 0.0003, PLOT.latitude - 0.00018] }, computed_compass_angle: 300 }),                    // other angle, 25 m away
  ];
  const ranked = rankPhotos({ data }, PLOT, NOW);
  assert.deepEqual(ranked.map((entry) => entry.id), ['100000000000001', '100000000000008', '100000000000002']);
  assert.equal(ranked[0].facesPlot, true);
  assert.equal(ranked[0].credit, 'amal_k');
  assert.equal(ranked[0].dateLabel, 'Mar 2026');
  assert.ok(ranked[0].distanceM > 15 && ranked[0].distanceM < 25);
  assert.equal(ranked[2].facesPlot, false);
  assert.deepEqual(rankPhotos(null, PLOT), []);
  assert.deepEqual(rankPhotos({ data: 'x' }, PLOT), []);
});

test('photographer names are cleaned before they are shown, and ids are digits only', () => {
  const [entry] = rankPhotos({ data: [photo({ creator: { username: '<img src=x onerror=alert(1)> Sam' } })] }, PLOT, NOW);
  assert.equal(entry.credit, 'img srcx onerroralert1 Sam');
  assert.doesNotMatch(entry.credit ?? '', /[<>=()]/);
  assert.equal(isMapillaryId('100000000000001'), true);
  for (const bad of ['', 'abc', '12', '1; DROP', '../1234567', 123456789]) assert.equal(isMapillaryId(bad), false, String(bad));
});

test('without a token nothing is asked of Mapillary, and a Mapillary failure just means no photos', async () => {
  assert.equal(mapillaryEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(mapillaryEnabled({ MAPILLARY_ACCESS_TOKEN: '  ' } as NodeJS.ProcessEnv), false);
  let calls = 0;
  const counting = (async () => { calls += 1; return new Response('{}'); }) as unknown as typeof fetch;
  assert.deepEqual(await findNearbyPhotos(PLOT, { env: {} as NodeJS.ProcessEnv, fetcher: counting }), []);
  assert.equal(calls, 0);
  const env = { MAPILLARY_ACCESS_TOKEN: 'MLY|123|abc' } as NodeJS.ProcessEnv;
  assert.deepEqual(await findNearbyPhotos(PLOT, { env, fetcher: (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch }), []);
  assert.deepEqual(await findNearbyPhotos(PLOT, { env, fetcher: (async () => { throw new Error('offline'); }) as unknown as typeof fetch }), []);
});

test('the search asks for a box around the plot with the token, and returns the ranked photos', async () => {
  let asked = '';
  const env = { MAPILLARY_ACCESS_TOKEN: 'MLY|123|abc' } as NodeJS.ProcessEnv;
  const found = await findNearbyPhotos(PLOT, { env, now: NOW, fetcher: (async (url: string) => { asked = String(url); return new Response(JSON.stringify({ data: [photo()] })); }) as unknown as typeof fetch });
  assert.match(asked, /^https:\/\/graph\.mapillary\.com\/images\?fields=.*thumb_1024_url.*&bbox=[\d.,-]+&limit=100&access_token=MLY%7C123%7Cabc$/);
  assert.equal(found.length, 1);
  assert.doesNotMatch(JSON.stringify(found), /MLY|access_token/);   // the token is never in what the page receives
});

test('the chosen photo is downloaded at 2048 px by the server; wrong ids, plain http, non-images and missing token give nothing', async () => {
  const env = { MAPILLARY_ACCESS_TOKEN: 'MLY|123|abc' } as NodeJS.ProcessEnv;
  const jpeg = Buffer.alloc(5_000, 1);
  const seen: string[] = [];
  const ok = (async (url: string) => {
    seen.push(String(url));
    if (String(url).startsWith('https://graph.mapillary.com/')) return new Response(JSON.stringify({ thumb_2048_url: 'https://93.184.216.34/photo.jpg', creator: { username: 'amal_k' }, captured_at: Date.UTC(2025, 5, 1) }));
    return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } });
  }) as unknown as typeof fetch;
  const got = await fetchPhotoForDesign('100000000000001', { env, fetcher: ok });
  assert.equal(got?.buffer.length, 5_000);
  assert.equal(got?.credit, 'amal_k');
  assert.equal(got?.dateLabel, 'Jun 2025');
  assert.match(seen[0], /graph\.mapillary\.com\/100000000000001\?fields=thumb_2048_url/);

  assert.equal(await fetchPhotoForDesign('../etc/passwd', { env, fetcher: ok }), null);
  assert.equal(await fetchPhotoForDesign('100000000000001', { env: {} as NodeJS.ProcessEnv, fetcher: ok }), null);
  const insecure = (async () => new Response(JSON.stringify({ thumb_2048_url: 'http://93.184.216.34/photo.jpg' }))) as unknown as typeof fetch;
  assert.equal(await fetchPhotoForDesign('100000000000001', { env, fetcher: insecure }), null);
  const internal = (async () => new Response(JSON.stringify({ thumb_2048_url: 'https://169.254.169.254/latest/meta-data' }))) as unknown as typeof fetch;
  assert.equal(await fetchPhotoForDesign('100000000000001', { env, fetcher: internal }), null);          // an internal address is never fetched
  const notImage = (async (url: string) => String(url).startsWith('https://graph') ? new Response(JSON.stringify({ thumb_2048_url: 'https://93.184.216.34/x' })) : new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
  assert.equal(await fetchPhotoForDesign('100000000000001', { env, fetcher: notImage }), null);
});

test('what the page sends: a picked nearby photo is a reference even before a tap, and a tap names its picture', () => {
  assert.equal(selectionToRequest(EMPTY_SELECTION).nearbyPhotoId, undefined);
  const picked = { ...EMPTY_SELECTION, source: 'nearby' as const, nearbyId: '100000000000001' };
  assert.equal(selectionToRequest(picked).nearbyPhotoId, '100000000000001');
  assert.equal(selectionToRequest(picked).targetSource, undefined);            // nothing tapped yet
  const tapped = selectionToRequest({ ...picked, kind: 'unit', x: 0.4, y: 0.6 });
  assert.equal(tapped.targetSource, 'nearby');
  assert.equal(tapped.streetViewFov, undefined);                              // Street View camera settings do not apply to a photo
  assert.equal(selectionToRequest({ ...EMPTY_SELECTION, source: 'photo', nearbyId: '100000000000001' }).nearbyPhotoId, undefined);
});

test('the design brief says the tap was on the nearby street photo, not on Street View', () => {
  const text = describeTarget({ targetKind: 'unit', targetSource: 'nearby', targetX: 0.5, targetY: 0.5, targetMarked: true }).join('\n');
  assert.match(text, /nearby street photo/);
  assert.doesNotMatch(text, /first Street View picture/);
});

test('server wiring: the id is validated, the photo is downloaded only by the server, and a failure drops the tap instead of failing the design', async () => {
  const uploads = await readFile(path.resolve(process.cwd(), 'src/routes/uploads.ts'), 'utf8');
  assert.match(uploads, /nearbyPhotoId: z\.string\(\)\.refine\(isMapillaryId\)\.optional\(\)/);
  assert.match(uploads, /delete architecture\.nearbyPhotoCredit/);                // the credit is the server's to set
  assert.match(uploads, /await fetchPhotoForDesign\(architecture\.nearbyPhotoId\)/);
  assert.match(uploads, /markerLabel\(architecture\.targetKind, 'nearby'\)/);
  assert.match(uploads, /if \(!attached\) \{\s*delete architecture\.nearbyPhotoId;/);
  const route = await readFile(path.resolve(process.cwd(), 'src/routes/architecture.ts'), 'utf8');
  assert.match(route, /router\.get\('\/photos', tryAuth/);
  assert.match(route, /MAPILLARY_ACCESS_TOKEN is not set' \} : \{\}/);            // only the owner is told what is missing
});

test('the page: ranked grid with a best match, tap on the chosen photo, credit and licence shown, and the token never in page code', async () => {
  const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /data-testid="nearby-photos"/);
  assert.match(card, /Best match/);
  assert.match(card, /Tap the exact place on the street photo/);
  assert.match(card, /CC BY-SA 4\.0/);
  assert.match(card, /Photo\{chosen\.credit \? ` by \$\{chosen\.credit\}` : ""\}/);       // the photographer is credited
  assert.match(card, /Choose another photo/);
  assert.match(card, /getNearbyPhotos\(latitude, longitude, controller\.signal\)/);
  assert.match(card, /if \(!found\.available\) loadNearby\(\)/);                           // only when Google Street View cannot be shown
  const walk = async (dir: string): Promise<string[]> => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))).flat();
  for (const file of (await walk(path.resolve(process.cwd(), '../aiwebvideo/src'))).filter((f) => /\.(tsx?|css)$/.test(f))) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /graph\.mapillary\.com|access_token=|MLY\|/, file);
    if (!file.endsWith('SiteStreetView.tsx')) assert.doesNotMatch(text, /MAPILLARY_ACCESS_TOKEN/, file);   // the name appears once, in the owner-only hint
  }
});
