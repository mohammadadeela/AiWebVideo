import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

async function sourceFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await sourceFiles(full));
    else if (/\.(tsx?|css|html)$/.test(entry.name)) found.push(full);
  }
  return found;
}

test('the Google key can never reach the browser: no page code talks to Google\'s image servers or names the key', async () => {
  for (const file of await sourceFiles(path.resolve(process.cwd(), '../aiwebvideo/src'))) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, /maps\.googleapis\.com/, file);
    assert.doesNotMatch(text, /GOOGLE_MAPS_API_KEY/, file);
  }
  const client = await fe('lib/api-client.ts');
  assert.match(client, /return `\/api\/architecture\/street-view\/image\?pano=/);          // pictures come from our own server
  assert.doesNotMatch(client.slice(client.indexOf('export function streetViewImageSrc')), /key=/);
});

test('Street View is the main picture of the site card, with the map in the corner, turn controls, the date and an old-photo warning', async () => {
  const card = await fe('components/chat/SiteStreetView.tsx');
  assert.match(card, /getStreetView\(latitude, longitude, controller\.signal\)/);
  assert.equal((card.match(/<iframe title="The exact spot on the map" src=\{mapSrc\}/g) ?? []).length, 2);   // the map stays mounted when swapped
  assert.match(card, /aria-label="Turn the camera left"/);
  assert.match(card, /aria-label="Turn the camera right"/);
  assert.equal((card.match(/h-11 w-11/g) ?? []).length, 2);                                                // 44 px touch targets
  assert.match(card, /aria-label=\{mapIsMain \? "Show Street View large" : "Show the map large"\}/);
  assert.match(card, /Google Street View\{info\?\.dateLabel \? ` · \$\{info\.dateLabel\}` : ""\}/);        // Google's attribution, with the capture date
  assert.match(card, /ageYears >= 4/);
  assert.match(card, /newer buildings may be missing/);
  assert.match(card, /yours wins/);
  assert.match(card, /map_action=pano&viewpoint=/);                                                        // Google's own page, a way in that needs no key
  assert.match(card, /There are no Street View photos close to this spot\./);
  assert.match(card, /Face the plot again/);
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /<SiteStreetView latitude=\{site\.latitude\} longitude=\{site\.longitude\} mapSrc=\{mapPreviewUrl\(site\.latitude, site\.longitude\)\} heading=\{streetViewHeading\} onHeading=\{setStreetViewHeading\} \/>/);
  assert.match(form, /streetViewHeading: typeof streetViewHeading === "number" \? streetViewHeading : undefined/);
  assert.match(form, /useEffect\(\(\) => \{ setStreetViewHeading\(null\); \}, \[site\?\.latitude, site\?\.longitude\]\);/);   // a new place starts facing the plot
});

test('a shop that blocks reading no longer ends in a dead end: the name is kept, one tap uploads, a pasted image address works', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /error\.code === "PRODUCT_BLOCKED" \|\| error\.code === "PRODUCT_IMAGES_MISSING"/);
  assert.match(form, /data-testid="product-blocked"/);
  assert.match(form, /We kept the product name:/);
  assert.match(form, /Copy image address/);
  assert.match(form, /Upload a photo/);
  assert.match(form, /blockedProduct && files\.length === 0/);                                              // gone as soon as a photo is added
  assert.match(form, /isProduct && blockedProduct\?\.name \? \{ title: blockedProduct\.name \}/);          // the AI still learns the product's name
  assert.match(form, /lastFailedLinkRef\.current === value/);                                               // a known-blocked link is not read again on every blur
  const client = await fe('lib/api-client.ts');
  assert.match(client, /productName\?: string;/);
  assert.match(client, /typeof data\.productName === 'string' \? \{ productName: data\.productName \} : undefined/);
});
