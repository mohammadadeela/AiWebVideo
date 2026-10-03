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

test('product link and architecture engineer controls stay available', async () => {
  const creator = await frontendSource('src/components/chat/WebsiteBriefForm.tsx');
  const client = await frontendSource('src/lib/api-client.ts');
  const uploads = await serverSource('src/routes/uploads.ts');
  const routes = await serverSource('src/routes/index.ts');

  // the seven features are one shared list (navbar, chat box and cards all read it)
  assert.match(await readFile(path.resolve(process.cwd(), '../aiwebvideo/src/lib/creationFeatures.ts'), 'utf8'), /id: "architecture", label: "Architecture"/);
  assert.match(creator, /Paste a link to the product page/);
  assert.match(creator, /void loadProductLink\(/);
  assert.match(creator, /Google Maps link, address or coordinates/);
  assert.match(creator, /label="Plot width" unit="m"/);
  assert.match(creator, /label="Plot depth" unit="m"/);
  assert.match(creator, /Estimate the plot size/);
  assert.match(client, /extractProductReference/);
  assert.match(client, /resolveArchitectureLocation/);
  assert.match(uploads, /productImageUrls/);
  assert.match(uploads, /studioKind === 'architecture'/);
  assert.match(routes, /router\.use\('\/architecture', architectureRouter\)/);
  assert.match(routes, /router\.use\('\/product-reference', productReferenceRouter\)/);
});

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

test('workspace and profile expose compact credit usage UI', async () => {
  const dashboard = await frontendSource('src/components/dashboard/DashboardClient.tsx');
  const profile = await frontendSource('src/pages/ProfilePage.tsx');

  assert.match(dashboard, /View usage/);
  assert.match(dashboard, /Recharge/);
  assert.match(dashboard, /formatCredits\(me\?\.creditsBalance\)/);
  assert.match(profile, /used this month/);
  assert.match(profile, /monthlyUsagePercent/);
  assert.match(profile, /role="progressbar"/);
  assert.match(profile, /Credits available/);
});
