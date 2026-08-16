import jwt from 'jsonwebtoken';
import { getFirebaseAuth } from './firebase-admin.js';
import { getUserById, getUserByLocalAuth } from './queries.js';
import type { Request, Response, NextFunction } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  plan: string;
  creditsBalance: number;
  isAdmin: boolean;
  accountStatus: string;
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

export function signLocalJwt(userId: string): string {
  return jwt.sign({ sub: userId, type: 'local' }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyLocalJwt(token: string): { sub: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string };
  } catch {
    return null;
  }
}

export async function resolveUser(token: string): Promise<AuthUser | null> {
  const configuredAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  // Try local JWT first
  const localPayload = verifyLocalJwt(token);
  if (localPayload) {
    const row = await getUserById(localPayload.sub);
    if (!row) return null;
    return { id: row.id, email: row.email, plan: row.plan, creditsBalance: row.credits_balance, isAdmin: row.is_admin || row.email.toLowerCase() === configuredAdmin, accountStatus: row.account_status };
  }

  // Try Firebase token
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    // We need to get the user by firebase uid
    const pool = await import('./pool.js');
    const result = await pool.query<import('./queries.js').UserRow>(
      'SELECT * FROM users WHERE firebase_uid=$1 LIMIT 1',
      [decoded.uid]
    );
    const user = result.rows[0];
    if (!user) return null;
    return { id: user.id, email: user.email, plan: user.plan, creditsBalance: user.credits_balance, isAdmin: user.is_admin || user.email.toLowerCase() === configuredAdmin, accountStatus: user.account_status };
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.', code: 'UNAUTHORIZED' });
    return;
  }
  const token = header.slice(7);
  const user = await resolveUser(token);
  if (!user) {
    res.status(401).json({ error: 'Token invalid or expired.', code: 'UNAUTHORIZED' });
    return;
  }
  req.user = user;
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

export async function tryAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    const user = await resolveUser(token).catch(() => null);
    if (user) req.user = user;
  }
  next();
}
