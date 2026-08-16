import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { requireAuth } from '../lib/auth.js';
import { signLocalJwt } from '../lib/auth.js';
import {
  getOrCreateUser, getUserByLocalAuth, createLocalUser, getJobsByUser,
  upsertPendingVerification, getPendingVerification, bumpVerificationAttempts, deletePendingVerification,
} from '../lib/queries.js';
import { AppError, sendError } from '../lib/errors.js';
import { getFirebaseAuth } from '../lib/firebase-admin.js';
import { sendVerificationCodeEmail } from '../lib/mailer.js';
import { z } from 'zod';
import { getOperationsSettings } from '../lib/provider-config.js';

const router = Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const CODE_REQUEST_WINDOW_MS = 60 * 1000;
const codeRequestAttempts = new Map<string, number>();

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

// GET /api/user/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      id: req.user!.id,
      email: req.user!.email,
      plan: req.user!.plan,
      creditsBalance: req.user!.creditsBalance,
      isAdmin: req.user!.isAdmin,
      accountStatus: req.user!.accountStatus,
    });
  } catch (err) {
    sendError(res, err);
  }
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
          screenshotUrl: metadata?.screenshotUrl ?? null,
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

// Legacy top-up endpoint: the frontend now uses signed Stripe Checkout.
router.post('/topup', requireAuth, async (_req, res) => {
  res.status(400).json({ error: 'Use /api/stripe/checkout with plan topup100.', code: 'USE_CHECKOUT' });
});

// POST /api/auth/login (local JWT auth) — registered at /login when mounted at /auth
router.post('/login', async (req, res) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    let user = await getUserByLocalAuth(normalizedEmail);

    // Ensure the configured admin credentials can initialize or repair the
    // admin's database login. The configured password remains server-only and
    // the database receives only its bcrypt hash.
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isConfiguredAdmin = Boolean(adminEmail && adminPassword && normalizedEmail === adminEmail);
    const suppliedPassword = Buffer.from(password);
    const configuredPassword = Buffer.from(adminPassword ?? '');
    const validAdminPassword = isConfiguredAdmin
      && suppliedPassword.length === configuredPassword.length
      && timingSafeEqual(suppliedPassword, configuredPassword);
    if (validAdminPassword) {
      const storedPasswordAlreadyMatches = user?.password_hash
        ? await bcrypt.compare(password, user.password_hash)
        : false;
      if (!storedPasswordAlreadyMatches) {
        user = await createLocalUser(normalizedEmail, await bcrypt.hash(password, 12), process.env.ADMIN_EMAIL);
      }
    }

    if (!user?.password_hash) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');

    const token = signLocalJwt(user.id);
    res.json({
      token,
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
      password: z.string().min(6),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    const existing = await getUserByLocalAuth(normalizedEmail);
    if (existing?.password_hash) throw new AppError('An account already exists for this email.', 409, 'ACCOUNT_EXISTS');

    if (!allowCodeRequest(normalizedEmail)) {
      throw new AppError('Please wait a minute before requesting another code.', 429, 'RATE_LIMITED');
    }

    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    const passwordHash = await bcrypt.hash(password, 12);
    await upsertPendingVerification(normalizedEmail, passwordHash, codeHash, new Date(Date.now() + CODE_TTL_MS));

    await sendVerificationCodeEmail(normalizedEmail, code);

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

    const token = signLocalJwt(user.id);
    res.status(201).json({
      token,
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
    const pending = await getPendingVerification(normalizedEmail);
    if (!pending) throw new AppError('Start sign-up again with your email and password.', 400, 'CODE_NOT_FOUND');
    if (!allowCodeRequest(normalizedEmail)) {
      throw new AppError('Please wait a minute before requesting another code.', 429, 'RATE_LIMITED');
    }
    const code = generateCode();
    const codeHash = await bcrypt.hash(code, 10);
    await upsertPendingVerification(normalizedEmail, pending.password_hash, codeHash, new Date(Date.now() + CODE_TTL_MS));
    await sendVerificationCodeEmail(normalizedEmail, code);
    res.status(200).json({ sent: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/register (local JWT auth)
router.post('/register', async (req, res) => {
  try {
    const operations = await getOperationsSettings();
    if (!operations.registrationsEnabled) throw new AppError('New registrations are temporarily paused.', 503, 'REGISTRATIONS_PAUSED');
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(req.body);

    const normalizedEmail = email.toLowerCase();
    const existing = await getUserByLocalAuth(normalizedEmail);
    if (existing) {
      throw new AppError('An account already exists for this email.', 409, 'ACCOUNT_EXISTS');
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createLocalUser(normalizedEmail, passwordHash, adminEmail);

    const token = signLocalJwt(user.id);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/auth/firebase (exchange Firebase token for user record)
router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = z.object({ idToken: z.string() }).parse(req.body);

    const auth = getFirebaseAuth();
    if (!auth) throw new AppError('Firebase auth not configured.', 503, 'FIREBASE_NOT_CONFIGURED');

    const decoded = await auth.verifyIdToken(idToken);
    const adminEmail = process.env.ADMIN_EMAIL;
    const user = await getOrCreateUser(decoded.uid, decoded.email ?? '', adminEmail);

    const localToken = signLocalJwt(user.id);
    res.json({
      token: localToken,
      user: { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
