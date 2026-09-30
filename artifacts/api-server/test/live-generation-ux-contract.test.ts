import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontendSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

test('chat follow mode respects manual scroll and exposes jump-to-latest', async () => {
  const chat = await frontendSource('src/components/chat/ChatWidget.tsx');

  assert.match(chat, /event\.deltaY < 0/);
  assert.match(chat, /autoFollowRef\.current = false/);
  assert.match(chat, /userScrollIntentRef\.current = true/);
  assert.match(chat, /distanceFromBottom <= 12/);
  assert.match(chat, /Jump to latest message/);
  assert.match(chat, /setHasUnseenBelow\(true\)/);
  assert.match(chat, /behavior: reducedMotion \? "auto" : "smooth"/);
});

test('newly finished media is always revealed once even after manual scroll', async () => {
  const chat = await frontendSource('src/components/chat/ChatWidget.tsx');

  assert.match(chat, /Completion is the one intentional exception to normal follow-mode/);
  assert.match(chat, /querySelectorAll<HTMLElement>\('\[data-generated-result="true"\]'\)/);
  assert.match(chat, /autoFollowRef\.current = true/);
  assert.match(chat, /userScrollIntentRef\.current = false/);
  assert.match(chat, /setShowJumpToLatest\(false\)/);
  assert.match(chat, /setHasUnseenBelow\(false\)/);
  assert.match(chat, /messages\.scrollTo\(\{/);
});

test('generation defaults to one progressive thinking line with collapsed details', async () => {
  const canvas = await frontendSource('src/components/chat/GenerationCanvas.tsx');

  assert.match(canvas, /humanThinkingText/);
  assert.match(canvas, /animate-typing-dot/);
  assert.match(canvas, /Show details/);
  assert.match(canvas, /storyboardScenes/);
  assert.match(canvas, /References/);
  assert.match(canvas, /Still working — high-quality renders can take a little longer\./);
  assert.match(canvas, /role="progressbar"/);
  assert.doesNotMatch(canvas, /Current stage/);
  assert.doesNotMatch(canvas, /Live canvas/);
  assert.doesNotMatch(canvas, /Estimated progress · provider generation time varies/);
});

test('finished result reduces generation process to a compact completion line', async () => {
  const base = await frontendSource('src/components/chat/ChatWidgetBase.tsx');

  assert.match(base, /data-generated-result="true"/);
  assert.match(base, /inline-flex items-center gap-1\.5 rounded-full border border-mint\/15/);
  assert.match(base, /HIDDEN_RESTORED_MESSAGE_KINDS = new Set\(\["source_continuation", "storyboard"\]\)/);
});
