import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const EXPECTED_DATABASE_NAME = 'aiwebvideo';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required. Run this migration with the AIWebVideo root .env.local file.',
  );
}

const sql = await readFile(
  fileURLToPath(new URL('./schema.sql', import.meta.url)),
  'utf8',
);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

try {
  // Safety lock: this repository is allowed to migrate only the dedicated
  // AIWebVideo database. This prevents an accidentally copied DATABASE_URL
  // from changing another website/database on the same VPS.
  const databaseResult = await client.query(
    'SELECT current_database() AS database_name',
  );
  const databaseName = databaseResult.rows[0]?.database_name;

  if (databaseName !== EXPECTED_DATABASE_NAME) {
    throw new Error(
      `Safety stop: expected PostgreSQL database "${EXPECTED_DATABASE_NAME}" but DATABASE_URL connected to "${databaseName ?? 'unknown'}". No migration was applied.`,
    );
  }

  console.log(`Database safety check passed: ${databaseName}`);

  await client.query(sql);

  // Fail deployment before restarting the application if a legacy database
  // still cannot satisfy the exact columns used by account/billing queries.
  await client.query(`SELECT
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    s.auto_renew,
    s.paypal_subscription_id
    FROM subscriptions s LIMIT 0`);

  await client.query(`SELECT
    p.provider,
    p.provider_ref,
    p.provider_capture_ref,
    p.kind,
    p.amount_usd,
    p.currency,
    p.credits_granted,
    p.plan,
    p.status,
    p.created_at
    FROM payments p LIMIT 0`);

  console.log('Database schema is up to date.');
} finally {
  await client.end();
}
