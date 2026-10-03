import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * The site has no sparkle icons (the little four-point star with a plus) and no magic-wand icons from the same family,
 * anywhere: not on buttons, tabs, badges or cards. This keeps them from sneaking back in.
 */
const root = path.resolve(process.cwd(), '../aiwebvideo');

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(full));
    else if (/\.(tsx?|css|html|svg)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('no sparkle or wand icon is imported or drawn anywhere in the frontend', async () => {
  const found: string[] = [];
  for (const file of [...await files(path.join(root, 'src')), ...await files(path.join(root, 'public')), path.join(root, 'index.html')]) {
    const text = await readFile(file, 'utf8').catch(() => '');
    // identifiers of the icon family, and the plain-text sparkle characters
    for (const match of text.matchAll(/\b(Sparkles?|SparklesIcon|WandSparkles|Wand2|Wand)\b|[✦✨]/g)) {
      found.push(`${path.relative(root, file)}: ${match[0]}`);
    }
  }
  assert.deepEqual(found, []);
});

test('the Generate button and the Ideas button carry no icon in front of their text', async () => {
  const form = await readFile(path.join(root, 'src/components/chat/WebsiteBriefForm.tsx'), 'utf8');
  // the only thing that can precede the label is the spinner shown while a link is being read
  assert.match(form, /\{linkBusy && <i className="inline-block h-4 w-4 animate-spin/);
  assert.doesNotMatch(form, /linkBusy \? <i[^>]*\/> : </);
});
