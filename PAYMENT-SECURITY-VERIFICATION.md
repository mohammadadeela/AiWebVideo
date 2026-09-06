# Payment, credit, and security verification

Verified on 2026-09-01.

## Required payment environment

Only the REST application Client ID and Secret are required. Use sandbox while
testing and change the environment to live only for production credentials.

```dotenv
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_ENV=live
NEXT_PUBLIC_APP_URL=https://your-domain.example
```

`NEXT_PUBLIC_APP_URL` must be the final public HTTPS origin. At the first
checkout, the API automatically creates or reuses the catalog product, three
monthly plans, and the signed webhook. Their non-secret IDs are stored in the
`system_settings` PostgreSQL table, so no plan ID or webhook secret needs to be
added to the environment.

Before accepting payments, run `pnpm db:migrate`, deploy the built application,
and complete one sandbox purchase for a one-time pack and one monthly plan.

## Server-owned catalog

| Product | Charge | Credits |
|---|---:|---:|
| Creator monthly | $39.00 | 150 |
| Pro monthly | $99.00 | 400 |
| Agency monthly | $249.00 | 1,000 |
| Quick Video | $9.99 | 38 |
| Standard Video | $34.99 | 134 |
| Full Video | $69.99 | 262 |
| Credit recharge | $25.00 | 100 |

The browser submits only a product identifier. The API chooses the exact USD
amount and credit grant from this fixed catalog and validates the completed
order ID, account ID, status, currency, captured amount, and capture record
before granting credits.

## Generation economics

The customer charge is fixed at 4 credits per generated second for 1080p and 6
credits per generated second for 4K. Narration adds 6 credits once. A photo set
adds 8 credits once. Changing the internal video model cannot lower the charge.

Using the lowest plan value ($0.249 per credit), the current official Standard
video costs ($0.40/s at 1080p and $0.60/s at 4K), and a conservative 6% payment
fee reserve, both video qualities return about 2.34x provider cost. Automated
tests enforce a minimum 2x provider-cost floor for subscriptions, one-time video
packs, photo sets, and credit recharges.

## Security controls verified

- Final generation requires an active authenticated account and an owned job.
- The render charge and job claim happen in one PostgreSQL transaction.
- Insufficient balances cannot start a provider generation.
- Zero-credit preview planning uses the local deterministic planner and does
  not call the paid planning API.
- Text-only studio setup makes no provider call before the paid render claim.
- Completed-order and signed-webhook grants are idempotent and cannot duplicate
  credits on retries or refreshed return URLs.
- Checkout is rate-limited independently by account and IP.
- Suspended accounts are rejected on required and optional-auth routes.
- Generated assets require expiring HMAC-signed URLs.
- Website capture validates targets and blocks private/link-local addresses and
  unsafe browser subrequests.
- No legacy payment-provider route, dependency, environment key, or UI control
  remains.
- Production dependency audit reports no known vulnerabilities.

## Verification results

- TypeScript typecheck: passed.
- Frontend production build: passed.
- API production build: passed.
- Automated tests: 95 passed, 0 failed.
- Production dependency audit: no known vulnerabilities.
- Local HTTP smoke check: health, home, and pricing returned 200; checkout
  without authentication returned 401.

Live payment settlement and real model generation require your credentials,
PostgreSQL database, public HTTPS domain, and provider account, so those two
external end-to-end transactions must be completed in sandbox after deployment.
