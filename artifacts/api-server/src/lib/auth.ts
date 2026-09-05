import jwt from 'jsonwebtoken';
import { getFirebaseAuth } from './firebase-admin.js';
import { getUserById } from './queries.js';
import type { CookieOptions, Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
  accountStatus: string;
  authProvider: string;
  supportsPasswordChange: boolean;
  sessionVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

const JWT_SECRET = process.env.SESSION_SECRET ?? 'development-only-secret';
const requestedSessionDays = Number.parseInt(process.env.SESSION_TTL_DAYS ?? '30', 10);
export const SESSION_TTL_DAYS = Number.isFinite(requestedSessionDays)
  ? Math.max(1, Math.min(90, requestedSessionDays))
  : 30;
export const SESSION_COOKIE_NAME = 'aiwebvideo_session';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function signLocalJwt(userId: string, sessionVersion = 0): string {
  return jwt.sign(
    { sub: userId, type: 'local', sv: sessionVersion },
    JWT_SECRET,
    { expiresIn: SESSION_TTL_DAYS * 24 * 60 * 60 },
  );
}

export function setSessionCookie(res: Response, userId: string, sessionVersion = 0): void {
  res.cookie(SESSION_COOKIE_NAME, signLocalJwt(userId, sessionVersion), sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

function verifyLocalJwt(token: string): { sub: string; type?: string; sv?: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: unknown; type?: unknown; sv?: unknown };
    if (typeof payload.sub !== 'string' || payload.type !== 'local') return null;
    return {
      sub: payload.sub,
      type: payload.type,
      ...(typeof payload.sv === 'number' ? { sv: payload.sv } : {}),
    };
  } catch {
    return null;
  }
}

function requestToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME];
  return typeof cookieToken === 'string' && cookieToken ? cookieToken : null;
}

function authUserFromRow(row: import('./queries.js').UserRow, configuredAdmin?: string): AuthUser {
  return {
    id: row.id,
    email: row.email,
    plan: row.plan,
    creditsBalance: row.credits_balance,
    isAdmin: row.is_admin || row.email.toLowerCase() === configuredAdmin,
    accountStatus: row.account_status,
    authProvider: row.auth_provider,
    supportsPasswordChange: Boolean(row.password_hash),
    sessionVersion: row.session_version,
  };
}

export async function resolveUser(token: string): Promise<AuthUser | null> {
  const configuredAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  // Local sessions are revocable: password changes increment session_version,
  // immediately invalidating every previously issued browser cookie/token.
  const localPayload = verifyLocalJwt(token);
  if (localPayload) {
    const row = await getUserById(localPayload.sub);
    if (!row || (localPayload.sv ?? 0) !== row.session_version) return null;
    return authUserFromRow(row, configuredAdmin);
  }

  // Bearer Firebase tokens are supported for existing clients. Revocation is
  // checked so provider-side revocation takes effect on the API.
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const pool = await import('./pool.js');
    const result = await pool.query<import('./queries.js').UserRow>(
      'SELECT * FROM users WHERE firebase_uid=$1 LIMIT 1',
      [decoded.uid],
    );
    const user = result.rows[0];
    return user ? authUserFromRow(user, configuredAdmin) : null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = requestToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sign in is required.', code: 'UNAUTHORIZED' });
    return;
  }
  const user = await resolveUser(token);
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Session invalid or expired.', code: 'UNAUTHORIZED' });
    return;
  }
  req.user = user;
  res.locals.isAdmin = user.isAdmin;
  if (user.accountStatus !== 'active') {
    res.status(403).json({ error: 'This account is currently unavailable. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Administrator access is required.', code: 'ADMIN_REQUIRED' });
      return;
    }
    next();
  });
}

export async function tryAuth(req: Request, res: Response, next: NextFunction) {
  const token = requestToken(req);
  if (token) {
    const user = await resolveUser(token).catch(() => null);
    if (user) {
      if (user.accountStatus !== 'active') {
        res.status(403).json({ error: 'This account is currently unavailable. Please contact support.', code: 'ACCOUNT_SUSPENDED' });
        return;
      }
      req.user = user;
      res.locals.isAdmin = user.isAdmin;
    }
  }
  next();
}
