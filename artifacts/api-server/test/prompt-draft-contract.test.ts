import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROMPT_DRAFT_MAX_AGE_MS, parsePromptDraft } from '../../aiwebvideo/src/lib/promptDraft.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('a saved prompt draft comes back only when it is well formed and recent', () => {
  const now = 1_000_000_000_000;
  const saved = (value: object) => JSON.stringify(value);
  assert.equal(parsePromptDraft(saved({ text: 'my prompt', savedAt: now - 1000 }), now), 'my prompt');
  assert.equal(parsePromptDraft(saved({ text: 'old', savedAt: now - PROMPT_DRAFT_MAX_AGE_MS - 1 }), now), '', 'stale');
  assert.equal(parsePromptDraft(saved({ text: 5, savedAt: now }), now), '');
  assert.equal(parsePromptDraft(saved({ text: 'x' }), now), '', 'no timestamp');
  assert.equal(parsePromptDraft('{not json', now), '');
  assert.equal(parsePromptDraft(null, now), '');
  assert.equal(parsePromptDraft(saved({ text: 'y'.repeat(9000), savedAt: now }), now).length, 8000, 'capped');
});

test('every feature shares ONE prompt text, which survives a page change and is cleared when a production is submitted', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /const \[brief, setBrief\] = useState\(\(\) => loadPromptDraft\(\)\);\s*const prompt = brief;\s*const setPrompt = setBrief;/);
  assert.match(form, /useEffect\(\(\) => \{ savePromptDraft\(brief\); \}, \[brief\]\);/);
  assert.equal((form.match(/clearPromptDraft\(\);/g) ?? []).length, 2);               // website submit and studio submit
  assert.doesNotMatch(form, /useState\(""\);\s*const \[prompt, setPrompt\]/);          // no second, separate text state
});
