import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_DAYS,
  sessionCookieOptions,
  signLocalJwt,
} from '../src/lib/auth.js';
import { passwordMatchesAny } from '../src/lib/password-security.js';

test('session cookie is HttpOnly, same-site, scoped, and time limited', () => {
  const options = sessionCookieOptions();
  assert.equal(SESSION_COOKIE_NAME, 'aiwebvideo_session');
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
  assert.equal(options.maxAge, SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
});

test('production session cookies require HTTPS', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal(sessionCookieOptions().secure, true);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test('local session token contains the revocable session version', () => {
  const decoded = jwt.decode(signLocalJwt('user-123', 7)) as Record<string, unknown>;
  assert.equal(decoded.sub, 'user-123');
  assert.equal(decoded.type, 'local');
  assert.equal(decoded.sv, 7);
});

test('password history comparison rejects current or previous passwords', async () => {
  const hashes = await Promise.all([
    bcrypt.hash('Current secure password', 4),
    bcrypt.hash('Previous secure password', 4),
  ]);
  assert.equal(await passwordMatchesAny('Current secure password', hashes), true);
  assert.equal(await passwordMatchesAny('Previous secure password', hashes), true);
  assert.equal(await passwordMatchesAny('Brand new secure password', hashes), false);
});
