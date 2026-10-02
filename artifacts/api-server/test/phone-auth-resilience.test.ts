import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { detectInAppBrowser } from '../../aiwebvideo/src/lib/inAppBrowser.js';
import { installSafeStorage, storageWorks } from '../../aiwebvideo/src/lib/safeStorage.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

const blockedWindow = () => {
  const scope = {} as Record<string, unknown>;
  for (const kind of ['localStorage', 'sessionStorage']) Object.defineProperty(scope, kind, { get() { throw new Error('SecurityError: The operation is insecure.'); }, configurable: true });
  return scope as unknown as Window;
};

test('a browser whose storage throws gets a working in-memory storage instead of crashing the page', () => {
  const scope = blockedWindow();
  assert.equal(storageWorks('localStorage', scope), false);
  assert.deepEqual(installSafeStorage(scope), ['localStorage', 'sessionStorage']);
  const store = (scope as unknown as { localStorage: Storage }).localStorage;
  store.setItem('a', '1');
  assert.equal(store.getItem('a'), '1');
  assert.equal(store.getItem('missing'), null);
  store.removeItem('a');
  assert.equal(store.length, 0);
  assert.equal(storageWorks('localStorage', scope), true);
});

test('a browser with working storage is left completely alone', () => {
  const real = new Map<string, string>();
  const good = { setItem: (k: string, v: string) => real.set(k, v), removeItem: (k: string) => real.delete(k), getItem: (k: string) => real.get(k) ?? null };
  const scope = { localStorage: good, sessionStorage: good } as unknown as Window;
  assert.deepEqual(installSafeStorage(scope), []);
  assert.equal((scope as unknown as { localStorage: unknown }).localStorage, good);
});

test('app browsers are recognised, and the ones that refuse Google/GitHub sign-in are flagged', () => {
  const cases: Array<[string, string, boolean]> = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0 Mobile/15E148 Safari/604.1', 'the Google app', false],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0', 'the Instagram app', true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]', 'the Facebook app', true],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/120 Mobile Safari/537.36', "an app's built-in browser", true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', "an app's built-in browser", true],   // no "Safari/" token: an embedded iOS browser
  ];
  for (const [ua, name, blocked] of cases) assert.deepEqual(detectInAppBrowser(ua), { name, providerSignInBlocked: blocked }, ua.slice(0, 70));
});

test('real browsers are never mistaken for in-app browsers', () => {
  for (const ua of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',          // Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',          // Chrome iOS
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',                                 // Chrome Android
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ]) assert.equal(detectInAppBrowser(ua), null, ua.slice(0, 70));
  assert.equal(detectInAppBrowser(''), null);
});

test('the sign-in check always answers, never trusts a dropped cookie, and re-checks when a cached page is restored', async () => {
  const client = await fe('lib/firebase/client.ts');
  assert.match(client, /const answerTimer = window\.setTimeout\(\(\) => \{ if \(!answered && !stopped\) deliver\(null\); \}, 7000\);/);
  assert.match(client, /const readyTimer = window\.setTimeout\(\(\) => \{ if \(!firebaseReady && !stopped\)/);       // do not wait forever for Firebase
  assert.match(client, /const confirmed = synced \? await serverSession\(\) : null;/);                                   // the cookie must really work
  assert.match(client, /export async function verifyServerSession\(\)/);
  assert.match(client, /window\.addEventListener\('pageshow', onPageShow\)/);
  assert.match(client, /if \(event\.persisted\) onResume\(\)/);
  assert.match(client, /window\.addEventListener\('online', onResume\)/);
  assert.match(client, /try \{ legacyToken = localStorage\.getItem\('aiwebvideo_token'\); \} catch/);
  assert.match(client, /signInWithRedirect\(auth, provider\)/);                                                         // pop-up blocked: try a redirect
  assert.match(client, /!detectInAppBrowser\(\)\?\.providerSignInBlocked/);                                              // ...but not where the provider refuses anyway
});

test('storage protection is the very first thing the app loads', async () => {
  const main = await fe('main.tsx');
  assert.ok(main.indexOf("import './lib/safeStorage'") === 0, 'safeStorage must be the first import');
});

test('sign-in: the server login is verified, in-app browsers are explained, and both Sign in and Create account are one tap away', async () => {
  const modal = await fe('components/auth/AuthModal.tsx');
  assert.match(modal, /if \(!\(await verifyServerSession\(\)\)\) throw new SessionBlockedError\(\);/);
  assert.match(modal, /blocked the login cookie/);
  assert.equal((modal.match(/isSessionBlocked\(err\)/g) ?? []).length >= 3, true);       // provider, email and code paths
  assert.match(modal, /role="tablist" aria-label="Sign in or create an account"/);
  assert.match(modal, /initialMode = 'signin'/);
  assert.match(modal, /<div role="note"/);
  assert.match(modal, /Copy link to open in a browser/);
});

test('phones show a visible Sign up, and the navbar never leaves a person with only grey placeholders', async () => {
  const nav = await fe('components/landing/Nav.tsx');
  assert.match(nav, /<span className="sm:hidden">\s*<Button[^>]*onClick=\{\(\) => openAuth\('signup'\)\}>\s*Sign up/);
  assert.match(nav, /\{!authChecked && !waited \? \(/);
  assert.match(nav, /\) : authChecked && isSignedIn \? \(/);
  assert.match(nav, /initialMode=\{authMode\}/);
  const dash = await fe('components/dashboard/DashboardClient.tsx');
  assert.match(dash, /Still checking your account…/);
  assert.match(dash, /window\.location\.reload\(\)/);
});
