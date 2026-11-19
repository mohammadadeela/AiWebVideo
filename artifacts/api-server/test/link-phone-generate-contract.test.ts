import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { linkStatusMessage, looksLikeLink, withScheme } from '../../aiwebvideo/src/lib/linkStatus.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const messages = ['reading', 'still working', 'deeper read'] as const;

test('the "we are working" message changes as a slow page takes longer, so it never looks frozen', () => {
  assert.equal(linkStatusMessage(0, messages), 'reading');
  assert.equal(linkStatusMessage(2.9, messages), 'reading');
  assert.equal(linkStatusMessage(3, messages), 'still working');
  assert.equal(linkStatusMessage(8.9, messages), 'still working');
  assert.equal(linkStatusMessage(9, messages), 'deeper read');
});

test('anything that looks like a web address is read straight away; plain words and addresses are not', () => {
  for (const link of ['https://shop.com/item/1', 'http://a.co/x', 'shop.com/products/mug', 'www.example.co.uk/p?id=3', 'https://maps.app.goo.gl/abc123']) assert.equal(looksLikeLink(link), true, link);
  for (const text of ['', '   ', 'a nice mug', '12 Main Street, Hebron', 'https://', 'hello.', 'shop com']) assert.equal(looksLikeLink(text), false, JSON.stringify(text));
  assert.equal(withScheme('shop.com/x'), 'https://shop.com/x');
  assert.equal(withScheme('http://a.co'), 'http://a.co');
});
