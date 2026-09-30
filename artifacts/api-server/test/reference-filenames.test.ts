import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAttachmentFilename, nextReferenceFilename } from '../src/lib/reference-filenames.js';

test('uploaded, extracted, and inspiration references cannot overwrite one another', () => {
  // The first upload failed validation. Only successfully saved pages advance
  // the index, and each later source gets a unique name in that same order.
  const saved: string[] = [];
  for (const source of ['bad upload', 'valid upload', 'product hero', 'product variant', 'inspiration', 'video frame']) {
    if (source === 'bad upload') continue;
    saved.push(nextReferenceFilename(saved.length));
  }
  assert.deepEqual(saved, ['screenshot-full.jpg', 'page-1.jpg', 'page-2.jpg', 'page-3.jpg', 'page-4.jpg']);
  assert.equal(new Set(saved).size, saved.length);
  assert.throws(() => nextReferenceFilename(-1), RangeError);
});

test('new attachments do not overwrite gaps left by older numbering', () => {
  const pages = Array.from({ length: 8 }, (_, index) => ({ screenshotUrl: `/api/assets/id/page-${index}.jpg` }));
  pages[5].screenshotUrl = '/api/assets/id/private-page-5.jpg';
  pages[6].screenshotUrl = '/api/assets/id/private-page-7.jpg';
  pages[7].screenshotUrl = '/api/assets/id/private-page-9.jpg';
  const first = nextAttachmentFilename(pages);
  pages.push({ screenshotUrl: `/api/assets/id/${first}` });
  const second = nextAttachmentFilename(pages);
  assert.equal(first, 'private-page-8.jpg');
  assert.equal(second, 'private-page-10.jpg');
});
