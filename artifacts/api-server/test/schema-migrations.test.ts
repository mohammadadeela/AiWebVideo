import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schemaPath = new URL('../db/schema.sql', import.meta.url);

test('legacy subscription installations receive every queried billing column', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  const requiredColumns = [
    'paypal_subscription_id',
    'auto_renew',
    'current_period_start',
    'current_period_end',
    'created_at',
    'updated_at',
  ];
  for (const column of requiredColumns) {
    assert.match(
      schema,
      new RegExp(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ${column}\\b`, 'i'),
      `subscriptions.${column} must have an additive migration`,
    );
  }
});

test('the migration validates the subscription columns used at runtime', async () => {
  const migration = await readFile(new URL('../db/migrate.mjs', import.meta.url), 'utf8');
  for (const column of ['current_period_start', 'current_period_end', 'updated_at']) {
    assert.match(migration, new RegExp(`s\\.${column}\\b`));
  }
});

test('legacy payment rows receive and backfill the product identifier used by admin reports', async () => {
  const schema = await readFile(schemaPath, 'utf8');
  assert.match(schema, /ALTER TABLE payments ADD COLUMN IF NOT EXISTS product_id\b/i);
  assert.match(schema, /WHEN kind = 'one_time' AND credits_granted = 38 THEN 'single8'/i);
  assert.match(schema, /WHEN kind LIKE 'subscription_%' AND plan IN \('creator','pro','agency'\) THEN plan/i);

  const migration = await readFile(new URL('../db/migrate.mjs', import.meta.url), 'utf8');
  assert.match(migration, /p\.product_id\b/);
});
