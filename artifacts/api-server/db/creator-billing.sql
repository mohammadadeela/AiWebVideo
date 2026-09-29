-- Applied after schema.sql. Historical production balances and payments remain intact.
-- Keep the previous PayPal plan identifiers before the new catalog replaces
-- paypal_runtime; existing subscribers renew on their original contract.
INSERT INTO system_settings(key,value)
SELECT 'paypal_runtime_legacy',value FROM system_settings
WHERE key='paypal_runtime' AND value->>'pricingVersion' IS DISTINCT FROM '2026-09-creator-catalog-v3'
ON CONFLICT(key) DO NOTHING;
CREATE TABLE IF NOT EXISTS starter_identity_grants (
  email_digest TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Earlier builds put five signup credits in the general wallet. For accounts
-- without purchases, reclassify only the unspent portion. Purchased balances
-- are never reduced or reclassified.
UPDATE users u SET starter_credits_balance=LEAST(5,GREATEST(0,u.credits_balance)),
  credits_balance=u.credits_balance-LEAST(5,GREATEST(0,u.credits_balance)),
  starter_granted_at=NOW(),updated_at=NOW()
WHERE u.starter_granted_at IS NULL
  AND EXISTS(SELECT 1 FROM credit_grants g WHERE g.user_id=u.id AND g.grant_key='growth:starter:' || u.id::text)
  AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.user_id=u.id AND p.status='paid');
UPDATE users u SET starter_granted_at=NOW()
WHERE u.starter_granted_at IS NULL
  AND EXISTS(SELECT 1 FROM credit_grants g WHERE g.user_id=u.id AND g.grant_key='growth:starter:' || u.id::text);
INSERT INTO starter_identity_grants(email_digest)
SELECT DISTINCT encode(digest(lower(trim(u.email)),'sha256'),'hex')
FROM users u WHERE u.starter_granted_at IS NOT NULL
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS starter_capture_reservations (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (source IN ('starter','production')),
  status TEXT NOT NULL CHECK (status IN ('reserved','consumed','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS starter_capture_user_idx ON starter_capture_reservations(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS one_time_generation_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL UNIQUE REFERENCES payments(id),
  product_id TEXT NOT NULL,
  feature TEXT NOT NULL,
  model_id TEXT NOT NULL,
  duration_seconds INTEGER,
  quality TEXT NOT NULL,
  audio_mode TEXT NOT NULL,
  credit_value INTEGER NOT NULL CHECK (credit_value > 0),
  remaining_credits INTEGER NOT NULL DEFAULT 0 CHECK (remaining_credits >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','used','refunded','revoked')),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS one_time_entitlement_available_idx ON one_time_generation_entitlements(user_id,feature,model_id,status);
ALTER TABLE one_time_generation_entitlements ADD COLUMN IF NOT EXISTS remaining_credits INTEGER NOT NULL DEFAULT 0;
UPDATE one_time_generation_entitlements SET remaining_credits=credit_value WHERE remaining_credits=0 AND status='available';
CREATE TABLE IF NOT EXISTS one_time_entitlement_redemptions (
  job_id UUID PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  entitlement_id UUID NOT NULL REFERENCES one_time_generation_entitlements(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION aiwebvideo_revoke_refunded_entitlement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='paid' AND NEW.status IN ('refunded','reversed') THEN
    UPDATE one_time_generation_entitlements SET status='revoked',updated_at=NOW()
      WHERE payment_id=OLD.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aiwebvideo_entitlement_clawback ON payments;
CREATE TRIGGER aiwebvideo_entitlement_clawback AFTER UPDATE OF status ON payments
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION aiwebvideo_revoke_refunded_entitlement();
