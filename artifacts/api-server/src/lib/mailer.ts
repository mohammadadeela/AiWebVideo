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
  const pass = (process.env.EMAIL_PASS || '').trim();

  if (!user || !pass) {
    logger.warn('[email] EMAIL_USER or EMAIL_PASS not set — emails will be logged to console instead of sent.');
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
  const pass = (process.env.EMAIL_PASS || '').trim();
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

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:0;background:#fafafa;border:1px solid #eee;border-radius:12px;overflow:hidden;">
      <div style="padding:28px 30px 18px;border-bottom:1px solid #eee;text-align:center;background:#11081f;">
        <div style="display:inline-flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#8b5cf6,#ec4899,#f59e0b);"></span>
          <span style="font-size:16px;font-weight:800;color:#fff;letter-spacing:-0.3px;">${BRAND_NAME}</span>
        </div>
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
 * Sends a 6-digit sign-up verification code. If SMTP isn't configured (e.g.
 * local development) the code is written to the server log instead of
 * throwing, so the rest of the sign-up flow stays testable without a real
 * mailbox — never do this in production, only when EMAIL_USER/EMAIL_PASS
 * are unset.
 */
export async function sendVerificationCodeEmail(to: string, code: string): Promise<void> {
  const t = getTransporter();

  const html = emailShell(`
    <p style="font-size:15px;color:#333;margin:0 0 4px;text-align:center;">Your verification code is</p>
    <div style="text-align:center;margin:20px 0;">
      <span style="font-size:36px;letter-spacing:8px;font-weight:800;color:#111;">${code}</span>
    </div>
    <p style="font-size:13px;color:#888;text-align:center;margin:0;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
  `);

  if (!t) {
    logger.warn(`[email] FALLBACK — verification code for ${redactEmail(to)}: ${code}`);
    return;
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
  } catch (err) {
    logger.error({ err }, '[email] Failed to send verification email');
    logger.warn(`[email] FALLBACK — verification code for ${redactEmail(to)}: ${code}`);
  }
}
