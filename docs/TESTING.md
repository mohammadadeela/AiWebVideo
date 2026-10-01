# Cinematic UI verification — 2026-10-01

Commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
CHROMIUM_PATH=/path/to/chromium pnpm --filter @workspace/api-server run check:browser
CHROMIUM_PATH=/path/to/chromium node artifacts/api-server/browser-checks/cinematic.cjs
```

The cinematic check requires ffmpeg and an installed Chromium. It serves the actual production frontend and supplies local API fixtures; it does not access live accounts, charge credits or publish marketing data. Screenshots go into a reported temporary directory.

Verified in this session:
- Full frontend/server/library type checks and production build passed.
- 307 automated tests passed, none failed or skipped.
- Existing browser checks passed: slider dragging versus clicking, cursors and per-account Recent files.
- Cinematic checks: Home at 320/390/768/1440/1920px; sticky navigation; visible background artwork; actual playback of a muted one-second looping video with no controls; reduced-motion pause.
- Public route smoke checks: pricing, features, about, FAQ, privacy, terms, how it works, AI video, interior, architecture, examples and prompt guide.
- Dashboard, profile, Studio and Admin Homepage rendered at 320/390/768/1440px without horizontal document overflow; screenshots inspected for representative mobile/desktop pages.
- Admin background order was saved to the mock API and appeared on Home without a reload, exercising the shared gallery-cache refresh.

Limits: these checks do not establish live provider/authentication/payment functionality, actual production upload persistence, live project editor behavior, Safari compatibility or measured Core Web Vitals. Existing backend upload/auth/storage paths are reused without changes. Hostinger has not been deployed from this session.
