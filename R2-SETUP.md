# Cloudflare R2 setup for AiWebVideo

The application now uses a private Cloudflare R2 bucket as durable media storage. Keep `ASSETS_DIR` because Playwright and FFmpeg still need a local working directory/cache while processing media.

## 1. Create the bucket

In Cloudflare Dashboard, open **Storage & databases → R2 → Overview → Create bucket**.

Suggested bucket name:

```text
aiwebvideo-assets
```

The bucket can stay private. You do not need to enable the public `r2.dev` URL for this application.

## 2. Create S3 credentials

In **R2 → Overview**, choose **Manage** under API Tokens, then create an Account or User API token with **Object Read & Write** access scoped to the AiWebVideo bucket.

On the token confirmation page, save all of these values immediately:

- S3 API endpoint
- Access Key ID
- Secret Access Key

The Secret Access Key cannot be viewed again after leaving that page.

## 3. Add the values to `/var/www/aiwebvideo/.env.local`

```env
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=aiwebvideo-assets
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_PREFIX=aiwebvideo

ASSETS_DIR=/var/lib/aiwebvideo/assets
```

Use the exact S3 endpoint Cloudflare gives you. Jurisdiction-specific buckets can use a different endpoint hostname.

## 4. Deploy

Run the project's normal `deploy.sh`. Deployment now refuses to continue if the required R2 credentials are missing. It also checks existing files in `ASSETS_DIR` and uploads any that are not already present in R2 before reloading the application.

## Storage behavior

- Screenshots and user uploads are persisted to R2 when saved.
- Completed generated photos, videos, recordings, and admin marketing media are persisted to R2.
- The existing signed `/api/assets/...` access rules remain in place.
- The VPS filesystem remains a local processing/hot-cache layer, not the durable media store.
- If a cached source image is missing locally, the server can restore it from R2 for later edits/reuse.
