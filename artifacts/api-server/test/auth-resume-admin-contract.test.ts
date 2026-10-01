import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const be = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');

test('Google/GitHub sign-in links to the account that already uses the email instead of crashing on it', async () => {
  const queries = await be('lib/queries-base.ts');
  assert.match(queries, /decideFirebaseAccount\(/);
  assert.match(queries, /lower\(email\)=lower\(\$1\)/);                 // old mixed-case accounts are found
  assert.doesNotMatch(queries, /ON CONFLICT \(firebase_uid\) DO UPDATE/); // the statement that hit the unique email
  const user = await be('routes/user.ts');
  for (const code of ['NO_PASSWORD_SET', 'ACCOUNT_SUSPENDED', 'INVALID_TOKEN']) assert.ok(user.includes(code), code);
  assert.match(user, /allowCreate: operations\.registrationsEnabled/);
});

test('the sign-in window shows the real reason, clears stale errors and keeps the error code for support', async () => {
  const modal = await fe('components/auth/AuthModal.tsx');
  assert.match(modal, /if \(err instanceof ApiError\)/);
  assert.match(modal, /if \(error\) setError\(null\)/);
  assert.match(modal, /could not complete sign-in\$\{code \?/);
});

test('a request made before signing in is saved first, keeps its example and idea, expires, and cancel removes it', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.match(widget, /void saveStudioHandoff\(request\);\s*pendingActionRef\.current = \(\) => redirectStudioSubmitToWorkspace\(request\)/);
  assert.match(widget, /studioDirection: request\.studioDirection,\s*templateId: request\.templateId,/);
  assert.match(widget, /clearPhotoDraft\(abandoned\.attachmentDraftKey\)/);
  assert.match(widget, /handoffDestination\(waiting\)/);
  const handoff = await fe('lib/publicCreatorHandoff.ts');
  assert.match(handoff, /HANDOFF_MAX_AGE_MS = 30 \* 60 \* 1000/);
  assert.match(handoff, /templateId\?: string/);
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /rememberPendingSample\(sample\)/);
  assert.match(form, /startsWith\("\/dashboard"\)/);
});

test('admin roles are a labelled pill with a confirmation, not an unlabeled switch', async () => {
  const page = await fe('pages/AdminPage.tsx');
  assert.match(page, /<RoleControl /);
  assert.doesNotMatch(page, /<Switch checked=\{isAdmin\}/);
  assert.match(page, /is now an administrator\./);
  assert.match(page, /Administrator access removed\./);
  const role = await fe('components/admin/RoleControl.tsx');
  assert.match(role, /You can't remove your own administrator access\./);
  assert.match(role, /This is the last administrator\./);
  assert.match(role, /Make administrator/);
});

test('Generate stays above the examples and attachments, which scroll sideways and take many items', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.ok(form.indexOf('onClick={submit}') < form.indexOf('<SampleStrip'), 'Generate must come before the examples');
  assert.ok(form.indexOf('onClick={submit}') < form.indexOf('{previews.length > 0 && ('), 'Generate must come before the attachments');
  assert.match(form, /Remove \$\{preview\.file\.name\}/);
  const marketing = await be('lib/marketing.ts');
  assert.match(marketing, /MAX_MARKETING_VIDEOS = 280/);
  assert.match(await fe('components/landing/VideoShowcase.tsx'), /Show more/);
});

test('the website field has a globe that turns around itself and respects reduced motion', async () => {
  assert.match(await fe('components/chat/WebsiteBriefForm.tsx'), /<SpinningGlobe size=\{18\} \/>/);
  const css = await fe('index.css');
  assert.match(css, /\.globe-meridian \{[\s\S]*animation: globe-turn 6s/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.globe-meridian \{ animation: none/);
});

test('the profile Add credits button opens the full purchase list', async () => {
  const profile = await fe('pages/ProfilePage.tsx');
  assert.match(profile, /<PurchaseModal[\s\S]*title="Add credits"/);
  assert.doesNotMatch(profile, /SecureCheckoutModal/);
});
