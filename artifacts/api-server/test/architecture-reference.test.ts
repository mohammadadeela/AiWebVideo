import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveArchitectureReference } from '../src/lib/architecture-reference.js';

test('shared Maps link resolves with GET and keeps satellite at the submitted coordinates', { concurrency: false }, async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_MAPS_STATIC_API_KEY;
  const called: string[] = [];
  process.env.GOOGLE_MAPS_STATIC_API_KEY = 'test-key';
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    called.push(url);
    if (url.startsWith('https://maps.app.goo.gl/')) {
      assert.equal(init?.method, 'GET');
      assert.equal(init?.redirect, 'manual');
      return new Response(null, { status: 302, headers: { location: 'https://www.google.com/maps/place/Test/@31.9000000,35.2000000,17z' } });
    }
    if (url.startsWith('https://www.google.com/maps/place/Test/')) return new Response('', { status: 200 });
    if (url.includes('/streetview/metadata')) return new Response(JSON.stringify({ status: 'OK' }), { headers: { 'content-type': 'application/json' } });
    if (url.includes('/streetview?')) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
    if (url.includes('/staticmap?')) return new Response(new Uint8Array([4, 5, 6]), { headers: { 'content-type': 'image/jpeg' } });
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;
  try {
    const result = await resolveArchitectureReference('https://maps.app.goo.gl/location');
    assert.equal(result.lat, 31.9);
    assert.equal(result.lng, 35.2);
    assert.equal(result.source, 'satellite');
    assert.deepEqual([...result.buffer], [4, 5, 6]);
    assert.deepEqual([...result.streetBuffer!], [1, 2, 3]);
    const staticUrl = new URL(called.find((value) => value.includes('/staticmap?'))!);
    assert.equal(staticUrl.searchParams.get('center'), '31.9000000,35.2000000');
    assert.equal(staticUrl.searchParams.get('format'), 'jpg');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_STATIC_API_KEY;
    else process.env.GOOGLE_MAPS_STATIC_API_KEY = previousKey;
  }
});

test('shared Maps link never follows a redirect to an unrelated host', { concurrency: false }, async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GOOGLE_MAPS_STATIC_API_KEY;
  process.env.GOOGLE_MAPS_STATIC_API_KEY = 'test-key';
  const called: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    called.push(url);
    if (url.startsWith('https://maps.app.goo.gl/')) return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    throw new Error('Unexpected network request');
  }) as typeof fetch;
  try {
    await assert.rejects(resolveArchitectureReference('https://maps.app.goo.gl/untrusted'), /resolvable place or coordinate/);
    assert.equal(called.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GOOGLE_MAPS_STATIC_API_KEY;
    else process.env.GOOGLE_MAPS_STATIC_API_KEY = previousKey;
  }
});
