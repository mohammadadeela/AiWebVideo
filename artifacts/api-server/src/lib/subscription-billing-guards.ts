import { query } from './pool.js';

/**
 * Orders-v2 captures emit the same generic PAYMENT.CAPTURE.COMPLETED webhook
 * used by one-time purchases. Managed subscriptions settle those captures in
 * their own authenticated flow, so install database guards before HTTP starts:
 * - suppress the legacy one-time receipt key for subscription payments;
 * - suppress the legacy paypal:order:* credit key for managed renewals, whose
 *   entitlement uses the deterministic paypal:managed-renewal:* key instead.
 *
 * The initial managed subscription intentionally keeps paypal:order:* so its
 * first credit grant remains compatible with the existing capture webhook and
 * idempotent settlement path.
 */
export async function ensureSubscriptionReceiptGuard() {
  await query(`CREATE OR REPLACE FUNCTION aiwebvideo_guard_subscription_receipt()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF NEW.provider = 'paypal' AND NEW.kind LIKE 'subscription_%' THEN
      INSERT INTO billing_notifications(notification_key,user_id,kind)
      VALUES ('receipt:order:' || NEW.provider_ref, NEW.user_id, 'subscription_receipt_guard')
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END;
  $$`);

  await query('DROP TRIGGER IF EXISTS aiwebvideo_subscription_receipt_guard ON payments');
  await query(`CREATE TRIGGER aiwebvideo_subscription_receipt_guard
    AFTER INSERT OR UPDATE OF kind ON payments
    FOR EACH ROW EXECUTE FUNCTION aiwebvideo_guard_subscription_receipt()`);

  await query(`CREATE OR REPLACE FUNCTION aiwebvideo_guard_managed_renewal_credit()
  RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE
    order_ref text;
  BEGIN
    IF NEW.grant_key LIKE 'paypal:order:%' THEN
      order_ref := substring(NEW.grant_key FROM length('paypal:order:') + 1);
      IF EXISTS (
        SELECT 1
          FROM payments p
         WHERE p.provider='paypal'
           AND p.provider_ref=order_ref
           AND p.kind='subscription_renewal'
      ) THEN
        RETURN NULL;
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$`);

  await query('DROP TRIGGER IF EXISTS aiwebvideo_managed_renewal_credit_guard ON credit_grants');
  await query(`CREATE TRIGGER aiwebvideo_managed_renewal_credit_guard
    BEFORE INSERT ON credit_grants
    FOR EACH ROW EXECUTE FUNCTION aiwebvideo_guard_managed_renewal_credit()`);
}
