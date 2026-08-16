-- AiWebVideo database schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid     TEXT UNIQUE,
  email            TEXT NOT NULL,
  password_hash    TEXT,                           -- for local auth (no Firebase)
  is_admin         BOOLEAN NOT NULL DEFAULT FALSE,
  account_status   TEXT NOT NULL DEFAULT 'active', -- active | suspended
  plan             TEXT NOT NULL DEFAULT 'free',   -- free | creator | pro | agency
  credits_balance  INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_key UNIQUE (email)
);
ALTER TABLE users ALTER COLUMN credits_balance SET DEFAULT 0;
-- Backward-compatible upgrades for installations created by earlier builds.
-- Earlier deployments required Firebase IDs even for local email/password users.
ALTER TABLE users ALTER COLUMN firebase_uid DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Pending email/password sign-ups, waiting on a 6-digit email verification
-- code. Nothing is written to `users` until the code is confirmed, so an
-- unverified signup never creates a dead account or blocks the email later.
CREATE TABLE IF NOT EXISTS pending_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  source_url       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued',  -- queued | capturing | captured | storyboarding | rendering | done | failed | cancelled
  progress         INTEGER NOT NULL DEFAULT 0,
  mode             TEXT NOT NULL DEFAULT 'video',   -- video | photos | both
  vibe_brief       TEXT,
  capture_metadata JSONB,
  storyboard       JSONB,
  workflow_state   JSONB,
  status_message   TEXT,
  eta_seconds      INTEGER,
  credits_spent    INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT,
  title            TEXT,
  pinned           BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at       TIMESTAMPTZ,
  parent_job_id    UUID REFERENCES jobs(id) ON DELETE SET NULL,
  generation_provider TEXT,
  gpu_seconds      NUMERIC(12,3) NOT NULL DEFAULT 0,
  generation_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS eta_seconds INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS credits_spent INTEGER NOT NULL DEFAULT 0;
-- Backward-compatible upgrade from the original capture-worker schema.
-- CREATE TABLE IF NOT EXISTS does not add missing columns to an existing table.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'video';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vibe_brief TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS capture_metadata JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS storyboard JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS workflow_state JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS generation_provider TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS gpu_seconds NUMERIC(12,3) NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS generation_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_user_history_idx ON jobs(user_id, pinned DESC, updated_at DESC) WHERE deleted_at IS NULL;

-- Persistent chat transcript. Rich project state remains on jobs; these rows
-- preserve the human-readable conversation and user choices.
CREATE TABLE IF NOT EXISTS job_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  kind        TEXT NOT NULL DEFAULT 'text',
  content     TEXT NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS job_messages_job_idx ON job_messages(job_id, created_at);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,          -- screenshot | recording | video | photo
  storage_url  TEXT NOT NULL,
  aspect_ratio TEXT,                   -- 9:16 | 1:1 | 16:9
  watermarked  BOOLEAN NOT NULL DEFAULT FALSE,
  downloadable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing installations created before downloadable previews were added do
-- not receive new columns from CREATE TABLE IF NOT EXISTS. Keep this upgrade
-- idempotent so every deployment can safely run the same migration.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS downloadable BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS assets_job_id_idx ON assets(job_id);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  paypal_subscription_id TEXT UNIQUE,
  plan                 TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  auto_renew           BOOLEAN NOT NULL DEFAULT TRUE,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT UNIQUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE;

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,   -- positive = grant, negative = spend
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS credit_tx_user_id_idx ON credit_transactions(user_id);

-- Durable idempotency for monetary grants. Provider webhooks can be retried
-- or arrive through both redirect and webhook paths; one external payment
-- reference must credit the account exactly once.
CREATE TABLE IF NOT EXISTS credit_grants (
  grant_key    TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits      INTEGER NOT NULL CHECK (credits > 0),
  plan         TEXT,
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paypal_events (
  event_id     TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Real payment/invoice history, shown on the billing page. Neither the
-- Stripe nor PayPal integration previously wrote anything here — credit
-- balance changes were tracked (credit_transactions) but never the actual
-- dollar amount paid, so there was no real data source for "how much have I
-- paid" or for emailing invoices.
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL,               -- stripe | paypal
  provider_ref     TEXT NOT NULL,                -- checkout session id / order id / capture id
  kind             TEXT NOT NULL,                -- one_time | subscription_initial | subscription_renewal
  amount_usd       NUMERIC(12,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USD',
  credits_granted  INTEGER NOT NULL DEFAULT 0,
  plan             TEXT,
  status           TEXT NOT NULL DEFAULT 'paid', -- paid | refunded
  invoice_emailed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_idx ON payments(provider, provider_ref);

-- Non-secret runtime controls. Credentials remain in .env.local and are never
-- returned to the browser.
CREATE TABLE IF NOT EXISTS system_settings (
  key          TEXT PRIMARY KEY,
  value        JSONB NOT NULL,
  updated_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (key, value) VALUES
  ('providers', '{"image":"auto","video":"auto","fallbackEnabled":true}'::jsonb),
  ('operations', '{"maintenanceMode":false,"registrationsEnabled":true,"maxConcurrentJobs":3}'::jsonb),
  ('marketing', '{"heading":"Made with AiWebVideo","description":"See short examples created by people using the studio, then start with your own website.","videos":{"showcase":[]}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Itemized provider costs. Each billable generation step records one row so
-- the admin console can show exactly which process spent money.
CREATE TABLE IF NOT EXISTS generation_cost_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID REFERENCES jobs(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  operation      TEXT NOT NULL,
  quantity       NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit           TEXT NOT NULL DEFAULT 'request',
  unit_cost_usd  NUMERIC(14,8) NOT NULL DEFAULT 0,
  total_cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS generation_cost_events_job_idx ON generation_cost_events(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generation_cost_events_month_idx ON generation_cost_events(created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(created_at DESC);

-- Seed admin account (idempotent)
-- The ADMIN_EMAIL env var is used at runtime; this seeds a fallback record.
-- Update the email/password_hash below for your admin account.
-- Password below is a bcrypt hash of "admin1234" — change it!
-- INSERT INTO users (email, password_hash, plan, credits_balance)
-- VALUES ('admin@example.com', '$2a$12$placeholder', 'agency', 999999)
-- ON CONFLICT (email) DO UPDATE SET plan='agency', credits_balance=999999;
