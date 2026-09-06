import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../lib/auth.js';
import {
  getOrCreateUser, getUserById, getUserByLocalAuth, createLocalUser, getJobsByUser, recordUserSignIn,
  upsertPendingVerification, getPendingVerification, bumpVerificationAttempts, deletePendingVerification,
  upsertPendingPasswordReset, getPendingPasswordReset, bumpPasswordResetAttempts, deletePendingPasswordReset,
  getRecentPasswordHashes, rotateLocalPassword,
} from '../lib/queries.js';
import { AppError, sendError } from '../lib/errors.js';
import { getFirebaseAuth } from '../lib/firebase-admin.js';
import { sendVerificationCodeEmail, sendPasswordResetCodeEmail, sendWelcomeEmail, sendPasswordChangedEmail } from '../lib/mailer.js';
import { z } from 'zod';
import { getOperationsSettings } from '../lib/provider-config.js';
import { signPrivateAssetUrl } from '../lib/asset-access.js';
import { passwordMatchesAny } from '../lib/password-security.js';
import { logger } from '../lib/logger.js';
import { query } from '../lib/pool.js';

const router = Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const CODE_REQUEST_WINDOW_MS = 60 * 1000;
const codeRequestAttempts = new Map<string, number>();

type WindowAttempt = { count: number; resetAt: number };
const authAttempts = new Map<string, WindowAttempt>();

function clientIp(req: { ip?: string; socket: { remoteAddress?: string | null } }) {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function allowAuthAttempt(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    if (current.count >= limit) return false;
    current.count += 1;
  }
  if (authAttempts.size > 10_000) {
    for (const [entry, value] of authAttempts) if (value.resetAt <= now) authAttempts.delete(entry);
  }
  return true;
}

function allowCodeRequest(email: string): boolean {
  const now = Date.now();
  const last = codeRequestAttempts.get(email);
  if (last && now - last < CODE_REQUEST_WINDOW_MS) return false;
  codeRequestAttempts.set(email, now);
  if (codeRequestAttempts.size > 5000) {
    for (const [key, ts] of codeRequestAttempts) if (now - ts > CODE_REQUEST_WINDOW_MS) codeRequestAttempts.delete(key);
  }
  return true;
}

function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function firebaseProviderLabel(value: unknown): string {
  switch (String(value ?? 'firebase')) {
    case 'google.com': return 'google';
    case 'github.com': return 'github';
    case 'facebook.com': return 'facebook';
    case 'password': return 'email';
    default: return 'firebase';
  }
}

async function revokeProviderSessions(firebaseUid: string | null): Promise<void> {
  if (!firebaseUid || firebaseUid.startsWith('local:')) return;
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await auth.revokeRefreshTokens(firebaseUid);
  } catch (error) {
    // The local session version has already been rotated. Do not report the
    // whole password change as failed after it succeeded in PostgreSQL.
    logger.warn({ error, firebaseUid }, 'Could not revoke linked provider refresh tokens after password rotation');
  }
}

// GET /api/user/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    // Refresh the cookie on account use and migrate legacy bearer sessions.
    setSessionCookie(res, req.user!.id, req.user!.sessionVersion);
    res.json({
      id: req.user!.id,
      email: req.user!.email,
      plan: req.user!.plan,
      creditsBalance: req.user!.creditsBalance,
      isAdmin: req.user!.isAdmin,
      accountStatus: req.user!.accountStatus,
      authProvider: req.user!.authProvider,
      supportsPasswordChange: req.user!.supportsPasswordChange,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/logout — clears only the browser's signed-in session. It is
// intentionally idempotent so the UI can always finish signing out cleanly.
router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ signedOut: true });
});

// GET /api/user/jobs — real account history, newest first.
router.get('/jobs', requireAuth, async (req, res) => {
  try {
    const jobs = await getJobsByUser(req.user!.id, 100);
    res.json({
      jobs: jobs.map((job) => {
        const metadata = job.capture_metadata as { title?: string; screenshotUrl?: string } | null;
        let fallbackTitle = job.source_url;
        try { fallbackTitle = new URL(job.source_url).hostname.replace(/^www\./, ''); } catch { /* keep URL */ }
        return {
          id: job.id,
          title: job.title || metadata?.title || fallbackTitle,
          sourceUrl: job.source_url,
          status: job.status,
          progress: job.progress,
          mode: job.mode,
          screenshotUrl: metadata?.screenshotUrl ? signPrivateAssetUrl(metadata.screenshotUrl) : null,
          pinned: job.pinned,
          updatedAt: job.updated_at,
          createdAt: job.created_at,
        };
      }),
    });
  } catch (err) {
    sendError(res, err);
  }
});


// GET /api/user/usage — customer-facing production usage, credit history,
// and billing totals. Provider cost details remain admin-only.
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [creditTotals, jobTotals, assetTotals, paymentTotals, recentCredits, modeTotals] = await Promise.all([
      query<{
        used_month: number; used_all: number; added_month: number; added_all: number;
      }>(
        `SELECT
           COALESCE(SUM(CASE WHEN delta < 0 AND created_at >= date_trunc('month',NOW()) THEN -delta ELSE 0 END),0)::int AS used_month,
           COALESCE(SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END),0)::int AS used_all,
           COALESCE(SUM(CASE WHEN delta > 0 AND created_at >= date_trunc('month',NOW()) THEN delta ELSE 0 END),0)::int AS added_month,
           COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END),0)::int AS added_all
         FROM credit_transactions WHERE user_id=$1`,
        [userId],
      ),
      query<{
        projects_month: number; completed_month: number; projects_all: number; completed_all: number;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month',NOW()))::int AS projects_month,
           COUNT(*) FILTER (WHERE status='done' AND created_at >= date_trunc('month',NOW()))::int AS completed_month,
           COUNT(*)::int AS projects_all,
           COUNT(*) FILTER (WHERE status='done')::int AS completed_all
         FROM jobs WHERE user_id=$1 AND deleted_at IS NULL`,
        [userId],
      ),
      query<{ videos_month: number; photos_month: number; videos_all: number; photos_all: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE a.type='video' AND a.created_at >= date_trunc('month',NOW()))::int AS videos_month,
           COUNT(*) FILTER (WHERE a.type='photo' AND a.created_at >= date_trunc('month',NOW()))::int AS photos_month,
           COUNT(*) FILTER (WHERE a.type='video')::int AS videos_all,
           COUNT(*) FILTER (WHERE a.type='photo')::int AS photos_all
         FROM assets a JOIN jobs j ON j.id=a.job_id
         WHERE j.user_id=$1`,
        [userId],
      ),
      query<{ paid_month: string | number; paid_all: string | number }>(
        `SELECT
           COALESCE(SUM(amount_usd) FILTER (WHERE status='paid' AND created_at >= date_trunc('month',NOW())),0) AS paid_month,
           COALESCE(SUM(amount_usd) FILTER (WHERE status='paid'),0) AS paid_all
         FROM payments WHERE user_id=$1`,
        [userId],
      ),
      query<{ id: string; delta: number; reason: string; created_at: Date }>(
        `SELECT id,delta,reason,created_at FROM credit_transactions
         WHERE user_id=$1 ORDER BY created_at DESC LIMIT 24`,
        [userId],
      ),
      query<{ mode: string; count: number }>(
        `SELECT mode,COUNT(*)::int AS count FROM jobs
         WHERE user_id=$1 AND deleted_at IS NULL
           AND created_at >= date_trunc('month',NOW())
         GROUP BY mode ORDER BY COUNT(*) DESC`,
        [userId],
      ),
    ]);

    const credits = creditTotals.rows[0] ?? { used_month: 0, used_all: 0, added_month: 0, added_all: 0 };
    const jobs = jobTotals.rows[0] ?? { projects_month: 0, completed_month: 0, projects_all: 0, completed_all: 0 };
    const assets = assetTotals.rows[0] ?? { videos_month: 0, photos_month: 0, videos_all: 0, photos_all: 0 };
    const paid = paymentTotals.rows[0] ?? { paid_month: 0, paid_all: 0 };

    res.json({
      period: {
        monthStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      },
      balance: req.user!.creditsBalance,
      thisMonth: {
        creditsUsed: Number(credits.used_month) || 0,
        creditsAdded: Number(credits.added_month) || 0,
        projects: Number(jobs.projects_month) || 0,
        completed: Number(jobs.completed_month) || 0,
        videos: Number(assets.videos_month) || 0,
        photos: Number(assets.photos_month) || 0,
        amountPaidUsd: Number(paid.paid_month) || 0,
      },
      allTime: {
        creditsUsed: Number(credits.used_all) || 0,
        creditsAdded: Number(credits.added_all) || 0,
        projects: Number(jobs.projects_all) || 0,
        completed: Number(jobs.completed_all) || 0,
        videos: Number(assets.videos_all) || 0,
        photos: Number(assets.photos_all) || 0,
        amountPaidUsd: Number(paid.paid_all) || 0,
      },
      byMode: modeTotals.rows.map((row) => ({ mode: row.mode, count: Number(row.count) || 0 })),
      recentCredits: recentCredits.rows.map((row) => ({
        id: row.id,
        delta: row.delta,
        reason: row.reason,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Legacy top-up endpoint kept as a safe pointer to the server-owned catalog.
router.post('/topup', requireAuth, async (_req, res) => {
  res.status(400).json({ error: 'Use the checkout endpoint with plan topup100.', code: 'USE_CHECKOUT' });
});

// POST /api/auth/login (local JWT auth) — registered at /login when mounted at /auth
router.post('/login', async (req, res) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1).max(128),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(req);
    if (!allowAuthAttempt(`login-ip:${ip}`, 30, 15 * 60 * 1000) || !allowAuthAttempt(`login-account:${normalizedEmail}`, 12, 15 * 60 * 1000)) {
      throw new AppError('Too many sign-in attempts. Please wait a few minutes and try again.', 429, 'RATE_LIMITED');
    }
    let user = await getUserByLocalAuth(normalizedEmail);

    // The configured admin credentials may initialize a missing local login.
    // They never override an existing password, so the environment value is
    // not a permanent master-password bypass.
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isConfiguredAdmin = Boolean(adminEmail && adminPassword && normalizedEmail === adminEmail);
    const suppliedPassword = Buffer.from(password);
    const configuredPassword = Buffer.from(adminPassword ?? '');
    const validAdminPassword = isConfiguredAdmin
      && suppliedPassword.length === configuredPassword.length
      && timingSafeEqual(suppliedPassword, configuredPassword);
    if (validAdminPassword && !user?.password_hash) {
      user = await createLocalUser(normalizedEmail, await bcrypt.hash(password, 12), process.env.ADMIN_EMAIL);
    }

    if (!user?.password_hash) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');

    await recordUserSignIn(user.id, 'email', user.email_verified);
    setSessionCookie(res, user.id, user.session_version);
    res.json({
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/register/request-code — step 1 of email/password sign-up.
// Validates the email + password, stores them (password already hashed)
// alongside a hashed 6-digit code, and emails the code. No row is created in
// `users` yet, so an abandoned/never-verified sign-up can't block the email.
router.post('/register/request-code', async (req, res) => {
  try {
    const operations = await getOperationsSettings();
    if (!operations.registrationsEnabled) throw new AppError('New registrations are temporarily paused.', 503, 'REGISTRATIONS_PAUSED');
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    if (!allowAuthAttempt(`signup-ip:${clientIp(req)}`, 12, 10 * 60 * 1000)) {
      throw new AppError('Too many sign-up requests from this connection. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    const existing = await getUserByLocalAuth(normalizedEmail);
    if (existing?.password_hash) throw new AppError('An account already exists for this email.', 409, 'ACCOUNT_EXISTS');

    if (!allowCodeRequest(normalizedEmail)) {
      throw new AppError('Please wait a minute before requesting another code.', 429, 'RATE_LIMITED');
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const passwordHash = await bcrypt.hash(password, 12);
    await upsertPendingVerification(normalizedEmail, passwordHash, codeHash, new Date(Date.now() + CODE_TTL_MS));

    const delivered = await sendVerificationCodeEmail(normalizedEmail, code);
    if (!delivered) {
      await deletePendingVerification(normalizedEmail);
      throw new AppError('We could not send the verification email. Check the server EMAIL_USER/EMAIL_PASS configuration and try again.', 503, 'EMAIL_DELIVERY_FAILED');
    }

    res.status(200).json({ sent: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/register/verify-code — step 2: confirm the emailed code and
// create the account. Returns the same shape as /register so the client can
// treat it identically once verified.
router.post('/register/verify-code', async (req, res) => {
  try {
    const { email, code } = z.object({
      email: z.string().email(),
      code: z.string().trim().length(6),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    if (!allowAuthAttempt(`verify-ip:${clientIp(req)}`, 40, 10 * 60 * 1000)) {
      throw new AppError('Too many verification attempts. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    const pending = await getPendingVerification(normalizedEmail);
    if (!pending) throw new AppError('Request a new code — this one was not found or already used.', 400, 'CODE_NOT_FOUND');
    if (pending.expires_at.getTime() < Date.now()) {
      await deletePendingVerification(normalizedEmail);
      throw new AppError('That code expired. Please request a new one.', 400, 'CODE_EXPIRED');
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      await deletePendingVerification(normalizedEmail);
      throw new AppError('Too many incorrect attempts. Please request a new code.', 429, 'CODE_LOCKED');
    }

    const valid = await bcrypt.compare(code, pending.code_hash);
    if (!valid) {
      await bumpVerificationAttempts(normalizedEmail);
      throw new AppError('That code is incorrect. Please check and try again.', 400, 'CODE_INVALID');
    }

    const existing = await getUserByLocalAuth(normalizedEmail);
    if (existing?.password_hash) {
      await deletePendingVerification(normalizedEmail);
      throw new AppError('An account already exists for this email.', 409, 'ACCOUNT_EXISTS');
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const user = await createLocalUser(normalizedEmail, pending.password_hash, adminEmail, true);
    await deletePendingVerification(normalizedEmail);
    await recordUserSignIn(user.id, 'email', true);
    void sendWelcomeEmail({ to: user.email });

    setSessionCookie(res, user.id, user.session_version);
    res.status(201).json({
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/register/resend-code — re-sends a fresh code for an
// in-progress sign-up (same rate limit as the initial request).
router.post('/register/resend-code', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalizedEmail = email.toLowerCase();
    if (!allowAuthAttempt(`signup-ip:${clientIp(req)}`, 12, 10 * 60 * 1000)) {
      throw new AppError('Too many code requests from this connection. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    const pending = await getPendingVerification(normalizedEmail);
    if (!pending) throw new AppError('Start sign-up again with your email and password.', 400, 'CODE_NOT_FOUND');
    if (!allowCodeRequest(normalizedEmail)) {
      throw new AppError('Please wait a minute before requesting another code.', 429, 'RATE_LIMITED');
    }
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    await upsertPendingVerification(normalizedEmail, pending.password_hash, codeHash, new Date(Date.now() + CODE_TTL_MS));
    const delivered = await sendVerificationCodeEmail(normalizedEmail, code);
    if (!delivered) {
      await deletePendingVerification(normalizedEmail);
      throw new AppError('We could not resend the verification email. Check the server email configuration and try again.', 503, 'EMAIL_DELIVERY_FAILED');
    }
    res.status(200).json({ sent: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/forgot-password/request-code — requests a password reset code.
// The response is intentionally identical for known and unknown emails so the
// endpoint cannot be used to discover which addresses have accounts.
router.post('/forgot-password/request-code', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const normalizedEmail = email.toLowerCase();
    const ip = clientIp(req);

    if (!allowAuthAttempt(`reset-ip:${ip}`, 12, 10 * 60 * 1000)) {
      throw new AppError('Too many password reset requests. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    if (!allowCodeRequest(`reset:${normalizedEmail}`)) {
      throw new AppError('Please wait a minute before requesting another code.', 429, 'RATE_LIMITED');
    }

    const user = await getUserByLocalAuth(normalizedEmail);
    if (user?.password_hash) {
      const code = generateCode();
      const codeHash = await bcrypt.hash(code, 10);
      await upsertPendingPasswordReset(normalizedEmail, codeHash, new Date(Date.now() + CODE_TTL_MS));
      const delivered = await sendPasswordResetCodeEmail(normalizedEmail, code);
      if (!delivered) {
        await deletePendingPasswordReset(normalizedEmail);
        throw new AppError('We could not send the password reset email. Check the server EMAIL_USER/EMAIL_PASS configuration and try again.', 503, 'EMAIL_DELIVERY_FAILED');
      }
    }

    res.status(200).json({ sent: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/forgot-password/reset — verifies the code and replaces the
// existing local password. Reset codes are single-use and expire after 10 min.
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, code, password } = z.object({
      email: z.string().email(),
      code: z.string().trim().length(6),
      password: z.string().min(8).max(128),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    if (!allowAuthAttempt(`reset-verify-ip:${clientIp(req)}`, 40, 10 * 60 * 1000)) {
      throw new AppError('Too many reset attempts. Please wait and try again.', 429, 'RATE_LIMITED');
    }

    const pending = await getPendingPasswordReset(normalizedEmail);
    if (!pending) throw new AppError('Request a new password reset code.', 400, 'RESET_CODE_NOT_FOUND');
    if (pending.expires_at.getTime() < Date.now()) {
      await deletePendingPasswordReset(normalizedEmail);
      throw new AppError('That reset code expired. Please request a new one.', 400, 'RESET_CODE_EXPIRED');
    }
    if (pending.attempts >= MAX_CODE_ATTEMPTS) {
      await deletePendingPasswordReset(normalizedEmail);
      throw new AppError('Too many incorrect attempts. Please request a new reset code.', 429, 'RESET_CODE_LOCKED');
    }

    const valid = await bcrypt.compare(code, pending.code_hash);
    if (!valid) {
      await bumpPasswordResetAttempts(normalizedEmail);
      throw new AppError('That reset code is incorrect. Please check your email and try again.', 400, 'RESET_CODE_INVALID');
    }

    const user = await getUserByLocalAuth(normalizedEmail);
    if (!user?.password_hash) {
      await deletePendingPasswordReset(normalizedEmail);
      throw new AppError('This account does not support password sign-in.', 400, 'PASSWORD_LOGIN_UNAVAILABLE');
    }
    const previousHashes = await getRecentPasswordHashes(user.id, 5);
    if (await passwordMatchesAny(password, [user.password_hash, ...previousHashes])) {
      throw new AppError('Choose a password you have not recently used.', 400, 'PASSWORD_REUSED');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await rotateLocalPassword(user.id, user.password_hash, passwordHash);
    if (!updated) throw new AppError('Your password changed in another session. Request a new reset code.', 409, 'PASSWORD_CHANGED');
    await revokeProviderSessions(user.firebase_uid);
    await deletePendingPasswordReset(normalizedEmail);
    clearSessionCookie(res);
    void sendPasswordChangedEmail({ to: user.email });

    res.status(200).json({ reset: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/change-password — requires the current password, prevents
// recent reuse, rotates the session version, and issues only this browser a
// fresh session cookie. All other signed-in devices are logged out.
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    if (!allowAuthAttempt(`change-password:${req.user!.id}:${clientIp(req)}`, 8, 15 * 60 * 1000)) {
      throw new AppError('Too many password-change attempts. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    }).parse(req.body);
    const user = await getUserById(req.user!.id);
    if (!user?.password_hash) {
      throw new AppError('This account does not support password sign-in.', 400, 'PASSWORD_LOGIN_UNAVAILABLE');
    }
    if (!await bcrypt.compare(currentPassword, user.password_hash)) {
      throw new AppError('The current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }
    const previousHashes = await getRecentPasswordHashes(user.id, 5);
    if (await passwordMatchesAny(newPassword, [user.password_hash, ...previousHashes])) {
      throw new AppError('Choose a password you have not recently used.', 400, 'PASSWORD_REUSED');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await rotateLocalPassword(user.id, user.password_hash, passwordHash);
    if (!updated) throw new AppError('Your password changed in another session. Reload and try again.', 409, 'PASSWORD_CHANGED');
    await revokeProviderSessions(user.firebase_uid);
    setSessionCookie(res, updated.id, updated.session_version);
    void sendPasswordChangedEmail({ to: user.email });
    res.json({ changed: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/register (local JWT auth)
router.post('/register', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LEGACY_DIRECT_REGISTER !== 'true') {
      throw new AppError('Use the verified email sign-up flow.', 410, 'VERIFICATION_REQUIRED');
    }
    const operations = await getOperationsSettings();
    if (!operations.registrationsEnabled) throw new AppError('New registrations are temporarily paused.', 503, 'REGISTRATIONS_PAUSED');
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    const existing = await getUserByLocalAuth(normalizedEmail);
    if (existing) {
      throw new AppError('An account already exists for this email.', 409, 'ACCOUNT_EXISTS');
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createLocalUser(normalizedEmail, passwordHash, adminEmail);
    await recordUserSignIn(user.id, 'email', user.email_verified);
    void sendWelcomeEmail({ to: user.email });

    setSessionCookie(res, user.id, user.session_version);
    res.status(201).json({
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/firebase (exchange Firebase token for user record)
router.post('/firebase', async (req, res) => {
  try {
    if (!allowAuthAttempt(`firebase-ip:${clientIp(req)}`, 60, 10 * 60 * 1000)) {
      throw new AppError('Too many sign-in attempts. Please wait and try again.', 429, 'RATE_LIMITED');
    }
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    const auth = getFirebaseAuth();
    if (!auth) throw new AppError('Firebase auth not configured.', 503, 'FIREBASE_NOT_CONFIGURED');

    const decoded = await auth.verifyIdToken(idToken, true);
    const adminEmail = process.env.ADMIN_EMAIL;
    const provider = firebaseProviderLabel(decoded.firebase?.sign_in_provider);
    const verified = Boolean(decoded.email_verified);
    const user = await getOrCreateUser(decoded.uid, decoded.email ?? '', adminEmail, provider, verified);
    await recordUserSignIn(user.id, provider, verified);

    setSessionCookie(res, user.id, user.session_version);
    res.json({
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
