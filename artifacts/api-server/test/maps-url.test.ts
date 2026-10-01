import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coordinatesFromMapsUrl, isGoogleMapsUrl } from '../src/lib/maps-url.js';

const at = (raw: string) => coordinatesFromMapsUrl(new URL(raw));

test('a place link uses the PIN, not the map view centre that happens to come first in the link', () => {
  // viewport centre 31.5300,35.0900 (where the map was panned); the pin is at 31.5321,35.0912
  const link = 'https://www.google.com/maps/place/Old+City+Shop/@31.5300,35.0900,17z/data=!3m1!4b1!4m6!3m5!1s0x1:0x2!8m2!3d31.5321!4d35.0912!16s%2Fg%2F1';
  assert.deepEqual(at(link), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
});

test('with several coordinate pairs in the data blob the place pin after "!8m2" wins, else the last one', () => {
  assert.deepEqual(at('https://www.google.com/maps/place/X/@1,2,15z/data=!4m5!3d10.5!4d20.5!8m2!3d11.25!4d21.25'), { latitude: 11.25, longitude: 21.25, precision: 'pin' });
  assert.deepEqual(at('https://www.google.com/maps/dir/A/B/data=!3d10.5!4d20.5!1m1!3d12.5!4d22.5'), { latitude: 12.5, longitude: 22.5, precision: 'pin' });
});

test('explicit coordinates in the usual query shapes are pins', () => {
  assert.deepEqual(at('https://www.google.com/maps?q=31.5321,35.0912'), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
  assert.deepEqual(at('https://www.google.com/maps/search/?api=1&query=31.5321%2C35.0912'), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
  assert.deepEqual(at('https://maps.google.com/?q=loc:31.5321,35.0912'), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
  assert.deepEqual(at('https://www.google.com/maps?ll=-33.8688,151.2093&z=15'), { latitude: -33.8688, longitude: 151.2093, precision: 'pin' });
  assert.deepEqual(at('https://www.google.com/maps/place/31.5321,35.0912/'), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
  assert.deepEqual(at('https://www.google.com/maps/search/31.5321,+35.0912'), { latitude: 31.5321, longitude: 35.0912, precision: 'pin' });
});

test('a link that only carries the map view is used, but flagged as approximate', () => {
  assert.deepEqual(at('https://www.google.com/maps/@31.53,35.09,18z'), { latitude: 31.53, longitude: 35.09, precision: 'view' });
});

test('links without coordinates, and impossible coordinates, are not guessed', () => {
  assert.equal(at('https://www.google.com/maps/place/Some+Cafe'), null);
  assert.equal(at('https://www.google.com/maps?q=Some+Cafe'), null);
  assert.equal(at('https://www.google.com/maps?q=95.5,35.0'), null);
});

test('only Google Maps hosts (including both short-link hosts) are accepted', () => {
  assert.equal(isGoogleMapsUrl('https://maps.app.goo.gl/abc123'), true);
  assert.equal(isGoogleMapsUrl('https://goo.gl/maps/abc123'), true);
  assert.equal(isGoogleMapsUrl('https://goo.gl/other'), false);
  assert.equal(isGoogleMapsUrl('https://www.google.com/maps/place/x'), true);
  assert.equal(isGoogleMapsUrl('https://evil.test/maps/place/x'), false);
  assert.equal(isGoogleMapsUrl('http://169.254.169.254/'), false);
});

test('the form warns when a link only carries the map view, and the route reports the precision', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const form = await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/components/chat/WebsiteBriefForm.tsx'), 'utf8');
  assert.match(form, /site\?\.precision === "view"/);
  assert.match(form, /not an exact pin/);
  const route = await readFile(path.resolve(process.cwd(), 'src/routes/architecture.ts'), 'utf8');
  assert.match(route, /precision: position\?\.precision \?\? 'none'/);
});
