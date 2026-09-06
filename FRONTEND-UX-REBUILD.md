# AiWebVideo Frontend / UX Rebuild — 2026-08-27

This repository includes the production frontend rebuild requested for AiWebVideo. The work keeps the existing backend/API generation flows and the existing brand identity while reorganizing the public product experience and authenticated workspace around one unified creator.

## Brand integrity

- `artifacts/aiwebvideo/public/logo.svg` is unchanged from the supplied repository.
- `artifacts/aiwebvideo/src/components/ui/Wordmark.tsx` is unchanged from the supplied repository.
- The existing locked background, panel, text, mint, violet, pink, and gold tokens remain the core palette.

## Main frontend changes

- Rebuilt the landing page around a cinematic, video-first first viewport using the existing configurable campaign videos.
- Added a unified creator with five entry modes: Website Video, AI Video, Product Photos, Product Video, and Talking Scene.
- Kept website, studio, photo, and video generation in the shared chat/workspace rather than creating separate visual products.
- Added clearer attachment UI, drag/drop, reference thumbnails, file validation, and product-reference guidance.
- Improved source-aware production progress and result actions so studio jobs do not inherit website-only labels/actions.
- Rebuilt navigation for desktop/mobile and preserved creator deep links such as `/?create=product-video#generate`.
- Rebuilt `/dashboard` as an application workspace with creation shortcuts, active generations, searchable history, pin/delete actions, credits, and project context.
- Rebuilt `/profile` as a private account center with plan/credits, billing actions, project history, account access, and admin entry where applicable.
- Improved pricing explanation without inventing prices or replacing existing billing logic.
- Reworked Studio entry pages so legacy `/studio/*` routes still use the same creator/chat/progress/result system.
- Reworked Features, How It Works, About, FAQ, footer, and supporting public content into one visual language.
- Improved generated video/photo result presentation and result actions.
- Added/strengthened reduced-motion, focus, touch-target, responsive overflow, and semantic interaction handling.
- Converted nested link/button controls to a valid polymorphic `Button asChild` pattern.
- Lazy-loaded route modules through the existing Wouter application shell.

## Validation performed in this sandbox

- TypeScript/TSX source syntax transpilation: **110 files checked, 0 syntax failures**.
- Internal `@/` and relative import target audit: **0 missing internal imports**.
- Nested interactive link/button audit: **0 remaining wrapper cases**.
- Exact logo SHA-256 equality vs supplied repository: **verified**.
- Exact `Wordmark.tsx` SHA-256 equality vs supplied repository: **verified**.

## Full build limitation in this sandbox

The uploaded archive does not contain `node_modules`, and this execution environment cannot currently resolve `registry.npmjs.org`. Therefore the current rebuilt source could not rerun `pnpm install`, the complete TypeScript project check, or the Vite production build here.

The direct `tsc -p artifacts/aiwebvideo/tsconfig.json --noEmit` attempt stops before project checking because the dependency type packages are unavailable locally (`node` and `vite/client`). This is an environment/dependency-availability limitation, not a source syntax failure.

After installing the locked dependencies in a networked environment, run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @workspace/aiwebvideo typecheck
pnpm --filter @workspace/aiwebvideo build
```

Then perform the normal browser smoke test for logged-out, logged-in, creation, generation, billing, and mobile flows before production deployment.

## Smart Settings visibility fix — 2026-08-29
- Website Video is now treated as a video production mode in the unified creator, so Duration and Audio controls are available there.
- Smart Settings now shows a production-control panel with duration presets/custom duration, format, quality, audio mode, and narration language.
- Opening the panel scrolls it into view, and the initial creator region can scroll inside constrained workspace layouts instead of clipping controls.
- Product Photos intentionally keeps video-only Duration/Audio controls hidden.
- Frontend static validation after this patch: 110 TS/TSX files, 0 syntax errors, 0 missing internal imports.

