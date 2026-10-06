import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyNetworkError, failureMessage, failureText, kindForStatus, userMessage } from '../../aiwebvideo/src/lib/userErrors';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const RAW = /failed to fetch|load failed|networkerror|signal timed out|operation was aborted|unexpected token|undefined|cannot read|\b[45]\d\d\b|stack|ECONN/i;

test('every kind of trouble has one calm sentence that says what to do and never shows browser or status wording', () => {
  const kinds = ['offline', 'timeout', 'network', 'session', 'credits', 'forbidden', 'missing', 'conflict', 'too_large', 'file_type', 'invalid', 'rate_limited', 'busy', 'server', 'unknown'] as const;
  const seen = new Set<string>();
  for (const kind of kinds) {
    const text = failureMessage(kind);
    assert.ok(text.length > 25 && /[.]$/.test(text), kind);
    assert.doesNotMatch(text, RAW, kind);
    seen.add(text);
  }
  assert.equal(seen.size, kinds.length, 'each kind reads differently');
});

test('a reply with no words of its own is explained from its status', () => {
  const cases: Array<[number, string]> = [[401, 'session'], [402, 'credits'], [403, 'forbidden'], [404, 'missing'], [408, 'timeout'], [409, 'conflict'], [413, 'too_large'], [415, 'file_type'], [422, 'invalid'], [429, 'rate_limited'], [500, 'server'], [502, 'busy'], [503, 'busy'], [504, 'busy']];
  for (const [status, kind] of cases) {
    assert.equal(kindForStatus(status), kind, String(status));
    assert.equal(failureText({}, status, 'fallback'), failureMessage(kind as never), String(status));
  }
  // a plain 400 keeps the caller's own sentence, which knows what was being attempted
  assert.equal(failureText({}, 400, 'Your drawing could not be read.'), 'Your drawing could not be read.');
  assert.equal(kindForStatus(400), null);
});

test('the server\'s own sentence always wins over the generic one', () => {
  assert.equal(failureText({ error: 'That coupon has expired.' }, 400, 'fallback'), 'That coupon has expired.');
  assert.equal(failureText({ error: '  Photos must be under 10 MB.  ' }, 413, 'fallback'), 'Photos must be under 10 MB.');
  assert.equal(failureText({ error: '' }, 500, 'fallback'), failureMessage('server'));
  assert.equal(failureText(null, 502, 'fallback'), failureMessage('busy'));
});

test('connection failures are told apart: offline, timed out, unreachable, and a deliberate cancel stays a cancel', () => {
  assert.equal(classifyNetworkError(new TypeError('Failed to fetch'), true)?.code, 'NETWORK_FAILED');
  assert.equal(classifyNetworkError(new TypeError('Failed to fetch'), false)?.code, 'NETWORK_OFFLINE');
  const timeout = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
  assert.equal(classifyNetworkError(timeout, true)?.code, 'NETWORK_TIMEOUT');
  assert.equal(classifyNetworkError(timeout, false)?.code, 'NETWORK_OFFLINE');
  const cancelled = Object.assign(new Error('aborted'), { name: 'AbortError' });
  assert.equal(classifyNetworkError(cancelled, true), null);
  assert.equal(classifyNetworkError(new Error('plain bug'), true), null);
  for (const failure of [classifyNetworkError(new TypeError('x'), true), classifyNetworkError(timeout, true), classifyNetworkError(new TypeError('x'), false)]) assert.doesNotMatch(failure!.message, RAW);
});

test('whatever is caught, a customer never reads browser or developer wording', () => {
  assert.equal(userMessage(new TypeError('Failed to fetch')), failureMessage('network'));
  assert.equal(userMessage(new SyntaxError('Unexpected token < in JSON at position 0'), 'We could not read the reply.'), 'We could not read the reply.');
  assert.equal(userMessage(new Error("Cannot read properties of undefined (reading 'x')")), failureMessage('unknown'));
  assert.equal(userMessage('boom'), failureMessage('unknown'));
  assert.equal(userMessage(Object.assign(new Error('Enter a valid website address.'), { name: 'ApiError' })), 'Enter a valid website address.');
  assert.equal(userMessage(new Error('Add at least one photo.')), 'Add at least one photo.');
});

test('every API call goes through the friendly wrapper and no call can show raw "Failed to fetch"', async () => {
  const client = await fe('lib/api-client.ts');
  assert.equal((client.match(/await fetch\(/g) ?? []).length, 1, 'only safeFetch itself calls fetch');
  assert.match(client, /export async function safeFetch/);
  assert.match(client, /classifyNetworkError\(error\)/);
  assert.equal((client.match(/new ApiError\(data\.error \|\|/g) ?? []).length, 0, 'no reply is shown with a blank or generic message');
  assert.ok((client.match(/failureText\(data, res\.status/g) ?? []).length >= 13);
  const studio = await fe('lib/studio-api.ts');
  assert.doesNotMatch(studio, /await fetch\(/);
  assert.match(studio, /failureText\(data, response\.status, fallback\)/);
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /err\.code\?\.startsWith\("NETWORK_"\)/);
});

test('the offline banner is mounted once at the app root and reports both directions', async () => {
  const app = await fe('App.tsx');
  assert.match(app, /<ConnectionBanner \/>/);
  const banner = await fe('components/system/ConnectionBanner.tsx');
  assert.match(banner, /addEventListener\("offline"/);
  assert.match(banner, /addEventListener\("online"/);
  assert.match(banner, /role="status"/);
  assert.match(banner, /Back online/);
});

test('the real API client turns a dropped connection and empty server replies into plain sentences', async () => {
  // the browser-only settings object does not exist under Node; the client only reads optional keys from it
  (import.meta as unknown as { env?: Record<string, string> }).env ??= {};
  const { request, ApiError } = await import('../../aiwebvideo/src/lib/api-client');
  const realFetch = globalThis.fetch;
  try {
    // the connection drops
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
    await assert.rejects(() => request('/api/anything'), (error: unknown) => error instanceof ApiError && error.status === 0 && error.code === 'NETWORK_FAILED' && !RAW.test(error.message));
    // the request times out
    globalThis.fetch = (async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); }) as typeof fetch;
    await assert.rejects(() => request('/api/anything'), (error: unknown) => error instanceof ApiError && error.code === 'NETWORK_TIMEOUT' && /longer than expected/.test(error.message));
    // the person's own cancel is not an error to explain
    globalThis.fetch = (async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); }) as typeof fetch;
    await assert.rejects(() => request('/api/anything'), (error: unknown) => (error as Error).name === 'AbortError');
    // a proxy answers with a web page instead of our JSON
    for (const [status, pattern] of [[502, /busy or restarting/], [504, /busy or restarting/], [413, /too large/], [429, /a little fast/], [401, /session has ended/], [500, /our side/]] as const) {
      globalThis.fetch = (async () => new Response('<html>Bad Gateway</html>', { status, headers: { 'content-type': 'text/html' } })) as typeof fetch;
      await assert.rejects(() => request('/api/anything'), (error: unknown) => error instanceof ApiError && error.status === status && pattern.test(error.message), String(status));
    }
    // our own JSON error keeps its own words
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'That code did not match.', code: 'BAD_CODE' }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    await assert.rejects(() => request('/api/anything'), (error: unknown) => error instanceof ApiError && error.message === 'That code did not match.' && error.code === 'BAD_CODE');
  } finally {
    globalThis.fetch = realFetch;
  }
});
