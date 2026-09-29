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
const managedSubscriptionsSql = await readFile(
  fileURLToPath(new URL('./managed-subscriptions.sql', import.meta.url)),
  'utf8',
);
const studioSql = await readFile(
  fileURLToPath(new URL('./studio.sql', import.meta.url)),
  'utf8',
);
const inspirationSql = await readFile(fileURLToPath(new URL('./inspiration.sql', import.meta.url)), 'utf8');
const creatorBillingSql = await readFile(fileURLToPath(new URL('./creator-billing.sql', import.meta.url)), 'utf8');

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
  await client.query(managedSubscriptionsSql);
  await client.query(studioSql);
  await client.query(inspirationSql);
  await client.query(creatorBillingSql);

  // Fail deployment before restarting the application if a legacy database
  // still cannot satisfy the exact columns used by account/billing queries.
  await client.query(`SELECT
    s.current_period_start,
    s.current_period_end,
    s.created_at,
    s.updated_at,
    s.auto_renew,
    s.paypal_subscription_id,
    s.billing_source,
    s.payment_method_id,
    s.renewal_amount_usd,
    s.last_provider_order_id
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
    p.product_id,
    p.status,
    p.created_at
    FROM payments p LIMIT 0`);

  await client.query(`SELECT
    r.subscription_id,
    r.period_start,
    r.provider_order_id,
    r.provider_capture_id,
    r.status
    FROM paypal_managed_subscription_renewals r LIMIT 0`);

  await client.query(`SELECT
    p.id,
    p.user_id,
    p.project_state,
    p.revision,
    p.latest_context
    FROM studio_projects p LIMIT 0`);

  await client.query(`SELECT
    a.project_id,
    a.storage_url,
    a.kind
    FROM studio_assets a LIMIT 0`);
  await client.query('SELECT m.id, m.status, f.feature_id FROM inspiration_media m LEFT JOIN inspiration_features f ON f.media_id=m.id LIMIT 0');
  await client.query('SELECT starter_credits_balance,starter_granted_at FROM users LIMIT 0');
  await client.query('SELECT job_id,status,source FROM starter_capture_reservations LIMIT 0');
  await client.query('SELECT payment_id,feature,model_id,remaining_credits FROM one_time_generation_entitlements LIMIT 0');
  await client.query('SELECT job_id,entitlement_id,amount FROM one_time_entitlement_redemptions LIMIT 0');

  console.log('Database schema is up to date.');
} finally {
  await client.end();
}
