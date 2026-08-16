# Implemented updates

- Kept the original `logo.svg` and `favicon.svg` unchanged. Added standard PNG
  browser/mobile icons generated from that same existing artwork.
- Added protected landing-video administration with upload support, compact
  three-card previews, editable labels/captions/overlay text, and a sticky
  save control at the top of the admin page.
- Added itemized provider-cost events and an admin dashboard for real monthly
  usage plus configured Gemini unit prices (planning tokens, script tokens,
  images, video seconds, narration seconds, and GPU work).
- Added friendly website-name input: users may type `example`, `example.com`,
  `www.example.com`, or a full URL; the app safely normalizes it to HTTPS.
- Added an explicit narration-language selector with English selected by
  default and support for Arabic, French, Spanish, German, Italian, Turkish,
  Hindi, Urdu, Portuguese, Russian, Chinese, Japanese, and Korean.
- Added a post-capture question for screenshots of private/admin pages that
  the crawler cannot access. Uploading requires sign-in and job ownership.
- Preserved and clarified custom prompts and user-photo upload flows.
- Enforced exact supported durations (8, 24, or 56 seconds) on the server and
  kept checkout eligibility tied to the actual credits required by the chosen
  duration, mode, narration, and quality.
- Made Stripe/PayPal credit grants durable and idempotent. Returning from a
  purchase now reopens the exact saved project so generation can continue.
- Added LinkedIn-optimized video mode to the UI, planner, fallback planner,
  runtime generation prompt, and automated tests.
- Added canonical/search metadata, structured data, dynamic `robots.txt` and
  `sitemap.xml`, browser/mobile manifests and icons, plus a production indexing
  checklist in `SEO-DEPLOYMENT.md`.
- Added baseline response security headers and stricter protected upload and
  asset-path validation.
- Added three explicit audio choices: voice with music, music only with no
  talking, and a silent master. Music-only renders remove provider speech and
  use a controlled instrumental bed.
- Captured each submitted website's real icon or logo, with a branded monogram
  fallback, and added a polished final video card using the icon and exact
  website name.
- Added a Website Icon Studio that creates four distinct, square icon concepts
  grounded in the submitted website, captured brand, and the user's own brief.
- Added clipboard photo attachments in chat. Users can paste one or several
  copied photos/screenshots with Ctrl+V or Cmd+V, see real thumbnail previews,
  open a full-size preview, remove or add more, and send them through the
  existing validated upload flow.
- Added administrator-only unlimited photo paste/upload batches while keeping
  regular-user and per-file safeguards in place.
- Added intelligent media planning across every video mode: selectable source
  photos/pages, one-scene-per-item duration recommendations, orientation and
  focus advice, and custom 8-second-step videos from 8 seconds to 4 minutes.
- Added an exact server preflight quote with current balance, credit breakdown,
  and shortfall before rendering. Unaffordable productions never begin; users
  can shorten/focus the plan or buy the displayed number of missing credits.
- Expanded the protected admin cost view with all 30 supported video lengths,
  Gemini Fast/Standard 1080p/4K estimated costs, customer credits, narration,
  and video-plus-photo extras.

## Verification

- TypeScript type checks: passed
- API automated tests: 73 passed, 0 failed
- Production frontend and API builds: passed
