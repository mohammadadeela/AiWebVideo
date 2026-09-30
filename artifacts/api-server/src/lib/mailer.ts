import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from './logger.js';

let transporter: Transporter | null | undefined;

// Never log a full address to stdout/pino — only the first two characters
// of the local part plus the domain, e.g. "jo***@gmail.com".
function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function getSenderEmail(): string {
  return (process.env.EMAIL_USER || '').trim();
}

/**
 * Gmail-only transporter (same setup used across our other projects):
 * an EMAIL_USER Gmail address + an App Password in EMAIL_PASS. Cached as a
 * module-level singleton so we don't re-authenticate on every send.
 */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const user = (process.env.EMAIL_USER || '').trim();
  // Google displays App Passwords grouped with spaces. Accept either the
  // grouped form or the compact 16-character form from .env.local.
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    logger.warn('[email] EMAIL_USER or EMAIL_PASS not set — email delivery is unavailable.');
    transporter = null;
    return null;
  }

  logger.info(`[email] Transporter configured for: ${redactEmail(user)}`);

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
  });

  return transporter;
}

export const isMailerConfigured = () => getTransporter() !== null;

/**
 * Verifies the SMTP connection once at server startup so a bad app password
 * or a typo'd address shows up immediately in the logs, instead of silently
 * failing the first time someone tries to sign up. Call this from index.ts.
 */
export async function verifyEmailConnection(): Promise<void> {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  if (!user || !pass) {
    logger.info('[email] Skipping SMTP verify — credentials not set');
    return;
  }
  const t = getTransporter();
  if (!t) return;
  try {
    await t.verify();
    logger.info('[email] SMTP connection verified successfully');
  } catch (err) {
    logger.error({ err }, '[email] SMTP connection FAILED');
    transporter = null;
  }
}

/* ── Shared branded header ─────────────────────────────────────────── */
const BRAND_NAME = 'AiWebVideo';
const BRAND_URL = 'https://aiwebvideo.com';

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:0;background:#fafafa;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="padding:26px 30px 24px;border-bottom:1px solid #241832;text-align:center;background:#11081f;">
        <a href="${BRAND_URL}" style="display:inline-block;text-decoration:none;color:#ffffff;" target="_blank">
          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:24px;line-height:28px;font-weight:800;letter-spacing:-0.8px;">
            <span style="color:#ec6fb1;">Ai</span><span style="color:#ffffff;">WebVideo</span>
          </span>
        </a>
      </div>
      <div style="padding:30px;background:#fafafa;">
        ${bodyHtml}
      </div>
      <div style="padding:14px 30px;background:#f0f0f0;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#999;">
        ${BRAND_NAME} — turn any website into a professional video
      </div>
    </div>`;
}

/**
 * Sends a 6-digit sign-up verification code and returns true only after
 * Gmail accepts the message. In development the code may also be logged for
 * debugging, but callers still receive false when there was no real delivery.
 */
export async function sendVerificationCodeEmail(to: string, code: string): Promise<boolean> {
  const t = getTransporter();

  const html = emailShell(`
    <p style="font-size:15px;color:#333;margin:0 0 4px;text-align:center;">Your verification code is</p>
    <div style="text-align:center;margin:20px 0;">
      <span style="font-size:36px;letter-spacing:8px;font-weight:800;color:#111;">${code}</span>
    </div>
    <p style="font-size:13px;color:#888;text-align:center;margin:0;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
  `);

  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`[email] DEV FALLBACK — verification code for ${redactEmail(to)}: ${code}`);
    }
    return false;
  }

  try {
    await t.sendMail({
      from: `"${BRAND_NAME}" <${getSenderEmail()}>`,
      to,
      subject: `${code} is your ${BRAND_NAME} verification code`,
      html,
      text: `Your ${BRAND_NAME} verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    });
    logger.info(`[email] Verification email sent to ${redactEmail(to)}`);
    return true;
  } catch (err) {
    logger.error({ err }, '[email] Failed to send verification email');
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`[email] DEV FALLBACK — verification code for ${redactEmail(to)}: ${code}`);
    }
    return false;
  }
}


/** Sends the 6-digit code used to reset a local account password. */
export async function sendPasswordResetCodeEmail(to: string, code: string): Promise<boolean> {
  const t = getTransporter();

  const html = emailShell(`
    <p style="font-size:15px;color:#333;margin:0 0 4px;text-align:center;">Your password reset code is</p>
    <div style="text-align:center;margin:20px 0;">
      <span style="font-size:36px;letter-spacing:8px;font-weight:800;color:#111;">${code}</span>
    </div>
    <p style="font-size:13px;color:#888;text-align:center;margin:0;">This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
  `);

  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`[email] DEV FALLBACK — password reset code for ${redactEmail(to)}: ${code}`);
    }
    return false;
  }

  try {
    await t.sendMail({
      from: `"${BRAND_NAME}" <${getSenderEmail()}>`,
      to,
      subject: `${code} is your ${BRAND_NAME} password reset code`,
      html,
      text: `Your ${BRAND_NAME} password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    });
    logger.info(`[email] Password reset email sent to ${redactEmail(to)}`);
    return true;
  } catch (err) {
    logger.error({ err }, '[email] Failed to send password reset email');
    if (process.env.NODE_ENV !== 'production') {
      logger.warn(`[email] DEV FALLBACK — password reset code for ${redactEmail(to)}: ${code}`);
    }
    return false;
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendAccountEmail(input: { to: string; subject: string; title: string; intro: string; rows?: Array<[string, string]>; note?: string; ctaLabel?: string; ctaUrl?: string }) {
  const t = getTransporter();
  if (!t) return false;
  const rows = (input.rows ?? []).map(([label, value]) => `
    <tr>
      <td style="padding:9px 0;color:#777;font-size:12px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:9px 0;color:#171717;font-size:12px;font-weight:700;text-align:right;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`).join('');
  const html = emailShell(`
    <h1 style="margin:0;color:#171717;font-size:22px;line-height:1.25;text-align:left;">${escapeHtml(input.title)}</h1>
    <p style="margin:12px 0 0;color:#666;font-size:13px;line-height:1.7;">${escapeHtml(input.intro)}</p>
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;">${rows}</table>` : ''}
    ${input.note ? `<p style="margin:18px 0 0;color:#777;font-size:12px;line-height:1.65;">${escapeHtml(input.note)}</p>` : ''}
    ${input.ctaLabel && input.ctaUrl ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(input.ctaUrl)}" target="_blank" style="display:inline-block;border-radius:10px;padding:11px 16px;background:#6d3fc0;color:#fff;text-decoration:none;font-size:12px;font-weight:700;">${escapeHtml(input.ctaLabel)}</a></p>` : ''}
  `);
  try {
    await t.sendMail({
      from: `"${BRAND_NAME}" <${getSenderEmail()}>`,
      to: input.to,
      subject: input.subject,
      html,
      text: [input.title, input.intro, ...(input.rows ?? []).map(([a, b]) => `${a}: ${b}`), input.note ?? '', input.ctaUrl ?? ''].filter(Boolean).join('\n'),
    });
    logger.info(`[email] Account email sent to ${redactEmail(input.to)}: ${input.subject}`);
    return true;
  } catch (err) {
    logger.error({ err }, '[email] Failed to send account/billing email');
    return false;
  }
}

export async function sendCreditPurchaseEmail(input: { to: string; credits: number; amountUsd: number; reference: string; paidAt?: Date }) {
  return sendAccountEmail({
    to: input.to,
    subject: `Your ${BRAND_NAME} credit purchase receipt`,
    title: 'Credits added to your account',
    intro: 'Your payment was confirmed and your production credits are ready to use.',
    rows: [
      ['Credits added', `${input.credits} credits`],
      ['Amount paid', `$${input.amountUsd.toFixed(2)} USD`],
      ['Receipt', input.reference],
      ['Date', (input.paidAt ?? new Date()).toISOString().slice(0, 10)],
    ],
    note: 'Keep this email as your payment receipt. Payment details are handled securely by PayPal; AiWebVideo does not store full card numbers.',
    ctaLabel: 'View billing & usage', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}

export async function sendSubscriptionStartedEmail(input: { to: string; plan: string; credits: number; amountUsd: number; reference: string; nextBillingDate?: string | null }) {
  return sendAccountEmail({
    to: input.to,
    subject: `Your ${BRAND_NAME} ${input.plan} plan is active`,
    title: `${input.plan} plan activated`,
    intro: 'Your monthly plan is active. Credits are added after each successful billing cycle and renewal is automatic until you cancel it.',
    rows: [
      ['Plan', input.plan],
      ['Monthly credits', `${input.credits} credits`],
      ['Monthly price', `$${input.amountUsd.toFixed(2)} USD`],
      ['Subscription', input.reference],
      ...(input.nextBillingDate ? [['Next billing date', input.nextBillingDate] as [string, string]] : []),
    ],
    note: 'Your payment method remains with PayPal and is used for automatic renewals. You can stop renewal from Account → Billing.',
    ctaLabel: 'Manage subscription', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}

export async function sendSubscriptionRenewalEmail(input: { to: string; plan: string; credits: number; amountUsd: number; reference: string; nextBillingDate?: string | null }) {
  return sendAccountEmail({
    to: input.to,
    subject: `${BRAND_NAME} monthly invoice — ${input.plan}`,
    title: 'Monthly renewal confirmed',
    intro: 'Your subscription renewed successfully and this month’s credits were added to your account.',
    rows: [
      ['Plan', input.plan],
      ['Credits added', `${input.credits} credits`],
      ['Amount paid', `$${input.amountUsd.toFixed(2)} USD`],
      ['Invoice / payment reference', input.reference],
      ...(input.nextBillingDate ? [['Next billing date', input.nextBillingDate] as [string, string]] : []),
    ],
    note: 'This email is your renewal invoice/receipt. You can review your billing history and usage in your account.',
    ctaLabel: 'View billing history', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}

export async function sendSubscriptionCancelledEmail(input: { to: string; plan?: string | null; periodEnd?: string | null }) {
  return sendAccountEmail({
    to: input.to,
    subject: `${BRAND_NAME} automatic renewal cancelled`,
    title: 'Automatic renewal is off',
    intro: 'Your subscription will no longer renew automatically.',
    rows: [
      ...(input.plan ? [['Plan', input.plan] as [string, string]] : []),
      ...(input.periodEnd ? [['Access through', input.periodEnd] as [string, string]] : []),
    ],
    note: 'Your existing credits remain on your account. You can start a new plan any time from Pricing.',
    ctaLabel: 'Open account', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}

export async function sendSubscriptionPaymentFailedEmail(input: { to: string; plan?: string | null; reference?: string | null }) {
  return sendAccountEmail({
    to: input.to,
    subject: `Action needed: ${BRAND_NAME} subscription payment failed`,
    title: 'We could not renew your plan',
    intro: 'PayPal reported that the latest subscription payment did not complete. No new monthly credits were added for the failed payment.',
    rows: [
      ...(input.plan ? [['Plan', input.plan] as [string, string]] : []),
      ...(input.reference ? [['Subscription', input.reference] as [string, string]] : []),
    ],
    note: 'Please review your payment method in PayPal. Your existing AiWebVideo credits and projects are not removed by this notice.',
    ctaLabel: 'View billing', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}


export async function sendPaymentRefundedEmail(input: { to: string; amountUsd?: number | null; reference: string; reversed?: boolean }) {
  return sendAccountEmail({
    to: input.to,
    subject: `${BRAND_NAME} payment ${input.reversed ? 'reversal' : 'refund'} notice`,
    title: input.reversed ? 'A payment was reversed' : 'Your refund was recorded',
    intro: input.reversed
      ? 'PayPal reported that a previous payment was reversed. Your billing history has been updated.'
      : 'PayPal reported a refund for a previous payment. Your billing history has been updated.',
    rows: [
      ...(typeof input.amountUsd === 'number' ? [['Amount', `$${input.amountUsd.toFixed(2)} USD`] as [string, string]] : []),
      ['Payment reference', input.reference],
    ],
    note: 'If you have questions about this payment, review the transaction in PayPal and your AiWebVideo billing history.',
    ctaLabel: 'View billing history', ctaUrl: `${BRAND_URL}/profile#billing`,
  });
}


export async function sendWelcomeEmail(input: { to: string }) {
  return sendAccountEmail({
    to: input.to,
    subject: `Welcome to ${BRAND_NAME}`,
    title: 'Your AiWebVideo account is ready',
    intro: 'You can now keep projects, credits, billing and completed media connected to one account.',
    rows: [
      ['Website preview', 'Free before paid generation'],
      ['Workspace', 'Saved projects and live progress'],
      ['Usage', 'Credits, productions and billing history'],
    ],
    note: 'Start with a website URL, an idea, or a product reference. Paid generation always shows/checks the required credits before provider work begins.',
    ctaLabel: 'Start creating', ctaUrl: `${BRAND_URL}/#generate`,
  });
}

export async function sendPasswordChangedEmail(input: { to: string }) {
  return sendAccountEmail({
    to: input.to,
    subject: `${BRAND_NAME} password changed`,
    title: 'Your password was changed',
    intro: 'The password for your AiWebVideo account was updated successfully.',
    note: 'If you made this change, no action is needed. If you did not, reset your password immediately and review your account access.',
    ctaLabel: 'Open account security', ctaUrl: `${BRAND_URL}/profile#security`,
  });
}
