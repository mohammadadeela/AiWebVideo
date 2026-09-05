# Authentication, session, and cache verification

## Implemented controls

- Local sign-in, sign-up, and provider exchange issue a Secure (in production),
  HttpOnly, SameSite=Lax session cookie. New session tokens are never placed in
  localStorage; a one-time compatibility path migrates and deletes older tokens.
- Password changes require the current password. Password reset still requires
  the single-use emailed code.
- The current password and five prior bcrypt hashes cannot be reused. Plain-text
  passwords are never stored.
- Password rotation increments `users.session_version`, invalidating older local
  cookies on every other device. Firebase refresh tokens are revoked when the
  account has a provider identity.
- Cookie-authenticated POST/PUT/PATCH/DELETE requests must have the exact
  `NEXT_PUBLIC_APP_URL` Origin. API responses default to `private, no-store`.
- Hashed frontend assets are cached as immutable for one year. Public marketing
  configuration has a short shared cache, and public SEO files have a one-hour
  cache. Private generated media is never publicly cacheable.
- Sign-in, signup, reset, and profile password fields use standard `username`,
  `current-password`, `new-password`, and `one-time-code` autocomplete values so
  Chrome/Google Password Manager and other browser password managers can save or
  update credentials correctly.

## Deployment check

Run `./deploy.sh`. It applies `artifacts/api-server/db/schema.sql`, builds both
applications, reloads the service, and checks `/api/health`. Use an HTTPS value
for `NEXT_PUBLIC_APP_URL` and keep `SESSION_SECRET` private and stable; changing
that secret signs every user out.

## Package test result

- 99/99 automated API, media, credit, pricing-margin, PayPal, error-handling,
  SEO, upload, password-history, and session tests passed.
- Frontend and API TypeScript checks passed, and both production builds passed.
- Production dependency audit reported no known vulnerabilities.
- Live-server checks confirmed API `no-store`, public marketing short caching,
  immutable hashed-asset caching, cookie clearing, and 403 rejection of a
  cookie-authenticated cross-site write.

The database migration and real provider calls still need to run in the target
deployment because this package intentionally contains no production database,
PayPal credentials, Firebase credentials, or Gemini credentials.

## Admin users-page reliability

- Users and Productions now keep separate search values, so a production search
  cannot silently hide registered accounts after changing tabs.
- The Users page shows a real loading state, displays the exact API failure,
  offers Retry, and provides one-click Clear filters instead of presenting a
  failed request as an empty database.
- Stale overlapping search responses cannot replace newer results, and an
  out-of-range page automatically returns to the last valid page.
- Refreshing Users no longer depends on the unrelated Overview request.
