# AI WebVideo — Hostinger KVM VPS deployment

This is a pnpm monorepo with a Vite frontend and an Express API. The API serves
the compiled frontend and `/api`, so PM2 runs one application on port 3001.
It has no hosting-platform-specific runtime dependencies.

## What is included

- Multimodal scene generation using real website screenshots as visual references.
- 16:9 and 9:16 projects, 1080p delivery, and an optional 4K/60 mastered export.
- Multi-page Playwright capture that waits for fonts, images, and network idle;
  full-page screenshots and a smooth-scrolling MP4 are saved with each project.
- Campaign-image generation grounded in the captured website.
- Cinematic Brand Film mode: the one video mode that is NOT exact-capture —
  every scene is an AI-generated frame (device mockups, glassmorphism cards,
  studio backdrop) grounded in the real logo/products/brand content, animated
  and cut together with the same FFmpeg pipeline as the exact-capture modes.
  Costs more credits than the exact-capture modes because it also calls the
  image-generation model once per scene.
- Firebase login, PostgreSQL credits/jobs, Stripe Checkout and Billing Portal.
- Honest free capture/storyboard preview. A paid pack or plan is required before
  the expensive final production begins.

The current video engine returns short 720p video clips. The 1080p and 4K/60 modes
are delivery masters created from those clips with FFmpeg scaling, interpolation,
transitions, and native/generated audio. They are not native 4K/60 model output.

## One-time server setup

Install Node.js 20+, PostgreSQL, Nginx, PM2, FFmpeg, Git, and Certbot. The
project is pinned to pnpm 10.28.2 for compatibility with Node.js 20. Clone the
repository to `/var/www/aiwebvideo`, copy `.env.example` to `.env.local`, and add
newly rotated credentials. Never commit `.env.local`.

Create the database and asset directory:

```bash
sudo -u postgres createuser -P aiwebvideo_user
sudo -u postgres createdb -O aiwebvideo_user aiwebvideo
sudo install -d -o "$USER" -g "$USER" -m 0750 /var/lib/aiwebvideo/assets
```

Install PM2 and its startup service once:

```bash
sudo npm install -g pm2
pm2 startup
```

Run the command printed by `pm2 startup`, then deploy:

```bash
cd /var/www/aiwebvideo
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` installs the locked dependencies with the Node 20-compatible pnpm
version in an AiWebVideo-only cache, installs Playwright Chromium from the API
workspace, applies the SQL migration, builds both apps, reloads only
`aiwebvideo-web`, and checks `/api/health`.
System `ffmpeg` and `ffprobe` executables are required.

## Environment

At minimum, configure:

- `NEXT_PUBLIC_APP_URL` and `ALLOWED_ORIGIN`: the same public HTTPS origin.
- Firebase browser values and Firebase Admin credentials.
- `DATABASE_URL`, `SESSION_SECRET`, and `GEMINI_API_KEY`.
- `ASSETS_DIR=/var/lib/aiwebvideo/assets`.
- Stripe secret, webhook secret, and every Stripe Price ID listed below.

The separate Firebase Admin variables, `FIREBASE_ADMIN_CREDENTIAL_JSON`, or
Application Default Credentials are supported. `FAL_KEY`, Redis, Cloudinary,
the old capture-worker variables, and `ADMIN_PASSWORD` are not used and should
not be stored on this server.

If `SESSION_SECRET` is missing or blank, `deploy.sh` generates a private
64-character value in `.env.local`. PM2 starts Node with `.env.local` directly,
so database and authentication variables persist reliably across reloads.

Keep `GEMINI_VIDEO_MODEL=gemini-omni-flash-preview` and
`GEMINI_IMAGE_MODEL=gemini-3.1-flash-image` unless Google changes the available
model names for your account. `CAPTURE_CONCURRENCY=1` protects a small VPS from
multiple Chromium sessions. `VIDEO_CONCURRENCY=2` is a safe starting point for a
KVM2 VPS; lower it to 1 if FFmpeg memory usage is high.

## Stripe setup

Create these prices in Stripe and copy each `price_...` identifier to
`.env.local`:

| Environment variable | Type | Customer price | Credits |
|---|---:|---:|---:|
| `STRIPE_PRICE_CREATOR` | Monthly | $39 | 150 |
| `STRIPE_PRICE_PRO` | Monthly | $99 | 400 |
| `STRIPE_PRICE_AGENCY` | Monthly | $249 | 1,000 |
| `STRIPE_PRICE_SINGLE_8` | One-time | $2.99 | 8 |
| `STRIPE_PRICE_SINGLE_30` | One-time | $7.99 | 24 |
| `STRIPE_PRICE_SINGLE_60` | One-time | $17.99 | 56 |
| `STRIPE_PRICE_TOPUP_100_CREDITS` | One-time | $25 | 100 |

Add the webhook endpoint `https://YOUR_DOMAIN/api/stripe/webhook` and subscribe
it to:

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`

Copy its signing secret to `STRIPE_WEBHOOK_SECRET`. The checkout webhook is
idempotent, so Stripe retries do not duplicate credits.

The current retail value is at least $0.2475 per credit. A video uses one credit
per delivered second while the configured 720p generation cost is about $0.10
per second, leaving more than a 2x gross generation-cost multiple before server,
payment, tax, support, and refund costs. Re-check Google and Stripe pricing before
changing plan prices or model settings; profit is not guaranteed.

## Nginx and HTTPS

Copy `nginx.conf.example` to `/etc/nginx/sites-available/aiwebvideo`, replace
`YOUR_DOMAIN_OR_IP`, enable the site, test the configuration, and reload Nginx.
After DNS points to the VPS, enable HTTPS with Certbot, then set both public URL
variables to the final `https://` domain and redeploy.

Do not expose port 3001 directly long-term. Nginx should terminate HTTPS and
proxy requests to `127.0.0.1:3001`.

## Updates

Push changes to `main`, then run:

```bash
cd /var/www/aiwebvideo
./deploy.sh
```

If the old three-process application still exists, inspect `pm2 list` and remove
only the obsolete workers after confirming the new web process is healthy:

```bash
pm2 delete aiwebvideo-capture aiwebvideo-render
pm2 save
```

## Security checklist

- Rotate every API key, database password, service-account key, capture secret,
  and admin password that has ever been pasted into chat or committed.
- Give the Firebase and Google service accounts only the permissions they need.
- Keep PostgreSQL and PM2 bound to localhost; expose only ports 80 and 443.
- Back up PostgreSQL and `/var/lib/aiwebvideo/assets`.
- Configure spending limits/alerts in Google Cloud and Stripe fraud controls.

The included metadata, sitemap, robots, structured data, `/llms.txt`, and
`/ai.txt` improve crawlability. Search position and recommendations by search
engines or AI systems cannot be guaranteed.
