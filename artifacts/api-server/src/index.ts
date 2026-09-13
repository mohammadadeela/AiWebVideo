import app from "./app";
import { logger } from "./lib/logger";
import { recoverInterruptedJobs } from './lib/queries.js';
import { verifyEmailConnection } from './lib/mailer.js';
import { ensurePaymentClawbackProtection } from './lib/billing.js';
import { ensureSubscriptionReceiptGuard } from './lib/subscription-billing-guards.js';
import { applyTemporaryPaymentTestPricing } from './lib/payment-test-pricing.js';
import { startManagedSubscriptionReconciliation } from './lib/managed-subscription-reconciliation.js';
import { startManagedSubscriptionRenewals } from './routes/paypal-card-subscriptions.js';

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  // TEMPORARY owner-requested live payment test: keep every server checkout
  // path on the same $1 Quick Video price until the test is explicitly ended.
  applyTemporaryPaymentTestPricing();

  // Money-protection must be installed before the server can accept checkout
  // webhooks. A refunded/reversed payment then claws back its purchased credits
  // (and tied welcome bonus) atomically at the database layer.
  await ensurePaymentClawbackProtection();
  await ensureSubscriptionReceiptGuard();

  // Embedded card subscriptions use PayPal-vaulted tokens only. The renewal
  // worker is idempotent, database-locked and starts only after its additive
  // schema upgrades are ready, so a deploy cannot accept a subscription that
  // the server is unable to renew safely.
  await startManagedSubscriptionRenewals();

  // Repair the tiny crash window between a completed provider payment and the
  // idempotent local credit grant. The reconciler never charges a customer; it
  // only restores an entitlement for an already-paid managed subscription.
  startManagedSubscriptionReconciliation();

  try {
    const recovered = await recoverInterruptedJobs();
    if (recovered) logger.warn({ recovered }, 'Marked interrupted jobs for a safe retry');
  } catch (err) {
    logger.error({ err }, 'Could not recover interrupted jobs');
  }

  // Fail loud, not silent — verify the mailbox we send sign-up codes from
  // actually works at boot instead of finding out on someone's first signup.
  void verifyEmailConnection();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

void start();