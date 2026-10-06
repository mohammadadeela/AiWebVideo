import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const frontend = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const server = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');

test('the browser never adds the master prompt: it sends the customer\'s words plus a separate hidden direction', async () => {
  const widget = await frontend('components/chat/ChatWidgetBase.tsx');
  assert.doesNotMatch(widget, /INTERIOR_MASTER_PROMPT/);
  assert.match(widget, /const effectiveStudioPrompt = request\.prompt;/);
  assert.match(widget, /studioDirection: request\.studioDirection/);
  assert.match(widget, /templateId: request\.templateId/);
});

test('idea chips put the full master prompt in the box in every mode, and only the safety text travels hidden', async () => {
  const form = await frontend('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /setPrompt\(text\)/);
  assert.match(form, /setBrief\(text\)/);
  assert.match(form, /composeIdeaText\(idea, own\)/);
  assert.doesNotMatch(form, /setPrompt\(idea\.displayText\)|setBrief\(idea\.displayText\)/);
  assert.match(form, /studioDirection: selectedIdea \? selectedIdea\.guardrail : undefined/);
});

test('a product link is optional, read automatically and is enough without uploaded photos', async () => {
  const form = await frontend('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /Product link <span[^>]*>· optional<\/span>/);
  assert.match(form, /onBlur=\{\(\) => \{ if \(productLink\.trim\(\)\) void loadProductLink\(\); \}\}/);
  assert.match(form, /const data = await loadProductLink\(undefined, true\);/);
  assert.match(form, /You only need one of the two/);
  const uploads = await server('routes/uploads.ts');
  assert.match(uploads, /!files\.length && !productImageUrls\.length/);
});

test('the server adds the master direction and keeps the stored brief as the customer\'s own text', async () => {
  const jobs = await server('routes/jobs.ts');
  assert.match(jobs, /creativeBrief: directedBriefFor\(meta, creativeBrief\)/);
  assert.match(jobs, /storyboard\.creativeBrief = creativeBrief\?\.trim\(\) \|\| undefined;/);
  assert.match(jobs, /\? "interior-design"/);
  assert.match(jobs, /\? "architecture"/);
});

test('every homepage sample must be filed under a feature before it can be saved', async () => {
  const admin = await server('routes/admin.ts');
  assert.match(admin, /FEATURE_REQUIRED/);
  const page = await frontend('pages/AdminPage.tsx');
  assert.match(page, /Choose a feature for every item first/);
});

test('older homepage videos stay visible until they are filed under a feature', async () => {
  const gallery = await frontend('components/landing/VideoShowcase.tsx');
  assert.match(gallery, /useGalleryItems\(\)/);
  assert.match(gallery, /isSample\(sample\) \? startFromSample\(sample\) : scrollToGenerator\(\)/);
  const lib = await frontend('lib/showcase.ts');
  assert.match(lib, /Boolean\(item\.url\)/);
});

test('admins can re-encode old homepage videos for phones one at a time', async () => {
  const admin = await server('routes/admin.ts');
  assert.match(admin, /router\.post\('\/marketing\/optimize'/);
  assert.match(admin, /Only uploaded videos can be optimized/);
  const page = await frontend('pages/AdminPage.tsx');
  assert.match(page, /Optimize videos for phones/);
  assert.match(page, /optimizeMarketingVideo\(/);
});
