# Admin user management verification (V12)

This build upgrades `/admin` → **Users** so the administrator sees every registered account category and the data behind it consistently.

## Visible account categories

- Role: Administrator / Customer
- Plan: Free / Creator / Pro / Agency
- Access status: Active / Suspended
- Authentication: Email/password, Google, GitHub, Facebook, Firebase legacy, Unknown legacy
- Email verification: Verified / Unverified
- Pending email sign-ups are displayed separately because they are not real user accounts until the verification code succeeds.

## Per-user data

The users table now shows current credits, purchased credits, total spent credits, refunds, all positive credit additions, total/done/running/failed productions, latest sign-in, account creation/update dates, current/latest subscription provider/status, and lifetime paid amount.

The **Full account details** modal shows safe account metadata, subscriptions, payment history, credit transaction history, and recent productions. Password hashes, Firebase IDs, payment account IDs, and other secrets are not exposed to the browser.

## Admin actions

- Change plan
- Change credit balance
- Suspend/reactivate accounts
- Grant/remove administrator role
- Jump to a user's productions
- View full account history

Self-lockout and last-admin protections remain enforced server-side.

Admin credit balance edits now create a real `credit_transactions` entry equal to the balance delta, so the audit/history numbers remain accurate instead of silently changing only the balance.

## Authentication tracking

The database now tracks `auth_provider` and `last_sign_in_at`. New Firebase logins record Google/GitHub/Facebook when available. Existing Firebase users are migrated as `firebase` until their next sign-in identifies the exact provider. Local accounts are recorded as `email`.

## Static verification

- Parsed all 148 TypeScript/TSX source files successfully.
- Verified the admin API exposes filtered users, summary counts, pending sign-ups and per-user details.
- Verified database migration is idempotent with `ADD COLUMN IF NOT EXISTS`.
- Full dependency typecheck/build still needs the deployment server because this isolated environment cannot download the pinned pnpm package from npm.
