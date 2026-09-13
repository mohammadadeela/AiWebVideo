import { grantCreditsOnce } from './billing.js';
import { logger } from './logger.js';
import { query } from './pool.js';

type MissingGrant = {
  grant_key: string;
  user_id: string;
  credits: number;
  plan: string | null;
  reason: string;
};

let reconciliationTimer: NodeJS.Timeout | null = null;
let reconciliationRunning = false;

async function missingManagedSubscriptionGrants(): Promise<MissingGrant[]> {
  const initial = await query<{
    provider_ref: string;
    user_id: string;
    credits_granted: number;
    plan: string | null;
  }>(`
    SELECT p.provider_ref,p.user_id,p.credits_granted,p.plan
      FROM payments p
      JOIN paypal_managed_subscription_intents i
        ON i.order_id=p.provider_ref AND i.user_id=p.user_id
 LEFT JOIN credit_grants g
        ON g.grant_key=('paypal:order:' || p.provider_ref)
     WHERE p.provider='paypal'
       AND p.kind='subscription_initial'
       AND p.status='paid'
       AND g.grant_key IS NULL
     ORDER BY p.created_at ASC
     LIMIT 100
  `);

  const renewals = await query<{
    subscription_id: string;
    period_start: Date;
    provider_order_id: string;
    user_id: string;
    credits_granted: number;
    plan: string | null;
  }>(`
    SELECT r.subscription_id,r.period_start,r.provider_order_id,
           p.user_id,p.credits_granted,p.plan
      FROM paypal_managed_subscription_renewals r
      JOIN subscriptions s
        ON s.id=r.subscription_id AND s.billing_source='paypal_card'
      JOIN payments p
        ON p.provider='paypal'
       AND p.provider_ref=r.provider_order_id
       AND p.user_id=s.user_id
       AND p.kind='subscription_renewal'
       AND p.status='paid'
     WHERE r.status='paid'
       AND r.provider_order_id IS NOT NULL
     ORDER BY r.period_start ASC
     LIMIT 200
  `);

  const missingRenewals: MissingGrant[] = [];
  for (const row of renewals.rows) {
    const periodStart = new Date(row.period_start).toISOString();
    const grantKey = `paypal:managed-renewal:${row.subscription_id}:${periodStart}`;
    const existing = await query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM credit_grants WHERE grant_key=$1) AS exists',
      [grantKey],
    );
    if (!existing.rows[0]?.exists) {
      missingRenewals.push({
        grant_key: grantKey,
        user_id: row.user_id,
        credits: row.credits_granted,
        plan: row.plan,
        reason: `Reconciled completed subscription renewal ${row.provider_order_id}`,
      });
    }
  }

  return [
    ...initial.rows.map((row) => ({
      grant_key: `paypal:order:${row.provider_ref}`,
      user_id: row.user_id,
      credits: row.credits_granted,
      plan: row.plan,
      reason: `Reconciled completed subscription payment ${row.provider_ref}`,
    })),
    ...missingRenewals,
  ];
}

/**
 * A provider capture and our payment/subscription rows can commit milliseconds
 * before the idempotent credit grant. If the process dies in that gap, this
 * repair pass restores the paid entitlement without charging the customer
 * again. grantCreditsOnce makes every repair safe to retry.
 */
export async function reconcileManagedSubscriptionCredits() {
  if (reconciliationRunning) return 0;
  reconciliationRunning = true;
  try {
    const missing = await missingManagedSubscriptionGrants();
    let repaired = 0;
    for (const item of missing) {
      const granted = await grantCreditsOnce({
        key: item.grant_key,
        userId: item.user_id,
        credits: item.credits,
        plan: item.plan,
        reason: item.reason,
      });
      if (granted) repaired += 1;
    }
    if (repaired) logger.warn({ repaired }, '[paypal-managed-subscription] repaired paid subscription credit grants');
    return repaired;
  } catch (error) {
    logger.error({ err: error }, '[paypal-managed-subscription] credit reconciliation failed');
    return 0;
  } finally {
    reconciliationRunning = false;
  }
}

export function startManagedSubscriptionReconciliation() {
  if (reconciliationTimer) return;
  void reconcileManagedSubscriptionCredits();
  reconciliationTimer = setInterval(() => {
    void reconcileManagedSubscriptionCredits();
  }, 5 * 60_000);
  reconciliationTimer.unref?.();
}
