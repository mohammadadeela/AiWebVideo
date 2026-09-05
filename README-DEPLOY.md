# AI WebVideo — Hostinger KVM VPS deployment

This is a pnpm monorepo with a Vite frontend and an Express API. The API serves
the compiled frontend and `/api`, so PM2 runs one application on port 3001.
It has no hosting-platform-specific runtime dependencies.

## What is included

- Multimodal scene generation using real website screenshots as visual references.
- 16:9 and 9:16 projects with native Veo 3.1 1080p or 4K generation at 24 FPS; square delivery is center-safe cropped during mastering.
- Multi-page Playwright capture that waits for fonts, images, and network idle;
  full-page screenshots and a smooth-scrolling MP4 are saved with each project.
- Campaign-image generation grounded in the captured website.
- Cinematic Brand Film mode: the one video mode that is NOT exact-capture —
  every scene is an AI-generated frame (device mockups, glassmorphism cards,
  studio backdrop) grounded in the real logo/products/brand content, animated
  and cut together with the same FFmpeg pipeline as the exact-capture modes.
  Costs more credits than the exact-capture modes because it also calls the
  image-generation model once per scene.
- Firebase/local login with revocable HttpOnly sessions, PostgreSQL credits/jobs, and PayPal Checkout.
- Honest free capture/storyboard preview. A paid pack or plan is required before
  the expensive final production begins.

The premium video path now requests 8-second clips directly from Veo 3.1 at the selected 1080p or 4K resolution and keeps the provider's native 24 FPS cadence. FFmpeg is used only for consistent dimensions, safe square crops, audio finishing, concatenation, and exact brand overlays; it no longer pretends upscaled/interpolated footage is native 4K/60 output.

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
- `DATABASE_URL`, `SESSION_SECRET`, and `GEMINI_API_KEY`. `SESSION_TTL_DAYS`
  is optional (30 by default, capped at 90).
- `ASSETS_DIR=/var/lib/aiwebvideo/assets`.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_ENV`.

The separate Firebase Admin variables, `FIREBASE_ADMIN_CREDENTIAL_JSON`, or
Application Default Credentials are supported. `ADMIN_PASSWORD` is optional
and is used only to bootstrap a missing local login for the configured admin;
it never overrides an existing password.
`FAL_KEY`, Redis, Cloudinary, and the old capture-worker variables are not used
and should not be stored on this server.

If `SESSION_SECRET` is missing or blank, `deploy.sh` generates a private
64-character value in `.env.local`. PM2 starts Node with `.env.local` directly,
so database and authentication variables persist reliably across reloads. The
browser receives only a Secure, HttpOnly, SameSite session cookie; changing or
resetting a password revokes older local sessions. Run the included SQL
migration on every deployment so password history and session-version columns
remain current (`deploy.sh` already does this).

For highest final-video quality, use `GEMINI_VIDEO_MODEL=veo-3.1-generate-preview` and
`GEMINI_IMAGE_MODEL=gemini-3.1-flash-image` unless Google changes the available
model names for your account. `CAPTURE_CONCURRENCY=1` protects a small VPS from
multiple Chromium sessions. `VIDEO_CONCURRENCY=2` is a safe starting point for a
KVM2 VPS; lower it to 1 if FFmpeg memory usage is high.

## PayPal setup

Create a PayPal REST application, then place its Client ID and Secret in
`.env.local`. Use sandbox while testing and live in production:

```dotenv
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_ENV=live
```

No plan IDs or webhook secrets are required. On the first checkout the server
uses the official API to create the catalog product, monthly plans, and the
signed webhook for `https://YOUR_DOMAIN/api/paypal/webhook`. The public
`NEXT_PUBLIC_APP_URL` must therefore be the final HTTPS origin before enabling
checkout. Runtime IDs are stored in PostgreSQL and webhook events are handled
idempotently so retries cannot duplicate credits.

The Client ID and Secret must be copied from the same REST application and
must match `PAYPAL_ENV`. A `401 invalid_client` server log means the provider
rejected that pair: it is commonly caused by combining credentials from two
applications, using live credentials with `sandbox`, using sandbox credentials
with `live`, or generating a random value instead of copying the application's
real Secret. `SESSION_SECRET` is the only random secret generated with
`openssl rand -hex 32`; it must not be used as `PAYPAL_CLIENT_SECRET`.

Every deployment runs the additive database upgrades before restarting the
server. This is required for older installations whose `subscriptions` table
does not yet contain `current_period_start`, `current_period_end`, `created_at`,
or `updated_at`.

The customer-facing default is the premium `veo-3.1-generate-preview` model. The server charges four credits per generated second at 1080p and six credits per generated second at 4K, plus six credits when separate narration is requested. These rates are fixed by the server even if an operator chooses a cheaper provider model. Re-check Google's provider pricing before changing plan prices, credit grants, or model settings.

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
- Configure spending limits/alerts in Google Cloud and review payment risk controls.
- Keep `NEXT_PUBLIC_APP_URL` equal to the exact production HTTPS origin; it is
  also used to reject cross-site cookie-authenticated write requests.

The included metadata, sitemap, robots, structured data, `/llms.txt`, and
`/ai.txt` improve crawlability. Search position and recommendations by search
engines or AI systems cannot be guaranteed.
