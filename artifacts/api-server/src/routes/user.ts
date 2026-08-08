import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { requireAuth } from '../lib/auth.js';
import { signLocalJwt } from '../lib/auth.js';
import { getOrCreateUser, getUserByLocalAuth, createLocalUser, getJobsByUser } from '../lib/queries.js';
import { AppError, sendError } from '../lib/errors.js';
import { getFirebaseAuth } from '../lib/firebase-admin.js';
import { z } from 'zod';
import { getOperationsSettings } from '../lib/provider-config.js';

const router = Router();

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
