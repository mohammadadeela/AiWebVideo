import app from "./app";
import { logger } from "./lib/logger";
import { recoverInterruptedJobs } from './lib/queries.js';
import { verifyEmailConnection } from './lib/mailer.js';
import { ensurePaymentClawbackProtection } from './lib/billing.js';

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
  // Money-protection must be installed before the server can accept checkout
  // webhooks. A refunded/reversed payment then claws back its purchased credits
  // (and tied welcome bonus) atomically at the database layer.
  await ensurePaymentClawbackProtection();

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
