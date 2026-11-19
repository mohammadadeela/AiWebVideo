import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontendSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

async function serverSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('firebase provider auth remains resilient to tab and popup focus changes', async () => {
  const firebase = await frontendSource('src/lib/firebase/client.ts');
  const modal = await frontendSource('src/components/auth/AuthModal.tsx');

  assert.match(firebase, /setPersistence\(auth, browserLocalPersistence\)/);
  assert.match(firebase, /ensureFirebaseServerSession/);
  assert.match(firebase, /window\.addEventListener\('focus', onResume\)/);
  assert.match(firebase, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(modal, /window\.addEventListener\('blur', onBlur\)/);
  assert.match(modal, /window\.addEventListener\('focus', onFocus\)/);
  assert.match(modal, /watchAuthState/);
  assert.match(modal, /finishSignInRef/);
  assert.match(modal, /providerAttempt\.current <= 0/);
  assert.match(modal, /45_000/);
});
