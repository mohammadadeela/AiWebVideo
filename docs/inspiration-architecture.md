# Inspiration and Architecture

Run the existing database migration (`pnpm --filter @workspace/api-server migrate`) before deploying the API. It adds `inspiration_media` and `inspiration_features` without changing existing jobs. The API uses the existing `ASSETS_DIR` and optional R2 storage configuration. No new environment variable is required. Image and video generation still requires the existing `GEMINI_API_KEY` and configured provider capacity.

## Admin media

`/admin/inspiration` accepts mixed image and video batches. SHA-256 detects exact duplicate files. Every upload starts as a draft. An admin can select items, assign one or more real feature IDs, and publish. The server refuses to leave a published item without an assignment. Media is stored once, with assignments in a join table. Thumbnails are generated with ffmpeg and served through the existing asset route.

Public `GET /api/inspiration` supports feature, type, limit and offset. `GET /api/inspiration/:id` accepts only published, assigned media. Admin endpoints are `GET /api/inspiration/admin/items`, `POST /api/inspiration/admin/upload`, and `PATCH /api/inspiration/admin/bulk`; all use server-side `requireAdmin`.

## Generation

The selected inspiration ID is submitted to the existing upload or website capture endpoint. The server verifies publication and feature assignment, copies a normalized visual reference into the job's private capture assets, and persists the ID in capture metadata. Video examples contribute the poster and sampled frames. The existing storyboard and image/video providers receive the source references plus server-only creative guidance. The user prompt stays separate in saved messages and can override the example. Job reuse copies the references for later chat directions.

Product links use `POST /api/product-reference/extract`. It reads a bounded, public HTML page and prioritizes Product JSON-LD imagery, then Open Graph/Twitter hero images. The user chooses images in the composer. At submission, each selected public image is fetched with URL/redirect validation, normalized, and stored as a private job reference. If extraction fails, file upload remains available. Websites without accessible product metadata may need manual uploads.

The credit card reads `/api/paypal/catalog` from the server's existing product definitions. It compares the current internal ledger balance with the selected model's existing cost calculator and recommends the least expensive currently sufficient catalog option. Reference uploads create a saved job before the paid storyboard preflight, so checkout can return to `/dashboard?job=...` with its settings and attachments intact.

## Architecture

`POST /api/architecture/location` parses Google Maps place, coordinate and short share links. It returns coordinates or a place label when available, never an invented plot size. The Architecture composer requests a site image, accepts a building reference and user dimensions, and requires plot width/depth or an explicit estimated-scale choice. An address can be used when there is no Maps link. Server-side guidance uses the existing Space image models for stills and Cinema/Veo video models for tours. The accepted dimensions and source references are saved on the job for iteration.

No map imagery is fetched from Google. Users provide a site/satellite screenshot or photo; Maps links supply location only. A Google Maps link alone cannot establish accurate boundaries or construction-grade dimensions. Generated results are visual concepts, and provider models cannot guarantee exact text, logos, facade geometry or survey accuracy.
