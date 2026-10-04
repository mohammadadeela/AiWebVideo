import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinatesFromAppleUrl, coordinatesFromOsmUrl, mapsUrlsInHtml, parseTypedCoordinates, resolveMapsInput, unwrapConsentUrl, type MapsDeps, type PageFetch } from '../src/lib/maps-resolve.js';

const PLACE = 'https://www.google.com/maps/place/Old+City+Shop/@31.5326,35.0998,17z/data=!3m1!4b1!4m6!3m5!1s0x1502c5f0d3b0b5b5:0x1a2b3c!8m2!3d31.5321!4d35.0912!16s%2Fg%2F11abc';
const near = (value: number | undefined, expected: number, tolerance = 0.00002) => assert.ok(value !== undefined && Math.abs(value - expected) <= tolerance, `${value} is not ${expected}`);
const deps = (script: Record<string, PageFetch>, extra: Partial<MapsDeps> = {}): MapsDeps & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, fetchPage: async (url) => { calls.push(url); return script[url] ?? { status: 404, location: null, body: '' }; }, ...extra };
};
const never = deps({});

test('a long Google link gives the place PIN, not where the map was centred', async () => {
  const result = await resolveMapsInput(PLACE, never);
  assert.equal(result.precision, 'pin');
  near(result.latitude, 31.5321); near(result.longitude, 35.0912);
  assert.equal(result.label, 'Old City Shop');
  assert.equal(never.calls.length, 0, 'a long link needs no request at all');
});

test('a link with only the map view is reported as a VIEW so the person can be asked for the exact pin', async () => {
  const result = await resolveMapsInput('https://www.google.com/maps/@31.5326,35.0998,17z', never);
  assert.equal(result.precision, 'view');
  near(result.latitude, 31.5326);
});

test('explicit q= and query= coordinates are pins', async () => {
  for (const link of ['https://www.google.com/maps?q=31.5321,35.0912', 'https://www.google.com/maps/search/?api=1&query=31.5321%2C35.0912', 'https://maps.google.com/?ll=31.5321,35.0912&z=18']) {
    const result = await resolveMapsInput(link, never);
    assert.equal(result.precision, 'pin', link);
    near(result.latitude, 31.5321); near(result.longitude, 35.0912);
  }
});

test('a short link is followed to the long link and its pin', async () => {
  const d = deps({ 'https://maps.app.goo.gl/AbC123': { status: 302, location: PLACE, body: '' } });
  const result = await resolveMapsInput('https://maps.app.goo.gl/AbC123', d);
  assert.equal(result.precision, 'pin');
  near(result.latitude, 31.5321);
  assert.ok(result.trace.some((line) => /following maps\.app\.goo\.gl/.test(line)));
});

test('a redirect through Google\'s consent page is unwrapped (this is what a server in Europe often gets)', async () => {
  const consent = `https://consent.google.com/m?continue=${encodeURIComponent(PLACE)}&gl=DE&m=0&pc=m&uxe=eomtm&cm=2&hl=en`;
  assert.equal(unwrapConsentUrl(consent), PLACE);
  const d = deps({ 'https://maps.app.goo.gl/AbC123': { status: 302, location: consent, body: '' } });
  const result = await resolveMapsInput('https://maps.app.goo.gl/AbC123', d);
  assert.equal(result.precision, 'pin');
  near(result.longitude, 35.0912);
  assert.ok(result.trace.some((line) => /consent/.test(line)));
});

test('a short link answered with a PAGE instead of a redirect still gives the point (meta refresh, script, canonical)', async () => {
  const bodies = [
    `<html><head><meta http-equiv="refresh" content="0;url=${PLACE.replace(/&/g, '&amp;')}"></head></html>`,
    `<script>window.APP_INITIALIZATION_STATE=[["${PLACE.replace(/\//g, '\\/').replace(/=/g, '\\u003d')}"]]</script>`,
    `<link rel="canonical" href="${PLACE}">`,
  ];
  for (const body of bodies) {
    const d = deps({ 'https://maps.app.goo.gl/Page1': { status: 200, location: null, body } });
    const result = await resolveMapsInput('https://maps.app.goo.gl/Page1', d);
    assert.equal(result.precision, 'pin', body.slice(0, 40));
    near(result.latitude, 31.5321);
  }
});

test('the point can also be read from the link preview\'s static map image', async () => {
  const body = '<meta property="og:image" content="https://maps.google.com/maps/api/staticmap?center=31.532100%2C35.091200&zoom=15&size=256x256">';
  assert.deepEqual(mapsUrlsInHtml(body).length > 0, true);
  const d = deps({ 'https://maps.app.goo.gl/Img': { status: 200, location: null, body } });
  const result = await resolveMapsInput('https://maps.app.goo.gl/Img', d);
  assert.equal(result.precision, 'pin');
  near(result.latitude, 31.5321); near(result.longitude, 35.0912);
});

test('a short link that goes nowhere ends cleanly (no endless loop)', async () => {
  const loop = deps({ 'https://maps.app.goo.gl/Loop': { status: 302, location: 'https://maps.app.goo.gl/Loop', body: '' } });
  const result = await resolveMapsInput('https://maps.app.goo.gl/Loop', loop);
  assert.equal(result.precision, 'none');
  assert.ok(loop.calls.length <= 6);
});

test('coordinates typed or pasted directly are accepted: decimal, with letters, degrees-minutes-seconds, geo:', () => {
  const cases: Array<[string, number, number]> = [
    ['31.5321, 35.0912', 31.5321, 35.0912],
    ['31.5321 35.0912', 31.5321, 35.0912],
    ['-33.8688, 151.2093', -33.8688, 151.2093],
    ['33.8688 S, 151.2093 E', -33.8688, 151.2093],
    ['40.7128 N 74.0060 W', 40.7128, -74.006],
    ['geo:31.5321,35.0912', 31.5321, 35.0912],
    ['31°31\'55.6"N 35°05\'28.3"E', 31.532111, 35.091194],
    ['35°05\'28.3"E 31°31\'55.6"N', 31.532111, 35.091194],
  ];
  for (const [text, lat, lng] of cases) {
    const parsed = parseTypedCoordinates(text);
    assert.ok(parsed, text);
    near(parsed!.latitude, lat, 0.00002); near(parsed!.longitude, lng, 0.00002);
  }
});

test('things that are not coordinates are left alone (a house number is not a point)', () => {
  for (const text of ['12, 34', 'Main Street 12', 'Old City, Hebron', '', '999.5, 12.5', '31.5321', '31.5321, 35.0912, 14']) assert.equal(parseTypedCoordinates(text), null, JSON.stringify(text));
});

test('OpenStreetMap and Apple Maps links give a pin or a view as appropriate', () => {
  assert.equal(coordinatesFromOsmUrl(new URL('https://www.openstreetmap.org/?mlat=31.5321&mlon=35.0912#map=18/31.5330/35.0920'))?.precision, 'pin');
  near(coordinatesFromOsmUrl(new URL('https://www.openstreetmap.org/?mlat=31.5321&mlon=35.0912#map=18/31.5330/35.0920'))?.latitude, 31.5321);
  assert.equal(coordinatesFromOsmUrl(new URL('https://www.openstreetmap.org/#map=17/31.5330/35.0920'))?.precision, 'view');
  assert.equal(coordinatesFromAppleUrl(new URL('https://maps.apple.com/?ll=31.5321,35.0912&q=Shop'))?.precision, 'pin');
  assert.equal(coordinatesFromAppleUrl(new URL('https://maps.apple.com/?address=Main+Street')), null);
});

test('typed coordinates and OSM/Apple links resolve without any request', async () => {
  for (const input of ['31.5321, 35.0912', 'https://www.openstreetmap.org/?mlat=31.5321&mlon=35.0912', 'https://maps.apple.com/?ll=31.5321,35.0912']) {
    const result = await resolveMapsInput(input, never);
    assert.equal(result.precision, 'pin', input);
    near(result.latitude, 31.5321);
  }
  assert.equal(never.calls.length, 0);
});

test('an address becomes a point only with a geocoder; otherwise it is kept as text and the person is told', async () => {
  const withGeocoder = deps({}, { geocode: async () => ({ latitude: 31.5, longitude: 35.1, label: 'Hebron, West Bank' }) });
  const found = await resolveMapsInput('Old City, Hebron', withGeocoder);
  assert.equal(found.precision, 'pin'); assert.equal(found.label, 'Hebron, West Bank');
  const without = await resolveMapsInput('Old City, Hebron', never);
  assert.equal(without.precision, 'none'); assert.equal(without.label, 'Old City, Hebron');
  assert.ok(without.trace.some((line) => /no geocoder/.test(line)));
});

test('links that are not maps are refused, and so is a redirect that leaves Google', async () => {
  await assert.rejects(() => resolveMapsInput('https://evil.example/maps/@1.5,2.5', never), /Google Maps link/);
  const d = deps({ 'https://maps.app.goo.gl/Out': { status: 302, location: 'https://evil.example/x', body: '' } });
  await assert.rejects(() => resolveMapsInput('https://maps.app.goo.gl/Out', d), /outside Google Maps/);
});

test('the customer sees the exact spot: coordinates, an embedded map of the point, and an honest imagery message; typed coordinates are accepted', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /data-testid="site-preview"/);
  // the embedded map of the exact point is still there: it is the corner map of the Street View card, and the whole card when there is no Street View
  assert.match(form, /<SiteStreetView latitude=\{site\.latitude\} longitude=\{site\.longitude\} mapSrc=\{mapPreviewUrl\(site\.latitude, site\.longitude\)\}/);
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.equal((card.match(/<iframe title="The exact spot on the map" src=\{mapSrc\}/g) ?? []).length, 2);
  assert.match(form, /Is this the right spot\?/);
  assert.match(form, /site\.latitude\.toFixed\(6\), \{site\.longitude\.toFixed\(6\)\}|\{site\.latitude\.toFixed\(6\)\}, \{site\.longitude\.toFixed\(6\)\}/);
  assert.match(form, /site\.imageryAvailable \? "Satellite and street views of this spot are used for the design\." : "For a design that matches your plot exactly, add a screenshot of it/);
  assert.match(form, /Open this spot in Google Maps/);                              // a fallback if the embedded map does not show
  assert.match(form, /looksLikeCoordinates\(pasted\)/);                              // typed or pasted coordinates are resolved at once
  assert.match(form, /placeholder="Google Maps link, address or coordinates"/);
  const preview = await fe('lib/mapPreview.ts');
  assert.match(preview, /https:\/\/www\.google\.com\/maps\?q=\$\{latitude\.toFixed\(6\)\},\$\{longitude\.toFixed\(6\)\}&z=18&output=embed/);
  // the same rule as the server: a house number is not a point
  const { looksLikeCoordinates } = await import('../../aiwebvideo/src/lib/mapPreview.js');
  for (const yes of ['31.5321, 35.0912', '31.5321 35.0912', '33.8688 S, 151.2093 E', "31°31'55.6\"N 35°05'28.3\"E", 'geo:31.5,35.1']) assert.equal(looksLikeCoordinates(yes), true, yes);
  for (const no of ['12, 34', 'Main Street 12', 'Old City, Hebron', 'https://maps.app.goo.gl/x', '']) assert.equal(looksLikeCoordinates(no), false, no);
});

test('the admin can check any product or map link and see every step', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const admin = await readFile(path.resolve(process.cwd(), 'src/routes/admin.ts'), 'utf8');
  assert.match(admin, /router\.post\('\/link-check'/);
  assert.match(admin, /resolveMapsInput\(link, defaultMapsDeps, trace\)/);
  assert.match(admin, /readProductReference\(link, undefined, trace\)/);
  const page = await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/pages/AdminPage.tsx'), 'utf8');
  assert.match(page, /<LinkChecker \/>/);
  const checker = await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/components/admin/LinkChecker.tsx'), 'utf8');
  assert.match(checker, /Copy report/);
  assert.match(checker, /aria-label="Steps"/);
});
