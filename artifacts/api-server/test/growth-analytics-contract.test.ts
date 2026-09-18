import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = async (file: string) => fs.readFile(path.join(root, file), 'utf8');

test('growth funnel has server-owned event persistence and the required commercial stages', async () => {
  const analytics = await source('src/lib/growth-analytics.ts');
  const route = await source('src/routes/analytics.ts');
  for (const event of ['page_view','url_entered','website_preview_viewed','paywall_shown','checkout_started','checkout_success','generation_completed','download_clicked','repeat_creation_started']) assert.match(analytics, new RegExp(`['\"]${event}['\"]`));
  assert.match(analytics, /CREATE TABLE IF NOT EXISTS growth_events/);
  assert.match(route, /POST/);
  assert.match(route, /eventSchema/);
});

test('customer-facing marketing copy keeps billing language outcome-focused', async () => {
  const copy = await source('../aiwebvideo/src/lib/marketingCopy.ts');
  assert.match(copy, /Your website already tells the story/);
  assert.match(copy, /Get the credits I need/);
  assert.match(copy, /Product launch/);
});