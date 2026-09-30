import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('sliders can be dragged with a mouse and show grab / grabbing instead of the click hand', async () => {
  assert.match(await fe('main.tsx'), /installDragScroll\(\)/);
  const css = await fe('index.css');
  assert.match(css, /\.drag-scroll-ready button:not\(:disabled\)/);
  assert.match(css, /cursor: grab;/);
  assert.match(css, /\.drag-scroll-active \*[\s\S]{0,40}cursor: grabbing !important/);
  const lib = await fe('lib/dragScroll.ts');
  assert.match(lib, /pointerType !== "mouse"/);          // touch keeps its native swipe
  assert.match(lib, /swallowClick/);                     // a drag is never a click
  assert.match(lib, /\.chat-scroll, \[data-drag-scroll\]/);
});

test('website idea chips show short text and send their direction behind a marker the server strips', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /withHiddenDirection\(brief\.trim\(\), selectedIdea\?\.masterPrompt\)/);
  assert.doesNotMatch(form, /setBrief\(idea\.masterPrompt\)/);
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /visibleBrief\(creativeBrief\)/);
  const capture = await readFile(path.resolve(process.cwd(), 'src/routes/capture.ts'), 'utf8');
  assert.match(capture, /splitHiddenDirection\(creativeBrief\)/);
  const jobs = await readFile(path.resolve(process.cwd(), 'src/routes/jobs.ts'), 'utf8');
  assert.match(jobs, /splitHiddenDirection\(submittedBrief\)/);
  assert.match(jobs, /splitHiddenDirection\(workflowState\.creativeBrief\)/);
});
