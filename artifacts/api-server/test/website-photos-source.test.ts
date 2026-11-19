import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('Website Video: photos without a link follow the SAME website flow (not the old "what do you want to generate?" question)', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  // the photos become the job's source
  assert.match(widget, /const photosOnly = !url\.trim\(\) && pendingWebsiteAttachmentsRef\.current\.length > 0;/);
  assert.match(widget, /photosOnly \? await uploadPhotos\(sourcePhotos\) : await startCapture\(normalized, brief, setupSummary\)/);
  assert.match(widget, /if \(photosOnly\) pendingWebsiteAttachmentsRef\.current = \[\];/);          // they are the source, not extra references
  assert.match(widget, /if \(photosOnly\) websitePhotosJobRef\.current = res\.jobId;/);
  // after the photos are saved the job continues as a website video; only a plain upload asks what to make
  assert.match(widget, /job\.sourceUrl\.startsWith\("upload:\/\/"\) && !fromWebsitePhotos/);
  assert.match(widget, /if \(!fromWebsitePhotos\) pushBot\(<SiteCard/);                           // no fake "site card" for photos
  assert.match(widget, /Your website photos are saved\. Continue when you’re ready/);
  // an empty address never reaches the URL normaliser in the photos case
  assert.match(widget, /let normalized = "";\s*if \(!photosOnly\) \{\s*try \{\s*normalized = normalizeWebsiteUrl\(url\);/);
  // the hand-off across sign-in and the landing-to-workspace move may carry an empty address
  const handoff = await fe('lib/publicCreatorHandoff.ts');
  assert.doesNotMatch(handoff, /url\.trim\(\)|!parsed\.url/);
});
