-- Additive schema for AiWebVideo-managed recurring card subscriptions.
-- Safe to run on every deploy. Existing PayPal-managed subscriptions remain
-- untouched and continue using billing_source='paypal_subscription'.

ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT;

CREATE TABLE IF NOT EXISTS paypal_saved_payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paypal',
  provider_token_ref TEXT NOT NULL,
  brand TEXT,
  last_digits TEXT,
  expiry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider, provider_token_ref)
);
CREATE INDEX IF NOT EXISTS paypal_saved_payment_methods_user_idx
  ON paypal_saved_payment_methods(user_id, created_at DESC);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_source TEXT NOT NULL DEFAULT 'paypal_subscription';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method_id UUID;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_amount_usd NUMERIC(10,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_provider_order_id TEXT;

CREATE TABLE IF NOT EXISTS paypal_managed_subscription_intents (
  order_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  payment_method_id UUID,
  amount_usd NUMERIC(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  job_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS paypal_managed_subscription_returns (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT UNIQUE NOT NULL,
  job_id UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE TABLE IF NOT EXISTS paypal_managed_subscription_renewals (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  provider_order_id TEXT,
  provider_capture_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(subscription_id, period_start)
);

CREATE INDEX IF NOT EXISTS managed_subscription_due_idx
  ON subscriptions(billing_source, auto_renew, current_period_end);
CREATE UNIQUE INDEX IF NOT EXISTS managed_subscription_order_idx
  ON subscriptions(last_provider_order_id)
  WHERE last_provider_order_id IS NOT NULL;
