import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import architectureRouter from '../src/routes/architecture.js';
import { architectureContext, composeStudioBrief } from '../src/lib/studio-direction.js';
import { fetchSiteImageryDetailed } from '../src/lib/site-imagery.js';
import {
  bearingDegrees, compassName, dateLabelOf, distanceMetres, fetchStreetViewMeta, fetchStreetViewSet, normalizeHeading, planStreetViews, streetViewImageUrl,
} from '../src/lib/street-view.js';

const KEY = 'TEST-KEY-do-not-leak-123';
const ENV = { ARCHITECTURE_MAPS_IMAGERY: '1', GOOGLE_MAPS_API_KEY: KEY } as NodeJS.ProcessEnv;
const PANO = 'CAoSLEFGMVFpcE5ocFZ6';
const PLOT = { latitude: 31.9005, longitude: 35.2 };                       // the panorama stands 0.0005 deg (about 55 m) SOUTH of the plot
const metaBody = (over: Record<string, unknown> = {}) => ({ status: 'OK', pano_id: PANO, date: '2017-02', copyright: '© Google', location: { lat: 31.9, lng: 35.2 }, ...over });
const jpeg = () => new Response(new Uint8Array(2000).fill(7), { headers: { 'content-type': 'image/jpeg' } });

function googleStub(options: { meta?: unknown; failHeading?: number } = {}) {
  const urls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('/streetview/metadata')) return Response.json(options.meta ?? metaBody());
    if (url.includes('/streetview?')) return options.failHeading !== undefined && url.includes(`heading=${options.failHeading}&`) ? new Response('no', { status: 404 }) : jpeg();
    if (url.includes('/staticmap')) return new Response(new Uint8Array(3000), { headers: { 'content-type': 'image/png' } });
    throw new Error(`unexpected ${url}`);
  };
  return { fetcher, urls };
}

test('bearing and distance are real compass geometry', () => {
  const o = { latitude: 10, longitude: 20 };
  assert.equal(bearingDegrees(o, { latitude: 11, longitude: 20 }), 0);
  assert.equal(bearingDegrees(o, { latitude: 10, longitude: 21 }), 90);
  assert.equal(bearingDegrees(o, { latitude: 9, longitude: 20 }), 180);
  assert.equal(bearingDegrees(o, { latitude: 10, longitude: 19 }), 270);
  assert.ok(Math.abs(distanceMetres(o, { latitude: 11, longitude: 20 }) - 111_195) < 300);
  assert.equal(normalizeHeading(-60), 300);
  assert.equal(normalizeHeading(365), 5);
  assert.equal(compassName(0), 'N'); assert.equal(compassName(95), 'E'); assert.equal(compassName(350), 'N'); assert.equal(compassName(225), 'SW');
  assert.equal(dateLabelOf('2017-02'), 'Feb 2017'); assert.equal(dateLabelOf('2024'), '2024'); assert.equal(dateLabelOf('x'), null); assert.equal(dateLabelOf(undefined), null);
});

test('a Street View picture is addressed by panorama (so every view agrees), with safe, clamped parameters', () => {
  const url = streetViewImageUrl({ panoId: PANO, heading: 725, pitch: 99, fov: 500 }, 'a b');
  assert.match(url, /size=640x480&pano=CAoSLEFGMVFpcE5ocFZ6&heading=5&pitch=70&fov=110&source=outdoor&key=a%20b$/);
  assert.doesNotMatch(url, /location=/);
});

test('the camera faces the plot by default, shows both neighbours, and obeys the customer\'s chosen direction', () => {
  const auto = planStreetViews({ headingToPlot: 10 });
  assert.deepEqual(auto.map((s) => s.heading), [10, 310, 70]);
  assert.deepEqual(auto.map((s) => s.role), ['front', 'left', 'right']);
  assert.match(auto[0].description, /straight on/);
  const chosen = planStreetViews({ headingToPlot: 10 }, 90);
  assert.deepEqual(chosen.map((s) => s.heading), [90, 30, 150]);
  assert.match(chosen[0].description, /looking E/);
  assert.equal(planStreetViews({ headingToPlot: null })[0].heading, 0);       // standing on the spot: no bearing, so it does not pretend there is one
});

test('the nearest outdoor panorama is found, aimed at the plot, dated, and the key only ever goes to Google', async () => {
  const { fetcher, urls } = googleStub();
  const meta = await fetchStreetViewMeta(PLOT, { env: ENV, fetcher });
  assert.ok(meta);
  assert.equal(meta.panoId, PANO);
  assert.equal(meta.dateLabel, 'Feb 2017');
  assert.equal(meta.headingToPlot, 0);                                         // the panorama is south of the plot: look north
  assert.ok(Math.abs(meta.distanceM - 55.6) < 1);
  assert.match(urls[0], /radius=80&source=outdoor&key=TEST-KEY-do-not-leak-123$/);
  assert.ok(!JSON.stringify(meta).includes(KEY));
});

test('no coverage, bad answers, outages and a switched-off feature all mean "no Street View", never an error', async () => {
  assert.equal(await fetchStreetViewMeta(PLOT, { env: ENV, fetcher: googleStub({ meta: { status: 'ZERO_RESULTS' } }).fetcher }), null);
  assert.equal(await fetchStreetViewMeta(PLOT, { env: ENV, fetcher: googleStub({ meta: metaBody({ pano_id: '../../etc/passwd' }) }).fetcher }), null);
  assert.equal(await fetchStreetViewMeta(PLOT, { env: ENV, fetcher: googleStub({ meta: metaBody({ location: undefined }) }).fetcher }), null);
  assert.equal(await fetchStreetViewMeta(PLOT, { env: ENV, fetcher: async () => { throw new Error('offline'); } }), null);
  assert.equal(await fetchStreetViewMeta(PLOT, { env: ENV, fetcher: async () => new Response('x', { status: 500 }) }), null);
  const never: typeof fetch = async () => { throw new Error('must not be called'); };
  assert.equal(await fetchStreetViewMeta(PLOT, { env: {}, fetcher: never }), null);
  assert.equal(await fetchStreetViewMeta(PLOT, { env: { ARCHITECTURE_MAPS_IMAGERY: '1' }, fetcher: never }), null);
  assert.equal(await fetchStreetViewSet(PLOT, { env: {}, fetcher: never }), null);
});

test('the design gets three views from ONE panorama, labelled with when they were taken and where they look', async () => {
  const { fetcher, urls } = googleStub();
  const set = await fetchStreetViewSet(PLOT, { env: ENV, fetcher });
  assert.ok(set);
  assert.equal(set.images.length, 3);
  assert.match(set.images[0].label, /^STREET VIEW \(Google, captured Feb 2017\) — looking at the plot straight on, facing N$/);
  assert.match(set.images[1].label, /the street and neighbours to the left, facing NW$/);
  assert.match(set.images[2].label, /to the right, facing NE$/);
  const imageUrls = urls.filter((url) => url.includes('/streetview?'));
  assert.equal(imageUrls.length, 3);
  assert.ok(imageUrls.every((url) => url.includes(`pano=${PANO}`)), 'every view comes from the same panorama');
  assert.deepEqual(imageUrls.map((url) => /heading=(\d+)/.exec(url)![1]), ['0', '300', '60']);
  // the customer looked east instead
  const east = await fetchStreetViewSet(PLOT, { env: ENV, fetcher: googleStub().fetcher, heading: 90 });
  assert.match(east!.images[0].label, /looking E, facing E$/);
  // one view failing does not lose the others
  const partial = await fetchStreetViewSet(PLOT, { env: ENV, fetcher: googleStub({ failHeading: 300 }).fetcher });
  assert.equal(partial!.images.length, 2);
});

test('site imagery returns the satellite view, the Street View set, and which panorama they came from', async () => {
  const result = await fetchSiteImageryDetailed(PLOT, { env: ENV, fetcher: googleStub().fetcher, heading: null });
  assert.equal(result.images.length, 4);
  assert.equal(result.images[0].label, 'Satellite view of the site');
  assert.equal(result.streetView?.dateLabel, 'Feb 2017');
  const none = await fetchSiteImageryDetailed(PLOT, { env: ENV, fetcher: googleStub({ meta: { status: 'ZERO_RESULTS' } }).fetcher });
  assert.equal(none.images.length, 1);
  assert.equal(none.streetView, null);
});

test('the AI is told what the Street View photos are, how old they are, and that the customer\'s own words win', () => {
  const lines = architectureContext({ location: 'Ramallah', streetViewViews: 3, streetViewDate: 'Feb 2017', streetViewHeading: 90 });
  assert.match(lines, /Google Street View: 3 real street-level photos of this exact street are attached \(captured Feb 2017\), the first looking straight at the plot/);
  assert.match(lines, /customer wins/);
  assert.match(lines, /compass heading 90 degrees/);
  assert.doesNotMatch(architectureContext({ location: 'Ramallah' }), /Street View/);
  assert.doesNotMatch(architectureContext({ location: 'Ramallah', streetViewViews: 0 }), /Street View/);
  const brief = composeStudioBrief({ studioKind: 'architecture', userBrief: 'a clothes shop here', architecture: { location: 'Ramallah', streetViewViews: 3, streetViewDate: 'Feb 2017' } });
  assert.match(brief, /marked STREET VIEW/);
  assert.match(brief, /Never remove or invent neighbouring buildings/);
  assert.ok(brief.indexOf('captured Feb 2017') < brief.indexOf('a clothes shop here'), 'the customer\'s own words still come last');
});

test('the upload route lets the server alone say whether Street View was used', async () => {
  const route = await readFile(path.resolve(process.cwd(), 'src/routes/uploads.ts'), 'utf8');
  assert.match(route, /streetViewHeading: z\.number\(\)\.min\(0\)\.max\(360\)\.optional\(\)/);
  assert.match(route, /delete architecture\.streetViewDate; delete architecture\.streetViewViews; delete architecture\.targetMarked;/);
  assert.ok(route.indexOf('delete architecture.streetViewDate') < route.indexOf('fetchSiteImageryDetailed({'), 'discarded before the server sets its own values');
  assert.match(route, /heading: architecture\.streetViewHeading, pitch: architecture\.streetViewPitch, fov: architecture\.streetViewFov/);
});

// ---------------------------------------------------------------- the routes, over real HTTP, with Google stubbed
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
function withGoogle(stub: ReturnType<typeof googleStub> | null) {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => (String(input).includes('maps.googleapis.com') && stub ? stub.fetcher(input, init) : realFetch(input, init))) as typeof fetch;
}

test('route: when Street View is off the page is told so, and nothing is fetched', async () => {
  delete process.env.ARCHITECTURE_MAPS_IMAGERY; delete process.env.GOOGLE_MAPS_API_KEY;
  withGoogle(googleStub());
  const res = await realFetch(`${base}/street-view?lat=31.9005&lng=35.2`);
  assert.deepEqual(await res.json(), { enabled: false, available: false });
  assert.equal((await realFetch(`${base}/street-view/image?pano=${PANO}&heading=10`)).status, 404);
});

test('route: with coverage the page gets the panorama, its age and the aim, and the key never appears', async () => {
  process.env.ARCHITECTURE_MAPS_IMAGERY = '1'; process.env.GOOGLE_MAPS_API_KEY = KEY;
  withGoogle(googleStub());
  const res = await realFetch(`${base}/street-view?lat=31.9005&lng=35.2`);
  const text = await res.text();
  assert.equal(res.status, 200);
  const body = JSON.parse(text);
  assert.equal(body.available, true); assert.equal(body.panoId, PANO); assert.equal(body.dateLabel, 'Feb 2017'); assert.equal(body.headingToPlot, 0);
  assert.ok(body.ageYears > 5, 'a 2017 photo is reported as old');
  assert.ok(!text.includes(KEY));
  const picture = await realFetch(`${base}/street-view/image?pano=${PANO}&heading=45`);
  assert.equal(picture.status, 200);
  assert.equal(picture.headers.get('content-type'), 'image/jpeg');
  assert.equal(picture.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await picture.arrayBuffer()).byteLength, 2000);
  withGoogle(googleStub({ meta: { status: 'ZERO_RESULTS' } }));
  assert.deepEqual(await (await realFetch(`${base}/street-view?lat=1&lng=1`)).json(), { enabled: true, available: false });
});

test('route: bad input is refused before Google is ever called', async () => {
  process.env.ARCHITECTURE_MAPS_IMAGERY = '1'; process.env.GOOGLE_MAPS_API_KEY = KEY;
  const stub = googleStub();
  withGoogle(stub);
  for (const url of ['/street-view?lat=abc&lng=1', '/street-view?lat=99&lng=1', '/street-view', `/street-view/image?pano=../../x&heading=1`, `/street-view/image?pano=${PANO}&heading=999`, `/street-view/image?heading=1`]) {
    assert.equal((await realFetch(`${base}${url}`)).status, 400, url);
  }
  assert.equal(stub.urls.length, 0);
});

test('route: looking is rate limited so it cannot run up Google\'s bill', async () => {
  process.env.ARCHITECTURE_MAPS_IMAGERY = '1'; process.env.GOOGLE_MAPS_API_KEY = KEY;
  withGoogle(googleStub());
  const statuses: number[] = [];
  for (let i = 0; i < 160; i += 1) statuses.push((await realFetch(`${base}/street-view/image?pano=${PANO}&heading=${i % 360}`)).status);
  assert.ok(statuses.includes(429), 'limited');
  assert.ok(statuses.indexOf(429) >= 100, 'but ordinary use is never blocked');
});
