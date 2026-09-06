# Setting up sign-in and sign-up email

This covers the two things that can't be fixed in code alone: your Firebase
project's console settings, and an email account to send verification codes
from. All the variable names below match `.env.example` at the repo root.

## 1. Firebase Console — Google & GitHub sign-in

1. Go to https://console.firebase.google.com and open your project (or create one).
2. **Authentication → Sign-in method** → enable **Google** and **GitHub**.
   - Google: toggle on, choose a support email, save.
   - GitHub: you first need a GitHub OAuth App —
     https://github.com/settings/developers → "New OAuth App". Firebase's
     toggle screen shows you the exact **Authorization callback URL** to
     paste into GitHub (it looks like
     `https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`). Once you save
     the GitHub app, copy its **Client ID** and **Client Secret** back into
     the Firebase GitHub provider screen and save.
3. **Authentication → Settings → Authorized domains** — add your real
   production domain (e.g. `your-domain.com`) here. `localhost` is included
   by default for local dev. **This is the #1 reason Google/GitHub sign-in
   silently fails** — if your domain isn't listed, the popup either errors
   with `auth/unauthorized-domain` or just closes with nothing happening.
4. **Project settings (gear icon) → General → Your apps** → add a Web app if
   you haven't, then copy the config block it gives you into these frontend
   env vars (these are public/browser-safe):
   ```
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```
5. **Project settings → Service accounts → Generate new private key** —
   downloads a JSON file. This is the SERVER-side credential (never expose
   this in the frontend). Either:
   - paste the entire JSON file content into `FIREBASE_ADMIN_CREDENTIAL_JSON`, or
   - split it into `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
     and `FIREBASE_ADMIN_PRIVATE_KEY` (all three come from that same JSON).

Without step 5, `/api/auth/firebase` on the backend returns
`FIREBASE_NOT_CONFIGURED` and Google/GitHub sign-in can never finish, even if
the frontend config is correct — the frontend gets a token from Google, but
the backend has no way to verify it and issue your app's own session.

**If Google/GitHub sign-in still fails after this**, open the browser
console during a sign-in attempt — the app now logs the real Firebase error
code there (I fixed this; it used to be swallowed). The most common codes:
- `auth/unauthorized-domain` → step 3 above
- `auth/operation-not-allowed` → step 2 above (provider not enabled)
- `auth/popup-blocked` → the browser blocked the popup, not a config issue

## 2. Email — sending the sign-up verification code

The app sends a 6-digit code by email when someone signs up with a password,
using the same Gmail + App Password setup as our other projects: plain SMTP
through `smtp.gmail.com`, authenticated with `EMAIL_USER` / `EMAIL_PASS`.

1. Turn on 2-Step Verification on the Gmail account you want to send from.
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Set:
   ```
   EMAIL_USER=you@gmail.com
   EMAIL_PASS=<16-character app password, no spaces>
   ```
4. Restart the server. On boot it now calls `verifyEmailConnection()` and
   logs one of:
   - `[email] SMTP connection verified successfully` — good to go.
   - `[email] SMTP connection FAILED` (with the real error) — check the
     address and app password.
   - `[email] Skipping SMTP verify — credentials not set` — `EMAIL_USER`/
     `EMAIL_PASS` aren't set yet.

Gmail caps you at roughly 500 sends/day and may flag automated mail as spam
at higher volume — fine for a verification-code flow, but if you ever need
bulk/marketing email at scale, a transactional provider (Resend, SendGrid,
Postmark) is the better long-term choice; swapping later just means editing
`getTransporter()` in `src/lib/mailer.ts`.

**If you don't configure this yet:** the server doesn't crash — it logs the
verification code to the server console instead of emailing it, so you can
still test sign-up locally. You'll see a line like:
```
[email] FALLBACK — verification code for so***@example.com: 482913
```
Do not ship this to real users; without real credentials configured, nobody
actually receives their code and sign-up can't be completed.

## 3. Apply the database migration

The verification-code flow needs one new table and one new column. Run the
existing migration script after pulling these changes — it's safe to run
repeatedly, it only adds what's missing:
```bash
pnpm --filter @workspace/api-server run migrate
```
