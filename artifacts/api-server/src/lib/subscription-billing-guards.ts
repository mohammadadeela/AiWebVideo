import { query } from './pool.js';

/**
 * The legacy PayPal webhook can observe an Orders-v2 capture before the managed
 * subscription route finishes its local settlement. Subscription orders use
 * the same provider/order ids for refund safety, so reserve the legacy
 * one-time-receipt key at the database layer. Subscription-specific receipts
 * use their own keys and are still delivered normally.
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
}
