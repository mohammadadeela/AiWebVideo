import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideFirebaseAccount, providerDisplayName } from '../src/lib/firebase-account.js';

const account = (over: Partial<{ id: string; email: string; firebase_uid: string | null; password_hash: string | null }> = {}) => ({
  id: 'u1', email: 'mohammad.adeela@gmail.com', firebase_uid: 'local:mohammad.adeela@gmail.com', password_hash: 'hash', ...over,
});

test('the same Firebase identity signing in again is the same account', () => {
  const user = account({ firebase_uid: 'g-123' });
  assert.deepEqual(decideFirebaseAccount({ byUid: user, byEmail: user, email: user.email, emailVerified: true }), { action: 'existing', user });
});

test('Google/GitHub with the email of a password account links to it instead of crashing on the unique email', () => {
  const user = account();
  const result = decideFirebaseAccount({ byUid: null, byEmail: user, email: 'mohammad.adeela@gmail.com', emailVerified: true });
  assert.equal(result.action, 'link');
  assert.equal(result.action === 'link' && result.user.id, 'u1');
});

test('an unverified provider email never takes over an existing account', () => {
  const result = decideFirebaseAccount({ byUid: null, byEmail: account(), email: 'mohammad.adeela@gmail.com', emailVerified: false });
  assert.equal(result.action, 'reject');
  assert.equal(result.action === 'reject' && result.code, 'EMAIL_UNVERIFIED');
});

test('a brand-new person is created, whether or not the provider verified the email', () => {
  assert.deepEqual(decideFirebaseAccount({ byUid: null, byEmail: null, email: 'new@example.com', emailVerified: true }), { action: 'create' });
  assert.deepEqual(decideFirebaseAccount({ byUid: null, byEmail: null, email: 'new@example.com', emailVerified: false }), { action: 'create' });
});

test('a sign-in with no email is refused with a message the person can act on (not a database error)', () => {
  const result = decideFirebaseAccount({ byUid: null, byEmail: null, email: '  ', emailVerified: false });
  assert.equal(result.action, 'reject');
  assert.equal(result.action === 'reject' && result.code, 'EMAIL_MISSING');
  assert.match(result.action === 'reject' ? result.message : '', /email/i);
});

test('provider names are shown the way customers know them', () => {
  assert.equal(providerDisplayName('google'), 'Google');
  assert.equal(providerDisplayName('GitHub'), 'GitHub');
  assert.equal(providerDisplayName('email'), null);
  assert.equal(providerDisplayName(undefined), null);
});
